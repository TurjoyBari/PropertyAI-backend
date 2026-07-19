import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PropertiesService } from '../properties/properties.service';
import { LeadsService } from '../leads/leads.service';
import { AiService } from '../ai/ai.service';
import { QueryPropertiesDto } from '../properties/dto/query-properties.dto';
import { MatchPropertiesDto, ChatAgentDto } from '../ai/dto/ai.dto';
import { CreatePublicInquiryDto } from './dto/create-public-inquiry.dto';
import { LeadSource, LeadStatus, PropertyStatus } from '../common/enums';

@Controller('api/public')
export class PublicController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly leadsService: LeadsService,
    private readonly aiService: AiService,
  ) {}

  @Public()
  @Get('properties')
  listProperties(@Query() query: QueryPropertiesDto) {
    return this.propertiesService.findAll({
      ...query,
      status: query.status ?? PropertyStatus.AVAILABLE,
    });
  }

  @Public()
  @Get('areas')
  listAreas() {
    return this.propertiesService.listAreas();
  }

  @Public()
  @Get('properties/:id')
  getProperty(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Public()
  @Post('match-properties')
  matchProperties(@Body() dto: MatchPropertiesDto) {
    return this.aiService.matchProperties(dto);
  }

  @Public()
  @Post('chat')
  chat(@Body() dto: ChatAgentDto) {
    return this.aiService.chatAgent(dto);
  }

  @Public()
  @Post('inquiries')
  async createInquiry(@Body() dto: CreatePublicInquiryDto) {
    const lead = await this.leadsService.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      status: LeadStatus.NEW_LEAD,
      source: LeadSource.WEBSITE,
      preferredLocation: dto.location,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      buyingTimeline: dto.message,
      interestedProperties: dto.propertyId ? [dto.propertyId] : [],
    });

    const leadId = String(
      (lead as { _id?: unknown; id?: unknown })._id ??
        (lead as { id?: unknown }).id,
    );

    // Fire-and-forget CRM summary — never blocks inquiry create.
    void this.aiService.scoreLead({ leadId }).catch(() => undefined);

    return {
      message: 'Inquiry received. An agent will contact you soon.',
      leadId,
    };
  }

  @Public()
  @Get('faq')
  faq() {
    return {
      items: [
        {
          q: 'How does AI Property Finder work?',
          a: 'Describe what you need in plain language. AI extracts filters only; we always search our MongoDB listings. If AI is offline, standard search still works.',
        },
        {
          q: 'Can I book a site visit online?',
          a: 'Yes. Create a free account, open a property, and schedule a visit from your customer dashboard.',
        },
        {
          q: 'Is PropertyAI free to browse?',
          a: 'Browsing listings and using the property finder is free. Agents manage deals from the staff workspace.',
        },
        {
          q: 'How do I contact an agent?',
          a: 'Use the Contact form or submit an inquiry on a property page. We create a lead automatically.',
        },
      ],
    };
  }
}
