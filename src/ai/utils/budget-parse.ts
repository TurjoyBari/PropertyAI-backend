/**
 * Parse Bangladesh-friendly budget phrases into BDT amounts.
 * Supports: under/below/less than/max, above/more than/min, between X and Y,
 * lakh/lac, crore/cr, k, m, and plain numbers.
 */

export type ParsedBudget = {
  budgetMin?: number;
  budgetMax?: number;
};

function toAmount(value: number, unit?: string): number {
  const u = (unit || '').toLowerCase().trim();
  if (!Number.isFinite(value)) return NaN;
  if (u === 'lakh' || u === 'lac' || u === 'lacs' || u === 'lakhs') {
    return Math.round(value * 100_000);
  }
  if (u === 'crore' || u === 'cr' || u === 'crores') {
    return Math.round(value * 10_000_000);
  }
  if (u === 'k' || u === 'thousand') {
    return Math.round(value * 1_000);
  }
  if (u === 'm' || u === 'million') {
    return Math.round(value * 1_000_000);
  }
  return Math.round(value);
}

const UNIT = String.raw`(?:\s*(lakh|lac|lacs|lakhs|crore|cr|crores|k|m|million|thousand))?`;
const NUM = String.raw`([\d][\d,]*(?:\.\d+)?)`;

export function parseBudgetFromText(query: string): ParsedBudget {
  const text = query.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const result: ParsedBudget = {};

  // between 50 lakh and 80 lakh / from 50 lakh to 80 lakh
  const between = text.match(
    new RegExp(
      String.raw`(?:between|from)\s+${NUM}${UNIT}\s+(?:and|to|-)\s+${NUM}${UNIT}`,
      'i',
    ),
  );
  if (between) {
    const a = toAmount(Number(between[1]), between[2]);
    const b = toAmount(Number(between[3]), between[4]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      result.budgetMin = Math.min(a, b);
      result.budgetMax = Math.max(a, b);
      return result;
    }
  }

  // under / below / less than / at most / max / maximum / up to / within
  const maxMatch = text.match(
    new RegExp(
      String.raw`(?:under|below|less than|at most|upto|up to|within|max(?:imum)?(?:\s+price)?|budget(?:\s+of)?)\s+${NUM}${UNIT}`,
      'i',
    ),
  );
  if (maxMatch) {
    const amount = toAmount(Number(maxMatch[1]), maxMatch[2]);
    if (Number.isFinite(amount)) result.budgetMax = amount;
  }

  // above / over / more than / at least / min / minimum / starting from
  const minMatch = text.match(
    new RegExp(
      String.raw`(?:above|over|more than|at least|starting from|from|min(?:imum)?(?:\s+price)?)\s+${NUM}${UNIT}`,
      'i',
    ),
  );
  // Avoid treating "from X to Y" already handled; "from 50 lakh" alone ok
  if (minMatch && !between) {
    // Don't steal "under X" — "from" alone for min only if not a max pattern on same span
    const phrase = minMatch[0];
    if (!/under|below|less than|upto|up to|within|max/i.test(phrase)) {
      const amount = toAmount(Number(minMatch[1]), minMatch[2]);
      if (Number.isFinite(amount)) {
        // "from 80 lakh" without "to" → treat as min
        if (/^(?:above|over|more than|at least|min)/i.test(phrase) || /^from\s/i.test(phrase)) {
          result.budgetMin = amount;
        }
      }
    }
  }

  // Bare "80 lakh" / "2 crore" as max if no other budget signal
  if (result.budgetMin == null && result.budgetMax == null) {
    const bare = text.match(
      new RegExp(String.raw`${NUM}\s*(lakh|lac|lacs|lakhs|crore|cr|crores)\b`, 'i'),
    );
    if (bare) {
      const amount = toAmount(Number(bare[1]), bare[2]);
      if (Number.isFinite(amount)) result.budgetMax = amount;
    }
  }

  // Bare large number near budget words: "budget 500000" / "price 500000"
  if (result.budgetMin == null && result.budgetMax == null) {
    const priced = text.match(
      /(?:budget|price|tk|bdt)\s*:?\s*([\d][\d,]*(?:\.\d+)?)/i,
    );
    if (priced) {
      const amount = toAmount(Number(priced[1].replace(/,/g, '')), undefined);
      if (Number.isFinite(amount)) result.budgetMax = amount;
    }
  }

  return result;
}
