import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({
    type: String,
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
    index: true,
  })
  channel: NotificationChannel;

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    index: true,
  })
  status: NotificationStatus;

  @Prop({ trim: true })
  recipient?: string;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  @Prop({ default: true })
  isActive: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
