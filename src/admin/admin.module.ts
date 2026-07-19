import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminPropertyInsightsService } from './admin-property-insights.service';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminUsersService, AdminPropertyInsightsService],
})
export class AdminModule {}
