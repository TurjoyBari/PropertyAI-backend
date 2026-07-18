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

type PropertyFilter = {
  isActive: boolean;
  type?: PropertyType;
  status?: PropertyStatus;
  purpose?: PropertyPurpose | { $in: Array<PropertyPurpose | null> };
  bedrooms?: { $gte: number };
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
      images: dto.images ?? [],
      amenities: dto.amenities ?? [],
      listedBy: Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : undefined,
      isActive: true,
    });

    return property.toObject();
  }

  async findAll(query: QueryPropertiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const filter: PropertyFilter = { isActive: true };

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

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
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

  async findOne(id: string) {
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
    await property.save();
    return property.toObject();
  }

  async remove(id: string, userId: string, role: string) {
    const property = await this.findActiveDocument(id);
    this.assertCanMutate(property, userId, role);

    property.isActive = false;
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

  private assertCanMutate(
    property: PropertyDocument,
    userId: string,
    role: string,
  ) {
    if (role === UserRole.ADMIN) return;

    const ownerId = property.listedBy?.toString();
    if (!ownerId || ownerId === userId) return;

    throw new ForbiddenException('You cannot modify this property');
  }
}
