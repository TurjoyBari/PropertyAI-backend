import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { PropertySearchCriteria } from './types/ai.types';

@Injectable()
export class PromptService {
  extractPropertyCriteria(userQuery: string): { system: string; user: string } {
    return {
      system: `You are a real-estate search intent parser for Bangladesh (PropertyAI).
Extract structured filters ONLY from the user's request.
Do NOT invent listings. Do NOT recommend properties. Do NOT invent prices.
Return ONLY valid JSON with this schema:
{
  "location": string | null,
  "city": string | null,
  "area": string | null,
  "budgetMin": number | null,
  "budgetMax": number | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "propertyType": "apartment"|"house"|"villa"|"land"|"commercial"|"studio"|null,
  "purpose": "sale"|"rent"|null,
  "nearMetro": boolean | null,
  "amenities": string[] | null,
  "notes": string | null
}
Rules:
- Convert lakh/crore to BDT numbers (1 lakh = 100000, 1 crore = 10000000).
- "under 500000" / "below 500000" / "less than 500000" → budgetMax = 500000.
- "under 80 lakh" → budgetMax = 8000000.
- "above 2 crore" → budgetMin = 20000000.
- "between 50 lakh and 80 lakh" → budgetMin = 5000000, budgetMax = 8000000.
- Prefer location/area like Uttara, Banani, Dhanmondi when mentioned.
- propertyType must use lowercase enum values or null.
- Never invent a higher budget than the user stated.`,
      user: `User request:\n"""${userQuery.trim()}"""`,
    };
  }

  generatePropertyDescriptions(input: Record<string, unknown>): {
    system: string;
    user: string;
  } {
    return {
      system: `You write marketing copy for Bangladesh real-estate listings (PropertyAI).
Return ONLY valid JSON:
{
  "description": "full property description (2-4 short paragraphs)",
  "seoDescription": "SEO meta description under 160 characters",
  "marketingCaption": "short social/ad caption under 220 characters"
}
Use only the facts provided. Do not invent amenities or legal claims.`,
      user: `Listing inputs:\n${JSON.stringify(input, null, 2)}`,
    };
  }

  summarizeLead(payload: Record<string, unknown>): {
    system: string;
    user: string;
  } {
    return {
      system: `You are a CRM assistant for a real-estate sales team.
Summarize the lead using only provided facts.
Return ONLY valid JSON:
{
  "customerInterest": string,
  "budget": string,
  "preferredLocation": string,
  "conversationSummary": string,
  "recommendedNextAction": string,
  "score": number,
  "temperature": "hot"|"warm"|"cold",
  "conversionProbability": number,
  "factors": string[]
}`,
      user: `Lead data:\n${JSON.stringify(payload, null, 2)}`,
    };
  }

  extractChatIntent(message: string, history?: string): {
    system: string;
    user: string;
  } {
    return {
      system: `You parse customer chat into property search intent for PropertyAI (Bangladesh).
Return ONLY valid JSON:
{
  "intent": "search_properties"|"ask_question"|"book_visit"|"other",
  "criteria": {
    "location": string | null,
    "budgetMax": number | null,
    "budgetMin": number | null,
    "bedrooms": number | null,
    "propertyType": "apartment"|"house"|"villa"|"land"|"commercial"|"studio"|null,
    "purpose": "sale"|"rent"|null,
    "nearMetro": boolean | null,
    "notes": string | null
  },
  "clarifyingQuestion": string | null
}
Do not invent property inventory.`,
      user: `Conversation:\n${history || '(new)'}\n\nLatest user message:\n"""${message.trim()}"""`,
    };
  }

  composeChatReply(
    message: string,
    listings: Array<Record<string, unknown>>,
    criteria: PropertySearchCriteria,
    aiAvailable: boolean,
  ): { system: string; user: string } {
    return {
      system: `You are PropertyAI assistant. Answer briefly using ONLY the provided listings.
Never invent IDs, prices, addresses, or availability.
If listings are empty, ask one clarifying question.
Suggest booking a visit when relevant.
${aiAvailable ? '' : 'Note: ranking AI is offline; listings are from standard DB search.'}`,
      user: `User message: ${message}\nCriteria: ${JSON.stringify(criteria)}\nListings:\n${JSON.stringify(listings, null, 2)}\nWrite a helpful reply.`,
    };
  }

  cacheKey(namespace: string, parts: unknown): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(parts))
      .digest('hex')
      .slice(0, 32);
    return `${namespace}:${hash}`;
  }
}
