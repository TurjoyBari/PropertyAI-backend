import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { AiService } from './ai.service';
import { AiChatHistoryService } from './ai-chat-history.service';
import {
  ChatAgentDto,
  GenerateDescriptionDto,
  MatchPropertiesDto,
  SaveChatHistoryDto,
  ScoreLeadDto,
} from './dto/ai.dto';

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly chatHistory: AiChatHistoryService,
  ) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  @Post('match-properties')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  matchProperties(@Body() dto: MatchPropertiesDto) {
    return this.aiService.matchProperties(dto);
  }

  @Post('generate-description')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  generateDescription(@Body() dto: GenerateDescriptionDto) {
    return this.aiService.generateDescription(dto);
  }

  @Post('summarize-lead')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  summarizeLead(@Body() dto: ScoreLeadDto) {
    return this.aiService.summarizeLead(dto);
  }

  @Post('score-lead')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  scoreLead(@Body() dto: ScoreLeadDto) {
    return this.aiService.scoreLead(dto);
  }

  @Post('chat')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  chat(@Body() dto: ChatAgentDto) {
    return this.aiService.chatAgent(dto);
  }

  @Get('chat-history')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  getChatHistory(@Session() session: UserSession) {
    return this.chatHistory.getForUser(session.user.id);
  }

  @Put('chat-history')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  saveChatHistory(
    @Session() session: UserSession,
    @Body() dto: SaveChatHistoryDto,
  ) {
    return this.chatHistory.saveForUser(session.user.id, dto);
  }

  @Delete('chat-history')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  clearChatHistory(@Session() session: UserSession) {
    return this.chatHistory.clearForUser(session.user.id);
  }
}
