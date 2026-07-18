import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
