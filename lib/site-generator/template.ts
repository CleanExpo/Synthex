/**
 * Deterministic, validator-safe copy for the multi-tenant site generator.
 *
 * Produces grounded, factual copy that by construction: mentions the hero
 * service noun (schema-vs-content match), never frames AI as the actor, and
 * uses no ACL §18 superlatives. It is the cred-free default; an LLM copy hook
 * plugs in via `GenerateSiteOptions.copyOverride` in a later slice and passes
 * through the same validators.
 */

import type { BusinessProfile, BusinessService, SiteCopy } from './types';

export function buildDeterministicCopy(
  profile: BusinessProfile,
  heroService: BusinessService
): SiteCopy {
  const locality = profile.address.addressLocality;
  const region = profile.address.addressRegion
    ? `, ${profile.address.addressRegion}`
    : '';
  const service = heroService.label;
  const name = profile.name;

  const otherServices = profile.services
    .filter(s => s.slug !== heroService.slug)
    .map(s => s.label);

  // GBP categories are business-type nouns. Most read as a service after
  // "provides" ("provides water damage restoration service"), but an
  // organisation-type noun does not ("provides software company" is broken).
  // For those, frame the business AS that entity ("is a software company")
  // rather than as something it provides. Both paths keep the hero noun in the
  // copy, so the schema-vs-content-match validator still passes.
  if (isOrganisationTypeNoun(service)) {
    return entityCopy({
      name,
      service,
      locality,
      region,
      otherServices,
      faqs: profile.faqs,
    });
  }

  const headline = `${capitalise(service)} in ${locality}`;

  const intro =
    `${name} provides ${service} across ${locality}${region}. ` +
    `Talk to the team, get a clear scope, and book a time that suits.`;

  const bodyParagraphs: string[] = [
    `Every ${service} job starts with an on-site assessment so the quote reflects ` +
      `the actual work — no surprises once the job is under way.`,
  ];
  if (otherServices.length > 0) {
    bodyParagraphs.push(
      `${name} also handles ${joinList(otherServices)} for customers across ${locality}${region}.`
    );
  }
  bodyParagraphs.push(
    `To get started, send an enquiry or call the team — a real person answers and ` +
      `walks you through the next step.`
  );

  const faqs =
    profile.faqs && profile.faqs.length > 0
      ? profile.faqs
      : [
          {
            question: `Do you provide ${service} in ${locality}?`,
            answer: `Yes. ${name} provides ${service} throughout ${locality}${region}.`,
          },
          {
            question: 'How does quoting work?',
            answer:
              `Send an enquiry through this page or call the team. ${name} assesses the ` +
              `job up front, then gives you a written quote.`,
          },
        ];

  return { headline, intro, bodyParagraphs, faqs };
}

/** Organisation-type category nouns that read as an entity, not a service. */
const ORGANISATION_TYPE_NOUNS = new Set([
  'company',
  'agency',
  'firm',
  'studio',
  'consultancy',
  'corporation',
  'enterprise',
]);

function isOrganisationTypeNoun(service: string): boolean {
  const last = service.trim().toLowerCase().split(/\s+/).pop();
  return last ? ORGANISATION_TYPE_NOUNS.has(last) : false;
}

/** Entity-framed copy for an organisation-type category ("is a X", not "provides X"). */
function entityCopy(args: {
  name: string;
  service: string;
  locality: string;
  region: string;
  otherServices: string[];
  faqs: BusinessProfile['faqs'];
}): SiteCopy {
  const { name, service, locality, region, otherServices } = args;

  const headline = `${capitalise(service)} in ${locality}`;

  const intro =
    `${name} is a ${service} serving ${locality}${region}. ` +
    `Talk to the team, get a clear scope, and book a time that suits.`;

  const bodyParagraphs: string[] = [
    `${name} works with clients across ${locality}${region} — get in touch to talk ` +
      `through what you need and the next step.`,
  ];
  if (otherServices.length > 0) {
    bodyParagraphs.push(
      `${name} also handles ${joinList(otherServices)} for customers across ${locality}${region}.`
    );
  }
  bodyParagraphs.push(
    `To get started, send an enquiry or call the team — a real person answers and ` +
      `walks you through the next step.`
  );

  const faqs =
    args.faqs && args.faqs.length > 0
      ? args.faqs
      : [
          {
            question: `Do you work with clients in ${locality}?`,
            answer: `Yes. ${name} works with clients throughout ${locality}${region}.`,
          },
          {
            question: 'How does quoting work?',
            answer:
              `Send an enquiry through this page or call the team. ${name} scopes the ` +
              `work up front, then gives you a written quote.`,
          },
        ];

  return { headline, intro, bodyParagraphs, faqs };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
