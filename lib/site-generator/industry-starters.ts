/**
 * Industry starter templates — the content half of the Phase 3 template library.
 *
 * A Google Business Profile fetch (`fromGbpLocation`) yields a real
 * BusinessProfile, but GBP has **no FAQ field** and only broad category
 * services, so a fresh listing generates a thin site. An industry starter fills
 * exactly those gaps with industry-specific service breakdowns and
 * validator-safe FAQ scaffolds — WITHOUT overwriting anything the business
 * actually provided (real data always wins).
 *
 * Two entry points:
 *   - `inferStarter(categoryLabel)` maps a GBP primary-category display name
 *     ('Plumber', 'Electrician', ...) to a starter — the pipeline glue.
 *   - `applyStarter(profile, starter)` non-destructively fills empty
 *     services / faqs, returning a new profile ready for `generateSite`.
 *
 * FAQ scaffolds are deliberately process-oriented (how to get a quote, response
 * times, service area) — never a service or superlative claim — so they pass
 * the same validator gate as generated copy.
 */

import type { BusinessFaq, BusinessProfile, BusinessService } from './types';

export interface IndustryStarter {
  /** Stable key, e.g. 'plumbing'. */
  key: string;
  /** Human label, e.g. 'Plumbing'. */
  label: string;
  /** Specific services used when the profile has none of its own. */
  services: BusinessService[];
  /** Generic, validator-safe FAQ scaffolds used when the profile has no FAQs. */
  faqs: BusinessFaq[];
  /**
   * Lower-cased substrings that map a GBP category display name to this
   * starter, e.g. 'plumber' → plumbing.
   */
  match: readonly string[];
}

/** Process FAQs common to every local service business — safe, non-claiming. */
const COMMON_FAQS: BusinessFaq[] = [
  {
    question: 'How does quoting work?',
    answer:
      'Send an enquiry through this page or call the team. The work is assessed up front and you get a written quote before anything starts.',
  },
  {
    question: 'What areas do you cover?',
    answer:
      'The team works across the local area. Send through your suburb and coverage is confirmed before any work is booked.',
  },
];

export const INDUSTRY_STARTERS: readonly IndustryStarter[] = [
  {
    key: 'plumbing',
    label: 'Plumbing',
    services: [
      { slug: 'blocked-drains', label: 'blocked drain clearing' },
      { slug: 'hot-water', label: 'hot water repairs' },
      { slug: 'leak-detection', label: 'leak detection' },
      { slug: 'general-plumbing', label: 'general plumbing repairs' },
    ],
    faqs: [
      {
        question: 'Do you handle emergency call-outs?',
        answer:
          'Yes. Call the team and the earliest available attendance time is confirmed on the spot.',
      },
      ...COMMON_FAQS,
    ],
    match: ['plumber', 'plumbing'],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    services: [
      { slug: 'switchboard', label: 'switchboard upgrades' },
      { slug: 'lighting', label: 'lighting installation' },
      { slug: 'fault-finding', label: 'electrical fault finding' },
      { slug: 'safety-inspection', label: 'electrical safety inspections' },
    ],
    faqs: [
      {
        question: 'Are your electricians licensed?',
        answer:
          'Yes. All electrical work is carried out by licensed electricians and left safe and compliant.',
      },
      ...COMMON_FAQS,
    ],
    match: ['electrician', 'electrical'],
  },
  {
    key: 'restoration',
    label: 'Damage Restoration',
    services: [
      { slug: 'water-damage', label: 'water damage restoration' },
      { slug: 'fire-damage', label: 'fire and smoke damage restoration' },
      { slug: 'mould-remediation', label: 'mould remediation' },
      { slug: 'structural-drying', label: 'structural drying' },
    ],
    faqs: [
      {
        question: 'Do you work with insurance?',
        answer:
          'Yes. Every restoration is documented — the cause, damage category, moisture readings, and drying records — so your insurance claim is straightforward to lodge and manage. Where your insurer allows, billing can be arranged directly with them.',
      },
      {
        question: 'Is the damage covered by insurance?',
        answer:
          'Coverage depends on your policy. The loss is documented thoroughly so you can confirm what is covered with your insurer and lodge the claim with the evidence they need.',
      },
      {
        question: 'How soon should restoration work start?',
        answer:
          'The sooner the better — early drying limits secondary damage. Contact the team and a technician attends as quickly as possible.',
      },
      ...COMMON_FAQS,
    ],
    match: ['restoration', 'water damage', 'fire damage', 'damage restoration'],
  },
  {
    key: 'landscaping',
    label: 'Landscaping',
    services: [
      { slug: 'garden-design', label: 'garden design' },
      { slug: 'lawn-care', label: 'lawn care and maintenance' },
      { slug: 'paving', label: 'paving and retaining walls' },
      { slug: 'irrigation', label: 'irrigation installation' },
    ],
    faqs: [
      {
        question: 'Do you offer ongoing maintenance?',
        answer:
          'Yes. Alongside one-off projects the team offers regular garden and lawn maintenance — ask for a schedule that suits.',
      },
      ...COMMON_FAQS,
    ],
    match: ['landscaper', 'landscaping', 'gardener', 'lawn'],
  },
];

/** Look up a starter by its stable key. */
export function getStarter(key: string): IndustryStarter | undefined {
  return INDUSTRY_STARTERS.find(s => s.key === key);
}

/**
 * Map a GBP category display name (e.g. 'Plumber', 'Water damage restoration
 * service') to a starter. Case-insensitive substring match — returns the first
 * starter whose `match` list hits, or undefined.
 */
export function inferStarter(
  categoryLabel: string
): IndustryStarter | undefined {
  const needle = categoryLabel.toLowerCase();
  return INDUSTRY_STARTERS.find(s => s.match.some(m => needle.includes(m)));
}

/**
 * Non-destructively fill a sparse profile from a starter. Real data always
 * wins: services and FAQs are only supplied when the profile has none of its
 * own. Returns a new profile — the input is not mutated.
 */
export function applyStarter(
  profile: BusinessProfile,
  starter: IndustryStarter
): BusinessProfile {
  const services: BusinessService[] =
    profile.services && profile.services.length > 0
      ? profile.services
      : starter.services;

  const faqs =
    profile.faqs && profile.faqs.length > 0 ? profile.faqs : starter.faqs;

  return { ...profile, services, faqs };
}
