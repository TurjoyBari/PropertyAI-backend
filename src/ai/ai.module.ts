import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import { PromptService } from './prompt.service';
import { AiCacheService } from './ai-cache.service';
import { AiQueueService } from './ai-queue.service';
import { PropertySearchService } from './property-search.service';
import { ChatIntentService } from './chat-intent.service';
import { AiChatHistoryService } from './ai-chat-history.service';
import {
  AiChatSession,
  AiChatSessionSchema,
} from './schemas/ai-chat-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: AiChatSession.name, schema: AiChatSessionSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiCacheService,
    AiQueueService,
    PromptService,
    GeminiService,
    PropertySearchService,
    ChatIntentService,
    AiChatHistoryService,
    AiService,
  ],
  exports: [AiService, GeminiService, PropertySearchService],
})
export class AiModule {}
