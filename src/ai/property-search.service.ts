import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { PropertyStatus, PropertyType } from '../common/enums';
import type { PropertySearchCriteria } from './types/ai.types';
import { parseBudgetFromText } from './utils/budget-parse';

@Injectable()
export class PropertySearchService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
  ) {}

  async findByIds(ids: string[], limit = 10) {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id))
      .slice(0, limit);
    if (!objectIds.length) return [];

    const items = await this.propertyModel
      .find({ _id: { $in: objectIds }, isActive: true })
      .lean()
      .exec();

    const order = new Map(objectIds.map((id, i) => [String(id), i]));
    return items.sort(
      (a, b) =>
        (order.get(String(a._id)) ?? 99) - (order.get(String(b._id)) ?? 99),
    );
  }

  async findByTitleOrText(query: string, limit = 5) {
    const term = query.trim();
    if (!term) return [];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    return this.propertyModel
      .find({
        isActive: true,
        $or: [
          { title: regex },
          { description: regex },
          { 'location.area': regex },
          { 'location.city': regex },
        ],
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Deterministic MongoDB search from structured criteria.
   * Never drops budget / location / type constraints.
   */
  async search(
    criteria: PropertySearchCriteria,
    options?: { limit?: number; soften?: boolean },
  ) {
    const limit = options?.limit ?? 12;
    if (!this.hasSearchSignal(criteria)) {
      return [];
    }

    const filter = this.buildFilter(criteria);
    const items = await this.propertyModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    /**
     * Soften still keeps hard constraints (budget, location, type, purpose).
     * It may only relax bedrooms by 1 when there are zero strict hits.
     */
    if (items.length === 0 && options?.soften === true) {
      if (criteria.bedrooms != null && criteria.bedrooms > 1) {
        const softCriteria: PropertySearchCriteria = {
          ...criteria,
          bedrooms: criteria.bedrooms - 1,
        };
        return this.propertyModel
          .find(this.buildFilter(softCriteria))
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean()
          .exec();
      }
    }

    return items;
  }

  hasSearchSignal(criteria: PropertySearchCriteria) {
    return Boolean(
      criteria.location ||
        criteria.area ||
        criteria.city ||
        criteria.propertyType ||
        criteria.bedrooms != null ||
        criteria.bathrooms != null ||
        criteria.budgetMin != null ||
        criteria.budgetMax != null ||
        criteria.nearMetro ||
        criteria.parking != null ||
        criteria.furnished != null ||
        criteria.minAreaSqFt != null ||
        criteria.maxAreaSqFt != null ||
        criteria.purpose ||
        (criteria.amenities && criteria.amenities.length),
    );
  }

  scoreAgainstCriteria(
    property: {
      title?: string;
      type?: string;
      price?: number;
      bedrooms?: number;
      bathrooms?: number;
      amenities?: string[];
      location?: { city?: string; area?: string; address?: string };
      description?: string;
    },
    criteria: PropertySearchCriteria,
  ) {
    let score = 50;
    const highlights: string[] = [];
    const loc = (criteria.location || criteria.area || criteria.city || '')
      .toLowerCase()
      .trim();

    if (loc) {
      const hay = [
        property.location?.area,
        property.location?.city,
        property.location?.address,
        property.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(loc)) {
        score += 25;
        highlights.push(
          `Location match: ${criteria.location || criteria.area || criteria.city}`,
        );
      } else {
        score -= 8;
      }
    }

    if (criteria.bedrooms != null) {
      const beds = property.bedrooms ?? 0;
      if (beds >= criteria.bedrooms) {
        score += 12;
        highlights.push(`${beds} bedrooms`);
      } else {
        score -= 14;
      }
    }

    if (criteria.bathrooms != null) {
      const baths = property.bathrooms ?? 0;
      if (baths >= criteria.bathrooms) score += 6;
    }

    if (criteria.propertyType && property.type === criteria.propertyType) {
      score += 10;
      highlights.push(`${criteria.propertyType} type`);
    }

    const price = property.price ?? 0;
    if (criteria.budgetMax != null) {
      if (price <= criteria.budgetMax) {
        score += 12;
        highlights.push('Within budget');
      } else {
        score -= 30;
      }
    }
    if (criteria.budgetMin != null && price >= criteria.budgetMin) {
      score += 3;
    }

    if (criteria.nearMetro) {
      const blob =
        `${property.description || ''} ${(property.amenities || []).join(' ')}`.toLowerCase();
      if (blob.includes('metro')) {
        score += 8;
        highlights.push('Near metro mentioned');
      }
    }

    score = Math.max(35, Math.min(99, score));
    return {
      matchScore: score,
      reason: highlights[0] || 'Matched from standard database search',
      highlights: highlights.slice(0, 4),
    };
  }

  hydrate(
    property: {
      _id: unknown;
      title: string;
      type: string;
      status: string;
      price: number;
      currency?: string;
      bedrooms?: number;
      bathrooms?: number;
      areaSqFt?: number;
      location?: unknown;
      images?: string[];
    },
    ranking: { matchScore: number; reason: string; highlights?: string[] },
  ) {
    return {
      propertyId: String(property._id),
      matchScore: ranking.matchScore,
      reason: ranking.reason,
      highlights: ranking.highlights ?? [],
      property: {
        _id: String(property._id),
        title: property.title,
        type: property.type,
        status: property.status,
        price: property.price,
        currency: property.currency || 'BDT',
        bedrooms: property.bedrooms ?? 0,
        bathrooms: property.bathrooms ?? 0,
        areaSqFt: property.areaSqFt,
        location: property.location,
        images: property.images?.slice(0, 1) ?? [],
      },
    };
  }

  /**
   * Rule-based NL parse — same filter semantics as AI extraction.
   */
  heuristicExtract(query: string): PropertySearchCriteria {
    const text = query.toLowerCase();
    const criteria: PropertySearchCriteria = { notes: query };

    const beds = text.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms|রুম|বেড)/i);
    if (beds) criteria.bedrooms = Number(beds[1]);

    const baths = text.match(/(\d+)\s*(?:bath|baths|bathroom|bathrooms)/i);
    if (baths) criteria.bathrooms = Number(baths[1]);

    for (const type of Object.values(PropertyType)) {
      if (text.includes(type)) {
        criteria.propertyType = type;
        break;
      }
    }
    if (!criteria.propertyType && /\b(flat|apartment)s?\b/.test(text)) {
      criteria.propertyType = PropertyType.APARTMENT;
    }

    const budget = parseBudgetFromText(query);
    if (budget.budgetMin != null) criteria.budgetMin = budget.budgetMin;
    if (budget.budgetMax != null) criteria.budgetMax = budget.budgetMax;

    const areas = [
      'uttara',
      'banani',
      'gulshan',
      'dhanmondi',
      'mirpur',
      'bashundhara',
      'motijheel',
      'mohakhali',
      'badda',
      'wari',
      'lalmatia',
      'baridhara',
      'tejgaon',
    ];
    for (const area of areas) {
      if (text.includes(area)) {
        criteria.location = area.charAt(0).toUpperCase() + area.slice(1);
        criteria.area = criteria.location;
        break;
      }
    }

    if (text.includes('metro')) criteria.nearMetro = true;
    if (/\brent\b|ভাড়া/.test(text)) criteria.purpose = 'rent';
    if (/\bbuy\b|\bsale\b|কিন/.test(text)) criteria.purpose = 'sale';
    if (/\bfurnished\b/.test(text)) criteria.furnished = true;
    if (/\bunfurnished\b/.test(text)) criteria.furnished = false;

    const parking = text.match(/(\d+)\s*(?:parking|car\s*park)/i);
    if (parking) criteria.parking = Number(parking[1]);
    else if (/\bparking\b/.test(text)) criteria.parking = 1;

    const sqft = text.match(/(\d+)\s*(?:sq\.?\s*ft|sqft|sft)/i);
    if (sqft) criteria.minAreaSqFt = Number(sqft[1]);

    return criteria;
  }

  /** Prefer deterministic budget when merging AI + heuristic. */
  mergeCriteria(
    preferred: PropertySearchCriteria,
    fallback: PropertySearchCriteria,
  ): PropertySearchCriteria {
    return {
      ...fallback,
      ...Object.fromEntries(
        Object.entries(preferred).filter(
          ([, v]) => v !== undefined && v !== null && v !== '',
        ),
      ),
      budgetMin: preferred.budgetMin ?? fallback.budgetMin,
      budgetMax: preferred.budgetMax ?? fallback.budgetMax,
    };
  }

  buildFilter(criteria: PropertySearchCriteria) {
    const filter: Record<string, unknown> = {
      isActive: true,
      status: {
        $in: [
          PropertyStatus.AVAILABLE,
          PropertyStatus.RESERVED,
          PropertyStatus.DRAFT,
        ],
      },
    };

    if (criteria.propertyType) filter.type = criteria.propertyType;
    if (criteria.purpose) filter.purpose = criteria.purpose;
    if (criteria.bedrooms != null) filter.bedrooms = { $gte: criteria.bedrooms };
    if (criteria.bathrooms != null) {
      filter.bathrooms = { $gte: criteria.bathrooms };
    }
    if (criteria.parking != null) {
      filter.parking = { $gte: criteria.parking };
    }

    if (criteria.budgetMin != null || criteria.budgetMax != null) {
      const price: Record<string, number> = {};
      if (criteria.budgetMin != null) price.$gte = criteria.budgetMin;
      if (criteria.budgetMax != null) price.$lte = criteria.budgetMax;
      filter.price = price;
    }

    if (criteria.minAreaSqFt != null || criteria.maxAreaSqFt != null) {
      const area: Record<string, number> = {};
      if (criteria.minAreaSqFt != null) area.$gte = criteria.minAreaSqFt;
      if (criteria.maxAreaSqFt != null) area.$lte = criteria.maxAreaSqFt;
      filter.areaSqFt = area;
    }

    if (criteria.furnished === true) {
      filter.amenities = { $regex: /furnished/i };
    } else if (criteria.furnished === false) {
      filter.amenities = { $not: { $regex: /furnished/i } };
    }

    const loc = (
      criteria.location ||
      criteria.area ||
      criteria.city ||
      ''
    ).trim();
    if (loc) {
      const term = new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'location.city': term },
        { 'location.area': term },
        { 'location.address': term },
        { title: term },
      ];
    }

    if (criteria.nearMetro) {
      filter.$and = [
        ...((filter.$and as unknown[]) || []),
        {
          $or: [
            { amenities: { $regex: /metro/i } },
            { description: { $regex: /metro/i } },
            { title: { $regex: /metro/i } },
          ],
        },
      ];
    }

    return filter;
  }
}
