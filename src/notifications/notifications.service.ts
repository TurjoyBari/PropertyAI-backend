import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as nodemailer from 'nodemailer';
import {
  Notification,
  NotificationChannel,
  NotificationDocument,
  NotificationStatus,
} from './schemas/notification.schema';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string) {
    const clauses: Array<Record<string, unknown>> = [
      { userId: { $exists: false }, channel: NotificationChannel.IN_APP },
    ];

    if (Types.ObjectId.isValid(userId)) {
      clauses.unshift({ userId: new Types.ObjectId(userId) });
    }

    return this.notificationModel
      .find({ isActive: true, $or: clauses })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
  }

  async markRead(id: string, userId: string) {
    const filter: Record<string, unknown> = { _id: id, isActive: true };
    if (Types.ObjectId.isValid(userId)) {
      filter.userId = new Types.ObjectId(userId);
    }

    const doc = await this.notificationModel.findOneAndUpdate(
      filter,
      { status: NotificationStatus.READ },
      { new: true },
    );

    return doc?.toObject() ?? null;
  }

  async send(dto: SendNotificationDto, actorId: string) {
    const doc = await this.notificationModel.create({
      title: dto.title,
      body: dto.body,
      channel: dto.channel,
      recipient: dto.email || dto.phone,
      userId:
        dto.userId && Types.ObjectId.isValid(dto.userId)
          ? new Types.ObjectId(dto.userId)
          : Types.ObjectId.isValid(actorId)
            ? new Types.ObjectId(actorId)
            : undefined,
      status: NotificationStatus.PENDING,
      meta: { actorId },
      isActive: true,
    });

    try {
      if (dto.channel === NotificationChannel.EMAIL) {
        await this.sendEmail(dto.email ?? '', dto.title, dto.body);
      } else if (dto.channel === NotificationChannel.WHATSAPP) {
        await this.sendWhatsApp(dto.phone ?? '', dto.body);
      }

      doc.status =
        dto.channel === NotificationChannel.IN_APP
          ? NotificationStatus.SENT
          : NotificationStatus.SENT;
      await doc.save();
    } catch (error) {
      doc.status = NotificationStatus.FAILED;
      doc.meta = {
        ...(doc.meta ?? {}),
        error: error instanceof Error ? error.message : 'Send failed',
      };
      await doc.save();
      throw error;
    }

    return doc.toObject();
  }

  /** Convenience helper for other modules (visit reminders, etc.). */
  async notifyInApp(input: {
    userId?: string;
    title: string;
    body: string;
  }) {
    return this.notificationModel.create({
      title: input.title,
      body: input.body,
      channel: NotificationChannel.IN_APP,
      userId:
        input.userId && Types.ObjectId.isValid(input.userId)
          ? new Types.ObjectId(input.userId)
          : undefined,
      status: NotificationStatus.SENT,
      isActive: true,
    });
  }

  private async sendEmail(to: string, subject: string, body: string) {
    if (!to) throw new Error('Email recipient required');

    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    const from = this.config.get<string>('smtp.from') || user;

    if (!host || !user || !pass) {
      this.logger.warn(
        `[email:dev] To=${to} Subject=${subject} Body=${body.slice(0, 120)}`,
      );
      return { mode: 'console' as const };
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port', 587),
      secure: this.config.get<boolean>('smtp.secure', false),
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text: body,
    });

    return { mode: 'smtp' as const };
  }

  private async sendWhatsApp(phone: string, body: string) {
    if (!phone) throw new Error('WhatsApp phone required');

    const token = this.config.get<string>('whatsapp.token');
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');

    if (!token || !phoneNumberId) {
      this.logger.warn(`[whatsapp:dev] To=${phone} Body=${body.slice(0, 120)}`);
      return { mode: 'console' as const };
    }

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/\D/g, ''),
          type: 'text',
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WhatsApp API error: ${text}`);
    }

    return { mode: 'api' as const };
  }
}
