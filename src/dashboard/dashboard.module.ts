import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { LeadsModule } from '../leads/leads.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PropertiesModule, LeadsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
