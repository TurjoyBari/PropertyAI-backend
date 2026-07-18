import { LeadStatus, PropertyStatus } from '../common/enums';

/**
 * Pure helpers for report KPI fallbacks — easy to unit test without Mongo.
 */
export function estimateRevenue(params: {
  soldInventoryTotal: number;
  closedLeads: number;
  fallbackPerDeal?: number;
}) {
  if (params.soldInventoryTotal > 0) return params.soldInventoryTotal;
  return params.closedLeads * (params.fallbackPerDeal ?? 250000);
}

export function salesCount(soldProperties: number, closedLeads: number) {
  return Math.max(soldProperties, closedLeads);
}

export function isClosedLeadStatus(status: LeadStatus) {
  return status === LeadStatus.CLOSED;
}

export function isSoldPropertyStatus(status: PropertyStatus) {
  return status === PropertyStatus.SOLD;
}
