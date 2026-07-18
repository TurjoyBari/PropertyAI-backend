import {
  estimateRevenue,
  isClosedLeadStatus,
  isSoldPropertyStatus,
  salesCount,
} from './reports.helpers';
import { LeadStatus, PropertyStatus } from '../common/enums';

describe('reports.helpers', () => {
  it('prefers sold inventory total for revenue', () => {
    expect(
      estimateRevenue({ soldInventoryTotal: 9_000_000, closedLeads: 2 }),
    ).toBe(9_000_000);
  });

  it('falls back to closed leads * default deal value', () => {
    expect(
      estimateRevenue({ soldInventoryTotal: 0, closedLeads: 3 }),
    ).toBe(750_000);
  });

  it('computes sales as max of sold properties and closed leads', () => {
    expect(salesCount(1, 4)).toBe(4);
    expect(salesCount(5, 2)).toBe(5);
  });

  it('recognizes closed / sold statuses', () => {
    expect(isClosedLeadStatus(LeadStatus.CLOSED)).toBe(true);
    expect(isClosedLeadStatus(LeadStatus.NEW_LEAD)).toBe(false);
    expect(isSoldPropertyStatus(PropertyStatus.SOLD)).toBe(true);
    expect(isSoldPropertyStatus(PropertyStatus.AVAILABLE)).toBe(false);
  });
});
