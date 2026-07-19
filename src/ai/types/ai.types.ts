import { PropertyType } from '../../common/enums';

/** Structured search intent extracted from natural language (or form fields). */
export type PropertySearchCriteria = {
  location?: string;
  city?: string;
  area?: string;
  budgetMin?: number;
  budgetMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: PropertyType;
  purpose?: 'sale' | 'rent';
  nearMetro?: boolean;
  /** Minimum parking spots */
  parking?: number;
  furnished?: boolean;
  minAreaSqFt?: number;
  maxAreaSqFt?: number;
  amenities?: string[];
  notes?: string;
};

export type AiCallMode = 'live' | 'fallback' | 'cache' | 'empty';

export const AI_FALLBACK_MESSAGE =
  'AI is temporarily unavailable. Showing standard search results.';

export const NO_MATCH_MESSAGE =
  'No properties found matching your criteria.';

export const NO_MATCH_SUGGESTIONS = [
  'Increase your budget',
  'Change location',
  'Remove bedroom filter',
  'Try a different property type',
];

export type AiGenerateOptions = {
  /** Skip cache read/write */
  bypassCache?: boolean;
  /** Cache TTL override in ms */
  cacheTtlMs?: number;
  /** Request timeout override in ms */
  timeoutMs?: number;
};
