import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { LeadsModule } from '../leads/leads.module';
import { AiModule } from '../ai/ai.module';
import { PublicController } from './public.controller';

@Module({
  imports: [PropertiesModule, LeadsModule, AiModule],
  controllers: [PublicController],
})
export class PublicModule {}
