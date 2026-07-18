import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('api/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  inbox(@Session() session: UserSession) {
    return this.messagesService.inbox(session.user.id);
  }

  @Post()
  send(@Body() dto: SendMessageDto, @Session() session: UserSession) {
    return this.messagesService.send(session.user.id, dto);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Session() session: UserSession) {
    return this.messagesService.markRead(id, session.user.id);
  }
}
