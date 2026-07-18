import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VisitStatus } from '../../common/enums';

export type VisitDocument = HydratedDocument<Visit>;

@Schema({
  timestamps: true,
  collection: 'visits',
})
export class Visit {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  lead: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  property: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedAgent?: Types.ObjectId;

  @Prop({ required: true, index: true })
  scheduledAt: Date;

  @Prop({ min: 15, max: 480, default: 60 })
  durationMinutes: number;

  @Prop({
    type: String,
    enum: VisitStatus,
    default: VisitStatus.SCHEDULED,
    index: true,
  })
  status: VisitStatus;

  @Prop({ trim: true })
  locationNote?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);

VisitSchema.index({ scheduledAt: 1, status: 1 });
VisitSchema.index({ lead: 1, scheduledAt: -1 });
