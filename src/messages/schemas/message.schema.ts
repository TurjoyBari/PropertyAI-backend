import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  fromUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  toUserId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ toUserId: 1, createdAt: -1 });
