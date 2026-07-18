import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.notificationsService.listForUser(session.user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Session() session: UserSession) {
    return this.notificationsService.markRead(id, session.user.id);
  }

  @Post('send')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  send(@Body() dto: SendNotificationDto, @Session() session: UserSession) {
    return this.notificationsService.send(dto, session.user.id);
  }
}
