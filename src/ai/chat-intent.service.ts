import { Injectable } from '@nestjs/common';

export enum ChatIntent {
  GREETING = 'greeting',
  GENERAL = 'general',
  SEARCH = 'search',
  DETAILS = 'details',
  SELECT = 'select',
  COMPARE = 'compare',
  BOOK_VISIT = 'book_visit',
  FAVORITES = 'favorites',
  RECOMMEND = 'recommend',
  PRICE = 'price',
  LOCATION = 'location',
  AGENT = 'agent',
  FAQ = 'faq',
  HELP = 'help',
  UNKNOWN = 'unknown',
}

export type IntentResult = {
  intent: ChatIntent;
  /** 1-based index when user picks from a previous list */
  selectionIndex?: number;
  /** Free-text property name/title fragment for DETAILS */
  detailQuery?: string;
  /** Remaining text useful for search extract */
  searchText?: string;
  compareKind?: 'cheapest' | 'expensive' | 'general';
};

@Injectable()
export class ChatIntentService {
  detectIntent(
    message: string,
    options?: { hasShownProperties?: boolean },
  ): IntentResult {
    const raw = message.trim();
    const text = raw.toLowerCase().replace(/\s+/g, ' ');
    const hasShown = Boolean(options?.hasShownProperties);

    // Numeric selection against previous results: "1", "2.", "#3"
    const selectMatch = text.match(/^(?:option\s*|no\.?\s*|number\s*|#)?\s*([1-9])\s*[.)]?$/i);
    if (selectMatch && hasShown) {
      return {
        intent: ChatIntent.SELECT,
        selectionIndex: Number(selectMatch[1]),
      };
    }

    if (this.isGreeting(text)) {
      return { intent: ChatIntent.GREETING };
    }

    if (
      /\b(book|schedule|visit|site visit|tour|দেখা)\b/.test(text) &&
      /\b(book|schedule|visit|tour|property|for)\b/.test(text)
    ) {
      return {
        intent: ChatIntent.BOOK_VISIT,
        selectionIndex: this.extractIndex(text),
        detailQuery: this.extractDetailQuery(raw) || undefined,
      };
    }

    if (
      /\b(favorite|favourites|favorites|saved|wishlist|বুকমার্ক)\b/.test(text)
    ) {
      return { intent: ChatIntent.FAVORITES };
    }

    if (
      /\b(how (does|do|to)|what is|faq|help|booking work|how booking)\b/.test(
        text,
      ) ||
      text === 'help' ||
      text === '?'
    ) {
      if (/\b(book|visit|tour)\b/.test(text)) {
        return { intent: ChatIntent.FAQ, searchText: 'booking' };
      }
      return { intent: ChatIntent.HELP };
    }

    if (
      /\b(cheapest|lowest price|most expensive|highest price|compare|which (one|is)|সবচেয়ে সস্তা)\b/.test(
        text,
      )
    ) {
      let compareKind: IntentResult['compareKind'] = 'general';
      if (/cheap|lowest|সস্তা/.test(text)) compareKind = 'cheapest';
      if (/expensive|highest|দামি/.test(text)) compareKind = 'expensive';
      return { intent: ChatIntent.COMPARE, compareKind };
    }

    const detailQuery = this.extractDetailQuery(raw);
    if (
      detailQuery ||
      /\b(details?|tell me about|show (me )?details|info(rmation)? about|যে সম্পত্তি|বিস্তারিত)\b/.test(
        text,
      )
    ) {
      return {
        intent: ChatIntent.DETAILS,
        detailQuery: detailQuery || this.stripDetailPrefix(raw) || undefined,
        selectionIndex: this.extractIndex(text),
      };
    }

    if (
      /\b(recommend|suggestion|suggest|best (for|option)|সাজেস্ট|সুপারিশ)\b/.test(
        text,
      )
    ) {
      return { intent: ChatIntent.RECOMMEND, searchText: raw };
    }

    if (
      hasShown &&
      /\b(price|budget|cost|কত|দাম|মূল্য)\b/.test(text) &&
      !/\b(under|below|max|upto|lakh|crore)\b/.test(text)
    ) {
      return { intent: ChatIntent.PRICE };
    }

    if (
      hasShown &&
      /\b(where|location|area|address|কোথায়|লোকেশন)\b/.test(text) &&
      !/\b(in |at |near )\w{3,}/.test(text)
    ) {
      return { intent: ChatIntent.LOCATION };
    }

    if (/\b(agent|who (lists|listed)|contact agent|এজেন্ট)\b/.test(text)) {
      return {
        intent: ChatIntent.AGENT,
        selectionIndex: this.extractIndex(text),
        detailQuery: detailQuery || undefined,
      };
    }

    if (this.looksLikeSearch(text)) {
      return { intent: ChatIntent.SEARCH, searchText: raw };
    }

    if (
      /^(ok|okay|thanks|thank you|cool|nice|great|সমস্যা নেই|ধন্যবাদ)$/i.test(
        text,
      )
    ) {
      return { intent: ChatIntent.GENERAL };
    }

    // Short junk like "1" without context, "test" alone → unknown, not dump inventory
    if (text.length <= 2 || /^[0-9]+$/.test(text)) {
      return { intent: ChatIntent.UNKNOWN };
    }

    // Bare property-ish names → treat as details lookup
    if (/^[a-z0-9][\w\s-]{1,40}$/i.test(raw) && !this.isGreeting(text)) {
      return { intent: ChatIntent.DETAILS, detailQuery: raw };
    }

    return { intent: ChatIntent.UNKNOWN, searchText: raw };
  }

  private isGreeting(text: string) {
    return /^(hi|hii+|hello|hey|hey there|good morning|good afternoon|good evening|salam|assalamu alaikum|hello propertyai|hi propertyai|নমস্কার|হ্যালো)$/i.test(
      text,
    ) || /^(hi|hello|hey)\b[!?.]*$/.test(text);
  }

  private looksLikeSearch(text: string) {
    return (
      /\b(find|search|looking for|need|want|show me|apartments?|flats?|villa|house|studio|in \w+|under |below |budget|bedroom|bed|ভাড়া|বাস|ফ্ল্যাট|এপার্টমেন্ট)\b/.test(
        text,
      ) || /\b(uttara|banani|gulshan|dhanmondi|mirpur|bashundhara)\b/.test(text)
    );
  }

  private extractIndex(text: string): number | undefined {
    const m = text.match(
      /\b(?:property|option|no\.?|number|#)?\s*([1-9])\b/,
    );
    return m ? Number(m[1]) : undefined;
  }

  private extractDetailQuery(raw: string): string | null {
    const patterns = [
      /(?:tell me (?:more )?about|details?(?: of| for| about)?|show (?:me )?details?(?: of| for| about)?|info(?:rmation)? (?:on|about)|about)\s+(.+)$/i,
      /(?:বিস্তারিত|সম্পর্কে)\s+(.+)$/i,
    ];
    for (const pattern of patterns) {
      const m = raw.match(pattern);
      if (m?.[1]) {
        const q = m[1].replace(/[?.!]+$/, '').trim();
        if (q && !/^(it|this|that|the property)$/i.test(q)) return q;
      }
    }
    return null;
  }

  private stripDetailPrefix(raw: string) {
    return raw
      .replace(
        /^(tell me (?:more )?about|details?(?: of| for| about)?|show (?:me )?details?(?: of| for| about)?|about)\s+/i,
        '',
      )
      .replace(/[?.!]+$/, '')
      .trim();
  }
}
