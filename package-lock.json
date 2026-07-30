const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;

export function isRateStale(effectiveDate: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(effectiveDate).getTime() > SIX_MONTHS_MS;
}
