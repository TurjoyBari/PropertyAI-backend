import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PropertyPurpose, PropertyStatus, PropertyType } from '../../common/enums';

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

  @Prop({
    type: String,
    enum: PropertyPurpose,
    default: PropertyPurpose.SALE,
    index: true,
  })
  purpose: PropertyPurpose;

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

  @Prop({ min: 0, default: 0 })
  parking?: number;

  @Prop({ default: false, index: true })
  featured?: boolean;

  /** Admin-only private notes */
  @Prop({ trim: true })
  adminNotes?: string;

  @Prop({ type: [String], default: [] })
  internalTags?: string[];

  @Prop({ min: 0 })
  suggestedPrice?: number;

  @Prop({ min: 0 })
  finalPrice?: number;

  @Prop({ min: 0, max: 100 })
  commissionPercent?: number;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  documents?: Array<{
    name: string;
    url?: string;
    uploadedAt?: Date;
    verified?: boolean;
  }>;

  @Prop({
    type: [
      {
        userId: { type: String },
        userName: { type: String },
        role: { type: String },
        action: { type: String, required: true },
        at: { type: Date, default: Date.now },
        ip: { type: String },
      },
    ],
    default: [],
  })
  activityLog?: Array<{
    userId?: string;
    userName?: string;
    role?: string;
    action: string;
    at?: Date;
    ip?: string;
  }>;

  @Prop({ type: Types.ObjectId })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId })
  deletedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId })
  lastUpdatedBy?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

PropertySchema.index({ price: 1, 'location.city': 1, type: 1, status: 1 });
