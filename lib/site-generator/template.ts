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

  const headline = `${capitalise(service)} in ${locality}`;

  const intro =
    `${name} provides ${service} across ${locality}${region}. ` +
    `Talk to the team, get a clear scope, and book a time that suits.`;

  const otherServices = profile.services
    .filter(s => s.slug !== heroService.slug)
    .map(s => s.label);

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
            question: 'How do I get a quote?',
            answer:
              `Send an enquiry through this page or call the team. ${name} assesses the ` +
              `job up front, then gives you a written quote.`,
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
