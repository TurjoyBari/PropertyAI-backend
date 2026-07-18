import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { AiService } from './ai.service';
import { ChatAgentDto, MatchPropertiesDto, ScoreLeadDto } from './dto/ai.dto';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  @Post('match-properties')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  matchProperties(@Body() dto: MatchPropertiesDto) {
    return this.aiService.matchProperties(dto);
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
}
