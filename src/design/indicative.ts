import type { DesignCheckResult } from './types';

/** Marker placed next to an indicative D/C ratio, keyed to a footnote. */
export const INDICATIVE_MARK = '†';

/** Distinct reasons across the results that are flagged indicative. */
export function indicativeReasons(results: readonly DesignCheckResult[]): string[] {
  const reasons = new Set<string>();
  for (const r of results) {
    if (r.indicative) reasons.add(r.indicative.reason);
  }
  return [...reasons];
}
