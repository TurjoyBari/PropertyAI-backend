import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Visit, VisitSchema } from './schemas/visit.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visit.name, schema: VisitSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    NotificationsModule,
  ],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [MongooseModule, VisitsService],
})
export class VisitsModule {}
