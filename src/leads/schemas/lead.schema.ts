import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '../../common/enums';

export type LeadDocument = HydratedDocument<Lead>;

@Schema({ _id: false })
export class LeadNote {
  @Prop({ required: true, trim: true })
  body: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({
  timestamps: true,
  collection: 'leads',
})
export class Lead {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ trim: true, index: true })
  phone?: string;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW_LEAD, index: true })
  status: LeadStatus;

  @Prop({ type: String, enum: LeadSource, default: LeadSource.WEBSITE, index: true })
  source: LeadSource;

  @Prop({ type: String, enum: LeadTemperature, default: LeadTemperature.COLD, index: true })
  temperature: LeadTemperature;

  /** 0–100 — AI Lead Scoring will populate this later */
  @Prop({ min: 0, max: 100, default: 0 })
  score: number;

  @Prop({ min: 0 })
  budgetMin?: number;

  @Prop({ min: 0 })
  budgetMax?: number;

  @Prop({ trim: true })
  preferredLocation?: string;

  @Prop({ trim: true })
  buyingTimeline?: string;

  /** Assigned sales agent */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedAgent?: Types.ObjectId;

  /** Properties this lead is interested in */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Property' }], default: [] })
  interestedProperties: Types.ObjectId[];

  @Prop({ type: [LeadNote], default: [] })
  notes: LeadNote[];

  @Prop({ default: true })
  isActive: boolean;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ status: 1, assignedAgent: 1, updatedAt: -1 });
