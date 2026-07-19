import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from './schemas/property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertyPurpose, PropertyStatus, PropertyType, UserRole } from '../common/enums';

export type PropertyActor = {
  id: string;
  role: string;
};

type PropertyFilter = {
  isActive: boolean;
  type?: PropertyType;
  status?: PropertyStatus;
  purpose?: PropertyPurpose | { $in: Array<PropertyPurpose | null> };
  bedrooms?: { $gte: number };
  listedBy?: Types.ObjectId;
  'location.city'?: RegExp;
  'location.area'?: RegExp;
  price?: { $gte?: number; $lte?: number };
  $or?: Array<Record<string, unknown>>;
  $and?: Array<Record<string, unknown>>;
};

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
  ) {}

  async create(dto: CreatePropertyDto, userId: string) {
    const property = await this.propertyModel.create({
      ...dto,
      status: dto.status ?? PropertyStatus.DRAFT,
      purpose: dto.purpose ?? PropertyPurpose.SALE,
      currency: dto.currency ?? 'BDT',
      bedrooms: dto.bedrooms ?? 0,
      bathrooms: dto.bathrooms ?? 0,
      parking: dto.parking ?? 0,
      images: dto.images ?? [],
      amenities: dto.amenities ?? [],
      listedBy: Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : undefined,
      isActive: true,
      activityLog: [
        {
          userId,
          role: 'agent',
          action: 'Agent created property',
          at: new Date(),
        },
      ],
    });

    return property.toObject();
  }

  /**
   * List properties. When `actor` is an agent, results are scoped to `listedBy`.
   * Admins / public (no actor) see the full active catalog (subject to query filters).
   */
  async findAll(query: QueryPropertiesDto, actor?: PropertyActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const filter: PropertyFilter = { isActive: true };

    if (actor?.role === UserRole.AGENT && Types.ObjectId.isValid(actor.id)) {
      filter.listedBy = new Types.ObjectId(actor.id);
    }

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.purpose === PropertyPurpose.RENT) {
      filter.purpose = PropertyPurpose.RENT;
    } else if (query.purpose === PropertyPurpose.SALE) {
      // Treat missing purpose on older docs as sale
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { purpose: PropertyPurpose.SALE },
            { purpose: { $exists: false } },
            { purpose: null },
          ],
        },
      ];
    }
    if (query.city) {
      filter['location.city'] = new RegExp(query.city, 'i');
    }
    if (query.area) {
      filter['location.area'] = new RegExp(query.area, 'i');
    }

    if (query.minPrice != null || query.maxPrice != null) {
      filter.price = {};
      if (query.minPrice != null) filter.price.$gte = query.minPrice;
      if (query.maxPrice != null) filter.price.$lte = query.maxPrice;
    }

    if (query.bedrooms != null) {
      filter.bedrooms = { $gte: query.bedrooms };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { title: new RegExp(term, 'i') },
        { description: new RegExp(term, 'i') },
        { 'location.city': new RegExp(term, 'i') },
        { 'location.area': new RegExp(term, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      this.propertyModel
        .find(filter as never)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.propertyModel.countDocuments(filter as never),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && total > 0,
      },
    };
  }

  async listAreas() {
    const rows = await this.propertyModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            isActive: true,
            status: PropertyStatus.AVAILABLE,
            'location.area': { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$location.area',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ])
      .exec();

    return {
      items: rows
        .map((row) => ({
          name: String(row._id).trim(),
          count: row.count,
        }))
        .filter((row) => row.name.length > 0),
    };
  }

  async findOne(id: string, actor?: PropertyActor) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Property not found');
    }

    const property = await this.propertyModel
      .findOne({ _id: id, isActive: true })
      .lean()
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (actor) {
      this.assertCanView(property, actor.id, actor.role);
    }

    if (actor?.role !== UserRole.ADMIN) {
      const {
        adminNotes: _n,
        activityLog: _a,
        documents: _d,
        suggestedPrice: _s,
        finalPrice: _f,
        commissionPercent: _c,
        ...safe
      } = property as typeof property & Record<string, unknown>;
      return safe;
    }

    return property;
  }

  async update(
    id: string,
    dto: UpdatePropertyDto,
    userId: string,
    role: string,
  ) {
    const property = await this.findActiveDocument(id);
    this.assertCanMutate(property, userId, role);

    Object.assign(property, dto);
    property.lastUpdatedBy = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : property.lastUpdatedBy;
    property.activityLog = property.activityLog || [];
    property.activityLog.push({
      userId,
      role: role === UserRole.ADMIN ? 'admin' : 'agent',
      action: 'Property details updated',
      at: new Date(),
    });
    await property.save();
    return property.toObject();
  }

  async remove(id: string, userId: string, role: string) {
    const property = await this.findActiveDocument(id);
    this.assertCanMutate(property, userId, role);

    property.isActive = false;
    if (Types.ObjectId.isValid(userId)) {
      property.deletedBy = new Types.ObjectId(userId);
      property.deletedAt = new Date();
      property.lastUpdatedBy = new Types.ObjectId(userId);
    }
    property.activityLog = property.activityLog || [];
    property.activityLog.push({
      userId,
      role: role === UserRole.ADMIN ? 'admin' : 'agent',
      action: 'Property soft-deleted',
      at: new Date(),
    });
    await property.save();

    return { id: property.id, deleted: true };
  }

  private async findActiveDocument(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Property not found');
    }

    const property = await this.propertyModel.findOne({
      _id: id,
      isActive: true,
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  private assertCanView(
    property: { listedBy?: Types.ObjectId | string | null },
    userId: string,
    role: string,
  ) {
    if (role === UserRole.ADMIN) return;
    if (role !== UserRole.AGENT) return;

    const ownerId = property.listedBy?.toString();
    if (ownerId && ownerId === userId) return;

    throw new ForbiddenException('You cannot access this property');
  }

  private assertCanMutate(
    property: PropertyDocument,
    userId: string,
    role: string,
  ) {
    if (role === UserRole.ADMIN) return;

    const ownerId = property.listedBy?.toString();
    if (ownerId && ownerId === userId) return;

    throw new ForbiddenException('You cannot modify this property');
  }
}
