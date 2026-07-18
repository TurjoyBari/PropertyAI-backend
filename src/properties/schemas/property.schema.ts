import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PropertyStatus, PropertyType } from '../../common/enums';

export type PropertyDocument = HydratedDocument<Property>;

@Schema({ _id: false })
export class PropertyLocation {
  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true, index: true })
  city: string;

  @Prop({ trim: true, index: true })
  area?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ trim: true })
  postalCode?: string;
}

@Schema({
  timestamps: true,
  collection: 'properties',
})
export class Property {
  @Prop({ required: true, trim: true, index: 'text' })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: String, enum: PropertyType, required: true, index: true })
  type: PropertyType;

  @Prop({ type: String, enum: PropertyStatus, default: PropertyStatus.DRAFT, index: true })
  status: PropertyStatus;

  @Prop({ required: true, min: 0, index: true })
  price: number;

  @Prop({ default: 'BDT', trim: true })
  currency: string;

  @Prop({ min: 0, default: 0 })
  bedrooms: number;

  @Prop({ min: 0, default: 0 })
  bathrooms: number;

  @Prop({ min: 0 })
  areaSqFt?: number;

  @Prop({ type: PropertyLocation, required: true })
  location: PropertyLocation;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  amenities: string[];

  /** Agent / admin who manages this listing */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  listedBy?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

PropertySchema.index({ price: 1, 'location.city': 1, type: 1, status: 1 });
