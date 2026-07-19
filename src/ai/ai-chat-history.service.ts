import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiChatSession,
  AiChatSessionDocument,
} from './schemas/ai-chat-session.schema';

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  at?: string | Date;
  matches?: unknown[];
};

@Injectable()
export class AiChatHistoryService {
  constructor(
    @InjectModel(AiChatSession.name)
    private readonly sessionModel: Model<AiChatSessionDocument>,
  ) {}

  async getForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const session = await this.sessionModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    if (!session) {
      return {
        messages: [] as ChatHistoryMessage[],
        lastShownPropertyIds: [] as string[],
        quickReplies: [] as string[],
      };
    }
    return {
      messages: (session.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        at: m.at,
        matches: m.matches,
      })),
      lastShownPropertyIds: session.lastShownPropertyIds || [],
      quickReplies: session.quickReplies || [],
    };
  }

  async saveForUser(
    userId: string,
    body: {
      messages: ChatHistoryMessage[];
      lastShownPropertyIds?: string[];
      quickReplies?: string[];
    },
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }
    const messages = (body.messages || []).slice(-40).map((m) => ({
      role: m.role,
      content: m.content,
      at: m.at ? new Date(m.at) : new Date(),
      matches: m.matches || [],
    }));

    const session = await this.sessionModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            messages,
            lastShownPropertyIds: body.lastShownPropertyIds || [],
            quickReplies: body.quickReplies || [],
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return {
      messages: session?.messages || [],
      lastShownPropertyIds: session?.lastShownPropertyIds || [],
      quickReplies: session?.quickReplies || [],
    };
  }

  async clearForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) return { cleared: true };
    await this.sessionModel.deleteOne({ userId: new Types.ObjectId(userId) });
    return { cleared: true };
  }
}
