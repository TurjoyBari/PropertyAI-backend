import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { LeadTemperature, PropertyType } from '../common/enums';
import { GeminiService } from './gemini.service';
import { PromptService } from './prompt.service';
import { PropertySearchService } from './property-search.service';
import { ChatIntent, ChatIntentService } from './chat-intent.service';
import {
  ChatAgentDto,
  GenerateDescriptionDto,
  MatchPropertiesDto,
  ScoreLeadDto,
} from './dto/ai.dto';
import {
  AI_FALLBACK_MESSAGE,
  NO_MATCH_MESSAGE,
  NO_MATCH_SUGGESTIONS,
  type AiCallMode,
  type PropertySearchCriteria,
} from './types/ai.types';

type ExtractedCriteriaJson = {
  location?: string | null;
  city?: string | null;
  area?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
  purpose?: 'sale' | 'rent' | null;
  nearMetro?: boolean | null;
  amenities?: string[] | null;
  notes?: string | null;
};

type ChatIntentJson = {
  intent?: string;
  criteria?: ExtractedCriteriaJson;
  clarifyingQuestion?: string | null;
};

const DEFAULT_QUICK_REPLIES = [
  '🏠 Find Property',
  '📅 Book Visit',
  '❤️ Favorites',
  '📞 Contact Agent',
];

const GREETING_REPLY = `Hello 👋
Welcome to PropertyAI.

I can help you:
🏠 Find properties
📍 Search by location
💰 Search by budget
📅 Book site visits
📄 Show property details
🤖 Recommend properties

How can I help you today?`;

type LeadSummaryJson = {
  customerInterest?: string;
  budget?: string;
  preferredLocation?: string;
  conversationSummary?: string;
  recommendedNextAction?: string;
  score?: number;
  temperature?: 'hot' | 'warm' | 'cold';
  conversionProbability?: number;
  factors?: string[];
};

type DescriptionJson = {
  description?: string;
  seoDescription?: string;
  marketingCaption?: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly prompts: PromptService,
    private readonly propertySearch: PropertySearchService,
    private readonly chatIntent: ChatIntentService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
  ) {}

  status() {
    return {
      configured: this.gemini.isConfigured(),
      provider: 'gemini',
      model: this.gemini.getModelName(),
      features: [
        'property-finder',
        'description-generator',
        'lead-summary',
        'chat-assistant',
        'lead-scoring',
      ],
      philosophy:
        'AI extracts intent and writes copy only. MongoDB owns listings, search, and inventory.',
    };
  }

  /**
   * AI Property Finder:
   * 1) Optional NL → structured criteria (Gemini)
   * 2) Always search MongoDB
   * 3) Never invent property data
   */
  async matchProperties(dto: MatchPropertiesDto) {
    const { criteria, extractionMode, notice } =
      await this.resolveSearchCriteria(dto);

    const pool = await this.propertySearch.search(criteria, {
      limit: 20,
      soften: false,
    });

    if (pool.length === 0) {
      return {
        criteria,
        matches: [],
        alternatives: [],
        summary: `${NO_MATCH_MESSAGE} Suggestions: ${NO_MATCH_SUGGESTIONS.join('; ')}.`,
        mode: 'empty' as AiCallMode,
        notice: notice || undefined,
        suggestions: NO_MATCH_SUGGESTIONS,
        aiUsed: extractionMode === 'live' || extractionMode === 'cache',
      };
    }

    const ranked = pool
      .map((property) => {
        const ranking = this.propertySearch.scoreAgainstCriteria(
          property,
          criteria,
        );
        return this.propertySearch.hydrate(property, ranking);
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    const matches = ranked.slice(0, 5);
    const alternatives = ranked.slice(5, 8);

    const mode: AiCallMode =
      extractionMode === 'fallback'
        ? 'fallback'
        : extractionMode === 'cache'
          ? 'cache'
          : dto.query?.trim()
            ? extractionMode
            : 'live';

    return {
      criteria,
      matches,
      alternatives,
      summary:
        notice ||
        `Found ${matches.length} matching listing${matches.length === 1 ? '' : 's'} from the database.`,
      mode: notice ? ('fallback' as AiCallMode) : mode,
      notice: notice || undefined,
      aiUsed: Boolean(dto.query?.trim()) && !notice,
    };
  }

  async generateDescription(dto: GenerateDescriptionDto) {
    const input = {
      title: dto.title,
      features: dto.features,
      area: dto.area,
      location: dto.location,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      price: dto.price,
      currency: dto.currency || 'BDT',
      amenities: dto.amenities,
    };

    if (!this.gemini.isConfigured()) {
      return {
        ...this.fallbackDescription(input),
        mode: 'fallback' as AiCallMode,
        notice: AI_FALLBACK_MESSAGE,
      };
    }

    try {
      const prompt = this.prompts.generatePropertyDescriptions(input);
      const { data, fromCache } = await this.gemini.generateJson<DescriptionJson>(
        prompt.system,
        prompt.user,
      );
      return {
        description: data.description?.trim() || this.fallbackDescription(input).description,
        seoDescription:
          data.seoDescription?.trim() ||
          this.fallbackDescription(input).seoDescription,
        marketingCaption:
          data.marketingCaption?.trim() ||
          this.fallbackDescription(input).marketingCaption,
        mode: (fromCache ? 'cache' : 'live') as AiCallMode,
      };
    } catch (error) {
      this.logger.warn(
        `Description generation fell back: ${error instanceof Error ? error.message : 'error'}`,
      );
      return {
        ...this.fallbackDescription(input),
        mode: 'fallback' as AiCallMode,
        notice: AI_FALLBACK_MESSAGE,
      };
    }
  }

  /** Lead summary (preferred). Also updates score/temperature when AI succeeds. */
  async summarizeLead(dto: ScoreLeadDto) {
    const lead = await this.loadLead(dto.leadId);
    const visitCount = await this.visitModel.countDocuments({
      lead: lead._id,
      isActive: true,
    });

    const payload = {
      fullName: lead.fullName,
      status: lead.status,
      source: lead.source,
      temperature: lead.temperature,
      currentScore: lead.score,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      preferredLocation: lead.preferredLocation,
      buyingTimeline: lead.buyingTimeline,
      notes: (lead.notes ?? []).slice(-5).map((n) => n.body),
      visitCount,
      interestedProperties: lead.interestedProperties?.length ?? 0,
      email: lead.email,
      phone: lead.phone,
    };

    if (!this.gemini.isConfigured()) {
      return this.fallbackLeadSummary(lead, visitCount);
    }

    try {
      const prompt = this.prompts.summarizeLead(payload);
      const { data, fromCache } = await this.gemini.generateJson<LeadSummaryJson>(
        prompt.system,
        prompt.user,
      );
      const score = clamp(
        Math.round(Number(data.score) || lead.score || 0),
        0,
        100,
      );
      const temperature = this.toTemperature(data.temperature, score);
      lead.score = score;
      lead.temperature = temperature;
      await lead.save();

      return {
        leadId: String(lead._id),
        customerInterest:
          data.customerInterest ||
          `${lead.fullName} is in stage ${lead.status}`,
        budget: data.budget || formatBudget(lead.budgetMin, lead.budgetMax),
        preferredLocation:
          data.preferredLocation || lead.preferredLocation || 'Not specified',
        conversationSummary:
          data.conversationSummary ||
          (lead.notes?.length
            ? lead.notes.slice(-2).map((n) => n.body).join(' · ')
            : 'No conversation notes yet.'),
        recommendedNextAction:
          data.recommendedNextAction || 'Follow up with a call and offer a site visit.',
        score,
        temperature,
        conversionProbability: clamp(
          Math.round(Number(data.conversionProbability) || score),
          0,
          100,
        ),
        factors: data.factors ?? [],
        // Back-compat with previous scoreLead response shape
        rationale: data.conversationSummary || data.customerInterest || '',
        mode: (fromCache ? 'cache' : 'live') as AiCallMode,
        lead: lead.toObject(),
      };
    } catch (error) {
      this.logger.warn(
        `Lead summary fell back: ${error instanceof Error ? error.message : 'error'}`,
      );
      return this.fallbackLeadSummary(lead, visitCount);
    }
  }

  /** Backward-compatible alias used by public inquiry + existing clients. */
  async scoreLead(dto: ScoreLeadDto) {
    const summary = await this.summarizeLead(dto);
    return {
      leadId: summary.leadId,
      score: summary.score,
      temperature: summary.temperature,
      conversionProbability: summary.conversionProbability,
      recommendedNextAction: summary.recommendedNextAction,
      rationale: summary.rationale || summary.conversationSummary,
      factors: summary.factors,
      lead: summary.lead,
      mode: summary.mode,
      notice: 'notice' in summary ? summary.notice : undefined,
      customerInterest: summary.customerInterest,
      budget: summary.budget,
      preferredLocation: summary.preferredLocation,
      conversationSummary: summary.conversationSummary,
    };
  }

  /**
   * Chat assistant with intent detection + conversation memory.
   * Only searches MongoDB when the intent actually needs listings.
   */
  async chatAgent(dto: ChatAgentDto) {
    const lastShown = (dto.lastShownPropertyIds || []).filter(Boolean);
    const detected = this.chatIntent.detectIntent(dto.message, {
      hasShownProperties: lastShown.length > 0,
    });

    let notice: string | undefined;

    switch (detected.intent) {
      case ChatIntent.GREETING:
        return this.chatTextResponse({
          intent: detected.intent,
          reply: GREETING_REPLY,
          quickReplies: DEFAULT_QUICK_REPLIES,
          lastShownPropertyIds: lastShown,
        });

      case ChatIntent.GENERAL:
        return this.chatTextResponse({
          intent: detected.intent,
          reply:
            "You're welcome! Tell me a location and budget, or pick a quick action below.",
          quickReplies: DEFAULT_QUICK_REPLIES,
          lastShownPropertyIds: lastShown,
        });

      case ChatIntent.HELP:
      case ChatIntent.FAQ:
        return this.chatTextResponse({
          intent: detected.intent,
          reply: this.faqReply(detected.searchText),
          quickReplies: DEFAULT_QUICK_REPLIES,
          lastShownPropertyIds: lastShown,
        });

      case ChatIntent.FAVORITES:
        return this.chatTextResponse({
          intent: detected.intent,
          reply:
            'Open your saved homes from Favorites in the customer dashboard.\n\nPath: Customer → Favorites',
          favoritesUrl: '/customer/favorites',
          quickReplies: ['🏠 Find Property', '📅 Book Visit'],
          lastShownPropertyIds: lastShown,
        });

      case ChatIntent.SELECT:
        return this.handleSelectProperty(
          detected.selectionIndex,
          lastShown,
          'select',
        );

      case ChatIntent.DETAILS:
        if (detected.selectionIndex && lastShown.length) {
          return this.handleSelectProperty(
            detected.selectionIndex,
            lastShown,
            'details',
          );
        }
        return this.handlePropertyDetails(detected.detailQuery || dto.message);

      case ChatIntent.COMPARE:
      case ChatIntent.PRICE:
        return this.handleCompare(lastShown, detected.compareKind || 'cheapest');

      case ChatIntent.LOCATION:
        return this.handleContextListingQuestion(lastShown, 'location');

      case ChatIntent.AGENT:
        if (detected.selectionIndex && lastShown.length) {
          return this.handleSelectProperty(
            detected.selectionIndex,
            lastShown,
            'agent',
          );
        }
        return this.handlePropertyDetails(
          detected.detailQuery || undefined,
          lastShown[0],
        );

      case ChatIntent.BOOK_VISIT:
        return this.handleBookVisit(dto, detected.selectionIndex, lastShown);

      case ChatIntent.SEARCH:
      case ChatIntent.RECOMMEND:
        return this.handleSearchChat(dto, detected.searchText || dto.message);

      case ChatIntent.UNKNOWN:
      default:
        return this.chatTextResponse({
          intent: ChatIntent.UNKNOWN,
          reply:
            "I didn't catch a clear request. Try one of these:\n• \"Flat in Uttara under 80 lakh\"\n• \"Tell me about test\"\n• \"Book visit for 1\"\n\nOr tap a suggestion below.",
          quickReplies: DEFAULT_QUICK_REPLIES,
          lastShownPropertyIds: lastShown,
          notice,
        });
    }
  }

  private async handleSearchChat(dto: ChatAgentDto, searchText: string) {
    const heuristic = this.propertySearch.heuristicExtract(searchText);
    let criteria: PropertySearchCriteria = heuristic;
    let notice: string | undefined;

    if (this.gemini.isConfigured()) {
      try {
        const prompt = this.prompts.extractPropertyCriteria(searchText);
        const { data } = await this.gemini.generateJson<ExtractedCriteriaJson>(
          prompt.system,
          prompt.user,
        );
        // Heuristic budget/location/type win over AI so "under 500000" cannot be dropped.
        criteria = this.propertySearch.mergeCriteria(
          heuristic,
          this.normalizeCriteria(data),
        );
      } catch {
        notice = AI_FALLBACK_MESSAGE;
        criteria = heuristic;
      }
    } else {
      notice = AI_FALLBACK_MESSAGE;
      criteria = heuristic;
    }

    const pool = await this.propertySearch.search(criteria, {
      limit: 5,
      soften: false,
    });

    if (!pool.length) {
      return this.chatTextResponse({
        intent: ChatIntent.SEARCH,
        reply: `${NO_MATCH_MESSAGE}

Suggestions:
• ${NO_MATCH_SUGGESTIONS.join('\n• ')}

Applied filters: ${formatCriteria(criteria)}`,
        criteria,
        quickReplies: DEFAULT_QUICK_REPLIES,
        notice,
        lastShownPropertyIds: [],
      });
    }

    const matches = pool.map((property, index) => {
      const ranking = this.propertySearch.scoreAgainstCriteria(
        property,
        criteria,
      );
      return {
        ...this.propertySearch.hydrate(property, ranking),
        listIndex: index + 1,
      };
    });

    const lines = matches
      .map((m) => {
        const loc = m.property.location as
          | { area?: string; city?: string }
          | undefined;
        return `${m.listIndex}. ${m.property.title} — BDT ${m.property.price.toLocaleString('en-BD')} · ${m.property.bedrooms} bed · ${loc?.area || loc?.city || 'BD'}`;
      })
      .join('\n');

    return {
      reply: `${notice ? `${notice}\n\n` : ''}Here are matching listings from our database:\n\n${lines}\n\nReply with a number (e.g. 1) for full details, or say "book visit for 1".`,
      intent: ChatIntent.SEARCH,
      propertyId: dto.propertyId ?? null,
      criteria,
      matches,
      lastShownPropertyIds: matches.map((m) => m.propertyId),
      quickReplies: ['1', 'Which is cheapest?', '📅 Book Visit', '🏠 New search'],
      mode: notice ? ('fallback' as const) : ('text-agent' as const),
      notice,
    };
  }

  private async handleSelectProperty(
    index: number | undefined,
    lastShown: string[],
    kind: 'select' | 'details' | 'agent',
  ) {
    if (!index || index < 1 || index > lastShown.length) {
      return this.chatTextResponse({
        intent: ChatIntent.SELECT,
        reply: lastShown.length
          ? `Please pick a number between 1 and ${lastShown.length}.`
          : 'No previous property list found. Search first, then reply with 1, 2, or 3.',
        lastShownPropertyIds: lastShown,
        quickReplies: DEFAULT_QUICK_REPLIES,
      });
    }
    return this.handlePropertyDetails(undefined, lastShown[index - 1], kind);
  }

  private async handlePropertyDetails(
    query?: string,
    propertyId?: string,
    kind: 'select' | 'details' | 'agent' = 'details',
  ) {
    let property =
      propertyId && Types.ObjectId.isValid(propertyId)
        ? (await this.propertySearch.findByIds([propertyId]))[0]
        : undefined;

    if (!property && query) {
      // Strip selection-like noise: "Property 1", "1"
      const cleaned = query
        .replace(/^(property|option|no\.?)\s*[1-9]\s*/i, '')
        .trim();
      if (cleaned && !/^[1-9]$/.test(cleaned)) {
        property = (await this.propertySearch.findByTitleOrText(cleaned, 1))[0];
      }
    }

    if (!property) {
      return this.chatTextResponse({
        intent: ChatIntent.DETAILS,
        reply: query
          ? `I couldn't find a listing matching "${query}". Try the exact title, or search by area first.`
          : 'Tell me the property name, or search first and then reply with 1 / 2 / 3.',
        quickReplies: DEFAULT_QUICK_REPLIES,
      });
    }

    const agentName = await this.resolveAgentName(
      property.listedBy ? String(property.listedBy) : undefined,
    );
    const detail = this.toPropertyDetail(property, agentName);
    const match = this.propertySearch.hydrate(property, {
      matchScore: 100,
      reason: 'Requested property details',
      highlights: [],
    });

    const reply =
      kind === 'agent'
        ? `Listing agent for "${detail.title}": ${detail.agentName}.\nAvailability: ${detail.availability}.\n\nYou can book a visit if you'd like.`
        : this.formatPropertyDetailReply(detail);

    return {
      reply,
      intent: ChatIntent.DETAILS,
      propertyId: detail.id,
      propertyDetail: detail,
      matches: [match],
      lastShownPropertyIds: [detail.id],
      bookVisitUrl: `/customer/visits/new?property=${detail.id}`,
      quickReplies: [
        '📅 Book Visit',
        'Which is cheapest?',
        '🏠 Find Property',
        '❤️ Favorites',
      ],
      mode: 'text-agent' as const,
    };
  }

  private async handleCompare(
    lastShown: string[],
    kind: 'cheapest' | 'expensive' | 'general',
  ) {
    if (!lastShown.length) {
      return this.chatTextResponse({
        intent: ChatIntent.COMPARE,
        reply:
          'I need a previous result list to compare. Search first (e.g. "apartments in Uttara"), then ask "which is cheapest?".',
        quickReplies: DEFAULT_QUICK_REPLIES,
      });
    }

    const items = await this.propertySearch.findByIds(lastShown);
    if (!items.length) {
      return this.chatTextResponse({
        intent: ChatIntent.COMPARE,
        reply: 'Those previous listings are no longer available. Please search again.',
        lastShownPropertyIds: [],
        quickReplies: DEFAULT_QUICK_REPLIES,
      });
    }

    const sorted = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
    const pick =
      kind === 'expensive' ? sorted[sorted.length - 1] : sorted[0];
    const index = lastShown.indexOf(String(pick._id)) + 1;
    const agentName = await this.resolveAgentName(
      pick.listedBy ? String(pick.listedBy) : undefined,
    );
    const detail = this.toPropertyDetail(pick, agentName);
    const match = this.propertySearch.hydrate(pick, {
      matchScore: 100,
      reason: kind === 'expensive' ? 'Highest price in current list' : 'Lowest price in current list',
    });

    const table = sorted
      .map((p) => {
        const i = lastShown.indexOf(String(p._id)) + 1;
        return `${i}. ${p.title} — BDT ${Number(p.price || 0).toLocaleString('en-BD')}`;
      })
      .join('\n');

    return {
      reply: `Comparing the properties I just showed you:\n\n${table}\n\n${
        kind === 'expensive' ? 'Most expensive' : 'Cheapest'
      } is #${index}: ${pick.title} (BDT ${Number(pick.price || 0).toLocaleString('en-BD')}).\n\n${this.formatPropertyDetailReply(detail)}`,
      intent: ChatIntent.COMPARE,
      propertyId: detail.id,
      propertyDetail: detail,
      matches: [match],
      lastShownPropertyIds: lastShown,
      bookVisitUrl: `/customer/visits/new?property=${detail.id}`,
      quickReplies: ['📅 Book Visit', '1', '🏠 New search'],
      mode: 'text-agent' as const,
    };
  }

  private async handleContextListingQuestion(
    lastShown: string[],
    kind: 'location',
  ) {
    if (!lastShown.length) {
      return this.chatTextResponse({
        intent: ChatIntent.LOCATION,
        reply: 'Search for properties first, then I can tell you their locations.',
        quickReplies: DEFAULT_QUICK_REPLIES,
      });
    }
    const items = await this.propertySearch.findByIds(lastShown);
    const lines = items
      .map((p, i) => {
        const idx = lastShown.indexOf(String(p._id)) + 1 || i + 1;
        const loc = [p.location?.area, p.location?.city, p.location?.address]
          .filter(Boolean)
          .join(', ');
        return `${idx}. ${p.title} — ${loc || 'Location not set'}`;
      })
      .join('\n');
    return this.chatTextResponse({
      intent: ChatIntent.LOCATION,
      reply: `Locations for the current results:\n\n${lines}`,
      lastShownPropertyIds: lastShown,
      quickReplies: ['Which is cheapest?', '📅 Book Visit'],
    });
  }

  private async handleBookVisit(
    dto: ChatAgentDto,
    selectionIndex: number | undefined,
    lastShown: string[],
  ) {
    let targetId = dto.propertyId;
    if (selectionIndex && lastShown[selectionIndex - 1]) {
      targetId = lastShown[selectionIndex - 1];
    } else if (!targetId && lastShown.length === 1) {
      targetId = lastShown[0];
    } else if (!targetId && /property\s*1\b/i.test(dto.message) && lastShown[0]) {
      targetId = lastShown[0];
    }

    if (!targetId) {
      return this.chatTextResponse({
        intent: ChatIntent.BOOK_VISIT,
        reply:
          lastShown.length > 0
            ? `Which listing should I book?\nReply with a number (1–${lastShown.length}), e.g. "book visit for 1".`
            : 'First find a property, then say "book visit for 1" — or open Book Visit from the menu.',
        lastShownPropertyIds: lastShown,
        quickReplies: lastShown.length
          ? lastShown.slice(0, 3).map((_, i) => `Book visit for ${i + 1}`)
          : DEFAULT_QUICK_REPLIES,
      });
    }

    const property = (await this.propertySearch.findByIds([targetId]))[0];
    const title = property?.title || 'this property';
    const url = `/customer/visits/new?property=${targetId}`;

    return {
      reply: `Great — I can start a site visit for "${title}".\n\nTap Book Visit below to continue the booking flow.`,
      intent: ChatIntent.BOOK_VISIT,
      propertyId: targetId,
      bookVisitUrl: url,
      bookVisitLabel: 'Book Visit',
      matches: property
        ? [
            this.propertySearch.hydrate(property, {
              matchScore: 100,
              reason: 'Selected for visit booking',
            }),
          ]
        : [],
      lastShownPropertyIds: lastShown.length ? lastShown : [targetId],
      quickReplies: ['🏠 Find Property', '❤️ Favorites'],
      mode: 'text-agent' as const,
    };
  }

  private chatTextResponse(input: {
    intent: ChatIntent | string;
    reply: string;
    quickReplies?: string[];
    lastShownPropertyIds?: string[];
    criteria?: PropertySearchCriteria;
    notice?: string;
    favoritesUrl?: string;
    bookVisitUrl?: string;
  }) {
    return {
      reply: input.reply,
      intent: input.intent,
      propertyId: null,
      matches: [],
      criteria: input.criteria,
      lastShownPropertyIds: input.lastShownPropertyIds || [],
      quickReplies: input.quickReplies || DEFAULT_QUICK_REPLIES,
      favoritesUrl: input.favoritesUrl,
      bookVisitUrl: input.bookVisitUrl,
      mode: input.notice ? ('fallback' as const) : ('text-agent' as const),
      notice: input.notice,
    };
  }

  private faqReply(topic?: string) {
    if (topic === 'booking' || topic?.includes('book')) {
      return `How booking works:
1. Find a property (search or AI Finder)
2. Open it or ask me for details
3. Tap Book Visit / schedule a visit
4. Pick date & time — the agent confirms

You can also go to Customer → Visits → Book visit.`;
    }
    return `PropertyAI help:
• Search homes by area, budget, bedrooms
• Ask "tell me about [title]" for details
• After a list, reply 1 / 2 / 3 to pick one
• Say "book visit for 1" to start booking
• Favorites saves homes you like

Core browsing works even when AI is offline.`;
  }

  private formatPropertyDetailReply(detail: {
    title: string;
    priceLabel: string;
    locationLabel: string;
    bedrooms: number;
    bathrooms: number;
    areaLabel: string;
    description: string;
    features: string;
    agentName: string;
    availability: string;
  }) {
    return `📄 ${detail.title}

💰 Price: ${detail.priceLabel}
📍 Location: ${detail.locationLabel}
🛏️ Bedrooms: ${detail.bedrooms}
🚿 Bathrooms: ${detail.bathrooms}
📐 Area: ${detail.areaLabel}
✅ Availability: ${detail.availability}
👤 Agent: ${detail.agentName}

${detail.description}

Features: ${detail.features}

Reply "book visit" to schedule a viewing.`;
  }

  private toPropertyDetail(
    property: {
      _id: unknown;
      title: string;
      price?: number;
      currency?: string;
      bedrooms?: number;
      bathrooms?: number;
      areaSqFt?: number;
      description?: string;
      amenities?: string[];
      status?: string;
      images?: string[];
      location?: {
        address?: string;
        area?: string;
        city?: string;
      };
    },
    agentName: string,
  ) {
    const currency = property.currency || 'BDT';
    return {
      id: String(property._id),
      title: property.title,
      price: property.price ?? 0,
      currency,
      priceLabel: `${currency} ${Number(property.price || 0).toLocaleString('en-BD')}`,
      locationLabel: [
        property.location?.address,
        property.location?.area,
        property.location?.city,
      ]
        .filter(Boolean)
        .join(', ') || '—',
      bedrooms: property.bedrooms ?? 0,
      bathrooms: property.bathrooms ?? 0,
      areaSqFt: property.areaSqFt,
      areaLabel: property.areaSqFt ? `${property.areaSqFt} sqft` : '—',
      description: (property.description || 'No description provided.').slice(
        0,
        600,
      ),
      features:
        property.amenities?.length
          ? property.amenities.join(', ')
          : 'Not listed',
      agentName,
      availability: property.status || 'unknown',
      images: property.images?.slice(0, 5) ?? [],
    };
  }

  private async resolveAgentName(listedBy?: string) {
    if (!listedBy || !Types.ObjectId.isValid(listedBy)) return 'Listing agent';
    try {
      const user = await this.connection.collection('user').findOne({
        _id: new Types.ObjectId(listedBy) as never,
      });
      return (user?.name as string) || 'Listing agent';
    } catch {
      return 'Listing agent';
    }
  }

  private async resolveSearchCriteria(dto: MatchPropertiesDto): Promise<{
    criteria: PropertySearchCriteria;
    extractionMode: AiCallMode;
    notice?: string;
  }> {
    const structured = this.normalizeCriteria({
      location: dto.location,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      propertyType: dto.propertyType,
      nearMetro: dto.nearMetro,
      notes: dto.notes,
      amenities: dto.amenities,
    });

    const query = dto.query?.trim();
    if (!query) {
      return { criteria: structured, extractionMode: 'live' };
    }

    const heuristic = this.propertySearch.heuristicExtract(query);

    if (!this.gemini.isConfigured()) {
      return {
        criteria: this.propertySearch.mergeCriteria(
          { ...heuristic, ...pickDefined(structured) },
          {},
        ),
        extractionMode: 'fallback',
        notice: AI_FALLBACK_MESSAGE,
      };
    }

    try {
      const prompt = this.prompts.extractPropertyCriteria(query);
      const { data, fromCache } =
        await this.gemini.generateJson<ExtractedCriteriaJson>(
          prompt.system,
          prompt.user,
        );
      const extracted = this.normalizeCriteria(data);
      // Always prefer deterministic budget/location from heuristic + form overrides.
      const criteria = this.propertySearch.mergeCriteria(
        { ...heuristic, ...pickDefined(structured) },
        extracted,
      );
      return {
        criteria,
        extractionMode: fromCache ? 'cache' : 'live',
      };
    } catch (error) {
      this.logger.warn(
        `Criteria extract fell back: ${error instanceof Error ? error.message : 'error'}`,
      );
      return {
        criteria: this.propertySearch.mergeCriteria(
          { ...heuristic, ...pickDefined(structured) },
          {},
        ),
        extractionMode: 'fallback',
        notice: AI_FALLBACK_MESSAGE,
      };
    }
  }

  private normalizeCriteria(
    raw: ExtractedCriteriaJson | PropertySearchCriteria,
  ): PropertySearchCriteria {
    const type = String(raw.propertyType || '')
      .toLowerCase()
      .trim();
    const propertyType = Object.values(PropertyType).includes(type as PropertyType)
      ? (type as PropertyType)
      : undefined;

    return {
      location: cleanString(raw.location) || cleanString(raw.area) || cleanString(raw.city),
      city: cleanString(raw.city),
      area: cleanString(raw.area),
      budgetMin: numOrUndef(raw.budgetMin),
      budgetMax: numOrUndef(raw.budgetMax),
      bedrooms: numOrUndef(raw.bedrooms),
      bathrooms: numOrUndef(raw.bathrooms),
      propertyType,
      purpose:
        raw.purpose === 'rent' || raw.purpose === 'sale' ? raw.purpose : undefined,
      nearMetro:
        typeof raw.nearMetro === 'boolean' ? raw.nearMetro : undefined,
      amenities: Array.isArray(raw.amenities)
        ? raw.amenities.filter((a): a is string => typeof a === 'string')
        : undefined,
      notes: cleanString(raw.notes),
    };
  }

  private async loadLead(leadId: string) {
    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundException('Lead not found');
    }
    const lead = await this.leadModel.findOne({ _id: leadId, isActive: true });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private fallbackDescription(input: {
    title: string;
    location: string;
    bedrooms?: number;
    bathrooms?: number;
    price?: number;
    currency?: string;
    area?: string;
    features?: string;
  }) {
    const beds = input.bedrooms != null ? `${input.bedrooms} bedroom` : 'well-designed';
    const baths =
      input.bathrooms != null ? ` with ${input.bathrooms} bathroom(s)` : '';
    const area = input.area ? ` spanning ${input.area}` : '';
    const price =
      input.price != null
        ? ` Listed at ${input.currency || 'BDT'} ${Number(input.price).toLocaleString('en-BD')}.`
        : '';
    const features = input.features ? ` Highlights: ${input.features}.` : '';

    const description = `${input.title} is a ${beds} property${baths} in ${input.location}${area}.${price}${features} Contact PropertyAI to schedule a private viewing.`;
    const seoDescription = `${input.title} in ${input.location}${input.bedrooms ? ` · ${input.bedrooms} beds` : ''}`.slice(
      0,
      155,
    );
    const marketingCaption = `Discover ${input.title} in ${input.location}. Book a visit with PropertyAI today.`;

    return { description, seoDescription, marketingCaption };
  }

  private fallbackLeadSummary(lead: LeadDocument, visitCount: number) {
    const score = clamp(lead.score || (visitCount > 0 ? 55 : 35), 0, 100);
    const temperature = this.toTemperature(lead.temperature, score);
    return {
      leadId: String(lead._id),
      customerInterest: `${lead.fullName} · stage ${lead.status}`,
      budget: formatBudget(lead.budgetMin, lead.budgetMax),
      preferredLocation: lead.preferredLocation || 'Not specified',
      conversationSummary:
        lead.notes?.length
          ? lead.notes.slice(-2).map((n) => n.body).join(' · ')
          : 'No conversation notes yet. Standard CRM summary (AI offline).',
      recommendedNextAction:
        visitCount === 0
          ? 'Call the lead and offer a site visit.'
          : 'Follow up on visit feedback and move toward negotiation.',
      score,
      temperature,
      conversionProbability: score,
      factors: [
        `Visits: ${visitCount}`,
        `Source: ${lead.source || 'unknown'}`,
        `Status: ${lead.status}`,
      ],
      rationale: 'Generated without AI using stored CRM fields.',
      mode: 'fallback' as AiCallMode,
      notice: AI_FALLBACK_MESSAGE,
      lead: lead.toObject(),
    };
  }

  private toTemperature(value: string | undefined, score: number): LeadTemperature {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'hot') return LeadTemperature.HOT;
    if (normalized === 'warm') return LeadTemperature.WARM;
    if (normalized === 'cold') return LeadTemperature.COLD;
    if (score >= 75) return LeadTemperature.HOT;
    if (score >= 45) return LeadTemperature.WARM;
    return LeadTemperature.COLD;
  }
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function numOrUndef(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatBudget(min?: number, max?: number) {
  if (min == null && max == null) return 'Not specified';
  if (min != null && max != null) {
    return `BDT ${min.toLocaleString('en-BD')} – ${max.toLocaleString('en-BD')}`;
  }
  if (max != null) return `Up to BDT ${max.toLocaleString('en-BD')}`;
  return `From BDT ${Number(min).toLocaleString('en-BD')}`;
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

function formatCriteria(criteria: PropertySearchCriteria) {
  const parts: string[] = [];
  if (criteria.propertyType) parts.push(`type=${criteria.propertyType}`);
  if (criteria.location || criteria.area || criteria.city) {
    parts.push(
      `location=${criteria.location || criteria.area || criteria.city}`,
    );
  }
  if (criteria.budgetMin != null) {
    parts.push(`minPrice=${criteria.budgetMin}`);
  }
  if (criteria.budgetMax != null) {
    parts.push(`maxPrice=${criteria.budgetMax}`);
  }
  if (criteria.bedrooms != null) parts.push(`bedrooms>=${criteria.bedrooms}`);
  if (criteria.bathrooms != null) parts.push(`bathrooms>=${criteria.bathrooms}`);
  if (criteria.purpose) parts.push(`purpose=${criteria.purpose}`);
  return parts.length ? parts.join(', ') : 'none';
}
