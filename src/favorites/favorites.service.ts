import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';
import { Property, PropertyDocument } from '../properties/schemas/property.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
  ) {}

  async list(userId: string) {
    const uid = this.requireId(userId, 'User');
    const items = await this.favoriteModel
      .find({ userId: uid })
      .populate('property')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      items: items
        .filter((row) => row.property)
        .map((row) => ({
          _id: String(row._id),
          property: row.property,
          createdAt: (row as { createdAt?: Date }).createdAt,
        })),
    };
  }

  async add(userId: string, propertyId: string) {
    const uid = this.requireId(userId, 'User');
    const pid = this.requireId(propertyId, 'Property');

    const property = await this.propertyModel.exists({
      _id: pid,
      isActive: true,
    });
    if (!property) throw new NotFoundException('Property not found');

    try {
      const favorite = await this.favoriteModel.create({
        userId: uid,
        property: pid,
      });
      return this.favoriteModel
        .findById(favorite._id)
        .populate('property')
        .lean()
        .exec();
    } catch {
      throw new ConflictException('Property already saved');
    }
  }

  async remove(userId: string, propertyId: string) {
    const uid = this.requireId(userId, 'User');
    const pid = this.requireId(propertyId, 'Property');
    const result = await this.favoriteModel.findOneAndDelete({
      userId: uid,
      property: pid,
    });
    if (!result) throw new NotFoundException('Favorite not found');
    return { deleted: true, propertyId };
  }

  async isFavorite(userId: string, propertyId: string) {
    const uid = this.requireId(userId, 'User');
    const pid = this.requireId(propertyId, 'Property');
    const exists = await this.favoriteModel.exists({
      userId: uid,
      property: pid,
    });
    return { propertyId, favorited: Boolean(exists) };
  }

  private requireId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new NotFoundException(`${label} not found`);
    }
    return new Types.ObjectId(value);
  }
}
