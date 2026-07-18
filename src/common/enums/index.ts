/**
 * Shared domain enums used across schemas.
 * Keeping them in one place avoids duplicated string literals.
 */
export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  USER = 'user',
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  VILLA = 'villa',
  LAND = 'land',
  COMMERCIAL = 'commercial',
  STUDIO = 'studio',
}

export enum PropertyStatus {
  DRAFT = 'draft',
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  RENTED = 'rented',
}

/** Sales pipeline stages (Kanban) */
export enum LeadStatus {
  NEW_LEAD = 'new_lead',
  CONTACTED = 'contacted',
  INTERESTED = 'interested',
  VISIT_SCHEDULED = 'visit_scheduled',
  NEGOTIATION = 'negotiation',
  CLOSED = 'closed',
}

export enum LeadTemperature {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
}

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  WHATSAPP = 'whatsapp',
  FACEBOOK = 'facebook',
  GOOGLE = 'google',
  WALK_IN = 'walk_in',
  OTHER = 'other',
}
