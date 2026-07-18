import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [GeminiService, AiService],
  exports: [AiService, GeminiService],
})
export class AiModule {}
