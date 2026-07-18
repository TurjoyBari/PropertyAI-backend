import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { LeadTemperature, PropertyStatus } from '../common/enums';
import { GeminiService } from './gemini.service';
import {
  ChatAgentDto,
  MatchPropertiesDto,
  ScoreLeadDto,
} from './dto/ai.dto';

type MatchResult = {
  matches: Array<{
    propertyId: string;
    matchScore: number;
    reason: string;
    highlights: string[];
  }>;
  alternatives: Array<{
    propertyId: string;
    matchScore: number;
    reason: string;
  }>;
  summary: string;
};

type ScoreResult = {
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  conversionProbability: number;
  recommendedNextAction: string;
  rationale: string;
  factors: string[];
};

@Injectable()
export class AiService {
  constructor(
    private readonly gemini: GeminiService,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
  ) {}

  status() {
    return {
      configured: this.gemini.isConfigured(),
      features: ['property-matching', 'lead-scoring', 'voice-sales-agent'],
      model: 'gemini-2.0-flash',
    };
  }

  async matchProperties(dto: MatchPropertiesDto) {
    const filter: Record<string, unknown> = {
      isActive: true,
      status: {
        $in: [PropertyStatus.AVAILABLE, PropertyStatus.RESERVED, PropertyStatus.DRAFT],
      },
    };

    if (dto.propertyType) filter.type = dto.propertyType;
    if (dto.bedrooms != null) filter.bedrooms = { $gte: dto.bedrooms };
    if (dto.budgetMin != null || dto.budgetMax != null) {
      filter.price = {};
      if (dto.budgetMin != null) (filter.price as Record<string, number>).$gte = dto.budgetMin;
      if (dto.budgetMax != null) (filter.price as Record<string, number>).$lte = dto.budgetMax;
    }
    if (dto.location?.trim()) {
      const term = new RegExp(dto.location.trim(), 'i');
      filter.$or = [
        { 'location.city': term },
        { 'location.area': term },
        { 'location.address': term },
        { title: term },
      ];
    }

    const candidates = await this.propertyModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean()
      .exec();

    if (candidates.length === 0) {
      return {
        criteria: dto,
        matches: [],
        alternatives: [],
        summary: 'No properties matched the initial filters. Try widening budget or location.',
        mode: 'empty' as const,
      };
    }

    const catalog = candidates.map((p) => ({
      id: String(p._id),
      title: p.title,
      type: p.type,
      status: p.status,
      price: p.price,
      currency: p.currency,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      areaSqFt: p.areaSqFt,
      city: p.location?.city,
      area: p.location?.area,
      description: p.description?.slice(0, 280),
    }));

    const ai = await this.gemini.generateJson<MatchResult>(
      'You are a real-estate matching assistant for Bangladesh/PropertyAI. Rank properties for the buyer criteria.',
      `Buyer criteria:\n${JSON.stringify(dto, null, 2)}\n\nCandidate properties:\n${JSON.stringify(catalog, null, 2)}\n\nRespond with JSON:\n{\n  "matches": [{"propertyId":"...","matchScore":0-100,"reason":"...","highlights":["..."]}],\n  "alternatives": [{"propertyId":"...","matchScore":0-100,"reason":"..."}],\n  "summary":"..."\n}\nPick top 5 matches and up to 3 alternatives. Only use ids from the candidate list.`,
    );

    const byId = new Map(candidates.map((p) => [String(p._id), p]));

    const hydrate = (
      rows: Array<{ propertyId: string; matchScore: number; reason: string; highlights?: string[] }>,
    ) =>
      rows
        .map((row) => {
          const property = byId.get(row.propertyId);
          if (!property) return null;
          return {
            ...row,
            matchScore: Math.max(0, Math.min(100, Number(row.matchScore) || 0)),
            property: {
              _id: String(property._id),
              title: property.title,
              type: property.type,
              status: property.status,
              price: property.price,
              currency: property.currency,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              location: property.location,
              images: property.images?.slice(0, 1) ?? [],
            },
          };
        })
        .filter(Boolean);

    return {
      criteria: dto,
      matches: hydrate(ai.matches ?? []),
      alternatives: hydrate(
        (ai.alternatives ?? []).map((row) => ({ ...row, highlights: [] })),
      ),
      summary: ai.summary,
      mode: 'live' as const,
    };
  }

  async scoreLead(dto: ScoreLeadDto) {
    if (!Types.ObjectId.isValid(dto.leadId)) {
      throw new NotFoundException('Lead not found');
    }

    const lead = await this.leadModel.findOne({ _id: dto.leadId, isActive: true });
    if (!lead) throw new NotFoundException('Lead not found');

    const visitCount = await this.visitModel.countDocuments({
      lead: lead._id,
      isActive: true,
    });

    const payload = {
      fullName: lead.fullName,
      status: lead.status,
      source: lead.source,
      temperature: lead.temperature,
      currentScore: lead.score,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      preferredLocation: lead.preferredLocation,
      buyingTimeline: lead.buyingTimeline,
      notesCount: lead.notes?.length ?? 0,
      recentNotes: (lead.notes ?? []).slice(-3).map((n) => n.body),
      visitCount,
      interestedProperties: lead.interestedProperties?.length ?? 0,
    };

    const ai = await this.gemini.generateJson<ScoreResult>(
      'You are a CRM lead-scoring engine for a real-estate sales team.',
      `Analyze this lead and return JSON:\n${JSON.stringify(payload, null, 2)}\n\nSchema:\n{\n  "score": 0-100,\n  "temperature": "hot"|"warm"|"cold",\n  "conversionProbability": 0-100,\n  "recommendedNextAction": "...",\n  "rationale": "...",\n  "factors": ["..."]\n}`,
    );

    const score = Math.max(0, Math.min(100, Math.round(Number(ai.score) || 0)));
    const temperature = this.toTemperature(ai.temperature, score);

    lead.score = score;
    lead.temperature = temperature;
    await lead.save();

    return {
      leadId: String(lead._id),
      score,
      temperature,
      conversionProbability: Math.max(
        0,
        Math.min(100, Math.round(Number(ai.conversionProbability) || score)),
      ),
      recommendedNextAction: ai.recommendedNextAction,
      rationale: ai.rationale,
      factors: ai.factors ?? [],
      lead: lead.toObject(),
    };
  }

  async chatAgent(dto: ChatAgentDto) {
    let propertyContext: Record<string, unknown> | null = null;

    if (dto.propertyId) {
      if (!Types.ObjectId.isValid(dto.propertyId)) {
        throw new NotFoundException('Property not found');
      }
      const property = await this.propertyModel
        .findOne({ _id: dto.propertyId, isActive: true })
        .lean()
        .exec();
      if (!property) throw new NotFoundException('Property not found');
      propertyContext = {
        id: String(property._id),
        title: property.title,
        type: property.type,
        status: property.status,
        price: property.price,
        currency: property.currency,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        areaSqFt: property.areaSqFt,
        location: property.location,
        amenities: property.amenities,
        description: property.description?.slice(0, 600),
      };
    } else {
      const sample = await this.propertyModel
        .find({ isActive: true, status: PropertyStatus.AVAILABLE })
        .limit(8)
        .select('title type price currency bedrooms location.city location.area')
        .lean()
        .exec();
      propertyContext = {
        availableSample: sample.map((p) => ({
          id: String(p._id),
          title: p.title,
          type: p.type,
          price: p.price,
          currency: p.currency,
          bedrooms: p.bedrooms,
          city: p.location?.city,
          area: p.location?.area,
        })),
      };
    }

    const history = (dto.history ?? [])
      .slice(-8)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const reply = await this.gemini.generateText(
      `You are PropertyAI Voice Sales Agent (text mode). Be concise, helpful, and sales-oriented for Bangladesh real estate.\nCapabilities: answer property questions, explain listing details, suggest booking a site visit via /visits.\nNever invent exact legal claims. If unsure, ask a clarifying question.\n\nProperty context:\n${JSON.stringify(propertyContext, null, 2)}\n\nConversation so far:\n${history || '(new chat)'}\n\nUSER: ${dto.message}\nASSISTANT:`,
    );

    return {
      reply,
      propertyId: dto.propertyId ?? null,
      mode: 'text-agent' as const,
    };
  }

  private toTemperature(value: string, score: number): LeadTemperature {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'hot') return LeadTemperature.HOT;
    if (normalized === 'warm') return LeadTemperature.WARM;
    if (normalized === 'cold') return LeadTemperature.COLD;
    if (score >= 75) return LeadTemperature.HOT;
    if (score >= 45) return LeadTemperature.WARM;
    return LeadTemperature.COLD;
  }
}
