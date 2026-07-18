import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async inbox(userId: string) {
    const uid = this.toId(userId);
    return this.messageModel
      .find({
        isActive: true,
        $or: [{ fromUserId: uid }, { toUserId: uid }],
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  async send(fromUserId: string, dto: SendMessageDto) {
    const from = this.toId(fromUserId);
    const to = this.toId(dto.toUserId);
    if (String(from) === String(to)) {
      throw new BadRequestException('Cannot message yourself');
    }

    const message = await this.messageModel.create({
      fromUserId: from,
      toUserId: to,
      body: dto.body,
      propertyId:
        dto.propertyId && Types.ObjectId.isValid(dto.propertyId)
          ? new Types.ObjectId(dto.propertyId)
          : undefined,
      isRead: false,
      isActive: true,
    });

    return message.toObject();
  }

  async markRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Message not found');
    const message = await this.messageModel.findOneAndUpdate(
      { _id: id, toUserId: this.toId(userId), isActive: true },
      { isRead: true },
      { new: true },
    );
    if (!message) throw new NotFoundException('Message not found');
    return message.toObject();
  }

  private toId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid user id');
    }
    return new Types.ObjectId(value);
  }
}
