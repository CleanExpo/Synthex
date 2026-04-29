/**
 * Maps the NRPG ContractorOnboardedEvent.serviceCategories strings
 * (e.g. 'water-damage', 'fire-restoration', 'mould-remediation') to
 * the DR landing-page / sitemap whitelist ('water-damage' | 'fire' |
 * 'mould').
 *
 * Unknown categories are silently dropped — defensive against future
 * NRPG additions that DR doesn't yet generate pages for.
 *
 * @see SYN-834 (epic — final integration)
 */

import type { DrServiceCategory } from '@/lib/landing-page';

const NRPG_TO_DR: Record<string, DrServiceCategory> = {
  'water-damage': 'water-damage',
  water: 'water-damage',
  'fire-restoration': 'fire',
  fire: 'fire',
  'mould-remediation': 'mould',
  mould: 'mould',
};

export function mapNrpgServiceCategories(
  nrpgCategories: ReadonlyArray<string>
): DrServiceCategory[] {
  const seen = new Set<DrServiceCategory>();
  const out: DrServiceCategory[] = [];
  for (const c of nrpgCategories) {
    const mapped = NRPG_TO_DR[c.toLowerCase()];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
}
