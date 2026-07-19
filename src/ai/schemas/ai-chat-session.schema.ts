import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiChatSessionDocument = HydratedDocument<AiChatSession>;

@Schema({
  timestamps: true,
  collection: 'ai_chat_sessions',
})
export class AiChatSession {
  @Prop({ type: Types.ObjectId, required: true, index: true, unique: true })
  userId: Types.ObjectId;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        at: { type: Date, default: Date.now },
        matches: { type: Array, default: [] },
      },
    ],
    default: [],
  })
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    at?: Date;
    matches?: unknown[];
  }>;

  @Prop({ type: [String], default: [] })
  lastShownPropertyIds: string[];

  @Prop({ type: [String], default: [] })
  quickReplies: string[];
}

export const AiChatSessionSchema = SchemaFactory.createForClass(AiChatSession);
