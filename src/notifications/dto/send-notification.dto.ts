import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NotificationChannel } from '../schemas/notification.schema';

export class SendNotificationDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(2)
  body: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
