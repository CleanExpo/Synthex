/**
 * AI Backlink Prospector — Outreach Templates (Phase 95)
 *
 * Email templates for each backlink opportunity type.
 * Pure template generation — no AI call. User should refine before sending.
 *
 * Pattern mirrors lib/pr/pitch-drafter.ts
 *
 * @module lib/backlinks/outreach-templates
 */

import type {
  BacklinkOpportunityType,
  OutreachDraft,
  BrandIdentityBrief,
  ScoredProspect,
} from './types';

// ---------------------------------------------------------------------------
// Resource Page template
// ---------------------------------------------------------------------------

function resourcePageTemplate(
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  const subject = `Resource page suggestion for ${prospect.domain}`;
  const body = [
    'Hi there,',
    '',
    `I came across your resource page at ${prospect.url} and noticed you've curated some excellent links for your readers.`,
    '',
    `I wanted to suggest a resource that might be a great fit: ${brand.name} (${brand.websiteUrl}).`,
    '',
    brand.description,
    '',
    'We help businesses with [specific benefit relevant to their audience], and our content covers:',
    '- [Key topic 1]',
    '- [Key topic 2]',
    '- [Key topic 3]',
    '',
    'I think it would be a valuable addition to your list. Happy to provide more detail if helpful.',
    '',
    'Best regards,',
    '[Your Name]',
    `${brand.name}`,
    brand.websiteUrl,
  ].join('\n');

  return {
    subject,
    body,
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: 'resource-page',
  };
}

// ---------------------------------------------------------------------------
// Guest Post template
// ---------------------------------------------------------------------------

function guestPostTemplate(
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  const subject = `Guest post pitch for ${prospect.domain}`;
  const body = [
    'Hi there,',
    '',
    `I'm a regular reader of ${prospect.domain} and really enjoy the quality of content you publish.`,
    '',
    `I noticed you accept guest contributions and I'd love to write for your audience. ${brand.description}`,
    '',
    'Some article ideas I had in mind:',
    '1. [Article idea 1 — specific, actionable, fits their audience]',
    '2. [Article idea 2 — data-driven, with original insights]',
    '3. [Article idea 3 — how-to guide relevant to their niche]',
    '',
    'My previous writing has been published on [mention 1-2 relevant publications if applicable].',
    '',
    'All articles would be 100% original, well-researched, and tailored specifically to your audience.',
    '',
    'Would you be open to reviewing a full pitch?',
    '',
    'Best regards,',
    '[Your Name]',
    `${brand.name}`,
    brand.websiteUrl,
  ].join('\n');

  return {
    subject,
    body,
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: 'guest-post',
  };
}

// ---------------------------------------------------------------------------
// Broken Link template
// ---------------------------------------------------------------------------

function brokenLinkTemplate(
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  const subject = `Broken link found on ${prospect.domain}`;
  const body = [
    'Hi there,',
    '',
    `I was browsing ${prospect.url} and noticed a broken link that might be affecting your readers' experience.`,
    '',
    'The link appears to point to a page that no longer exists (returns a 404 error). Your readers might be seeing an error when they click on it.',
    '',
    `I actually have content on ${brand.websiteUrl} that covers the same topic and would be a great replacement:`,
    '',
    `${brand.websiteUrl}/[relevant-page]`,
    '',
    brand.description,
    '',
    'Happy to send through more details. Fixing broken links is usually a quick win for user experience!',
    '',
    'Best regards,',
    '[Your Name]',
    `${brand.name}`,
    brand.websiteUrl,
  ].join('\n');

  return {
    subject,
    body,
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: 'broken-link',
  };
}

// ---------------------------------------------------------------------------
// Journalist Mention template
// ---------------------------------------------------------------------------

function journalistMentionTemplate(
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  const subject = `Re: your article on ${prospect.title}`;
  const body = [
    'Hi there,',
    '',
    `I really enjoyed your piece at ${prospect.url} — it covered [specific angle] really well.`,
    '',
    `I'm reaching out because ${brand.name} is doing something relevant to what you covered. ${brand.description}`,
    '',
    'We have some fresh data/insights on this topic that might be useful for a follow-up:',
    '- [Data point 1 or insight]',
    '- [Data point 2 or case study]',
    '',
    'I\'d love to connect and see if there\'s an angle that would work for your coverage.',
    '',
    'Happy to offer an exclusive data cut, a briefing call, or access to a spokesperson.',
    '',
    'Best regards,',
    '[Your Name]',
    `${brand.name}`,
    brand.websiteUrl,
  ].join('\n');

  return {
    subject,
    body,
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: 'journalist-mention',
  };
}

// ---------------------------------------------------------------------------
// Competitor Link template
// ---------------------------------------------------------------------------

function competitorLinkTemplate(
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  const subject = `Alternative resource recommendation for ${prospect.domain}`;
  const body = [
    'Hi there,',
    '',
    `I noticed your page at ${prospect.url} links to some tools and resources in this space.`,
    '',
    `I wanted to introduce ${brand.name} as another option your readers might find valuable.`,
    '',
    brand.description,
    '',
    'Key differentiators compared to existing options on your page:',
    '- [Differentiator 1]',
    '- [Differentiator 2]',
    '- [Differentiator 3]',
    '',
    `You can see it in action at ${brand.websiteUrl}.`,
    '',
    'Would you be open to adding it to your list, or swapping it in as a more up-to-date alternative?',
    '',
    'Best regards,',
    '[Your Name]',
    `${brand.name}`,
    brand.websiteUrl,
  ].join('\n');

  return {
    subject,
    body,
    recipientEmail: prospect.outreachEmail ?? '',
    opportunityType: 'competitor-link',
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Generate an outreach email draft for a specific opportunity type.
 * Pure template generation — user should review and personalise before sending.
 */
export function getOutreachTemplate(
  type: BacklinkOpportunityType,
  prospect: ScoredProspect,
  brand: BrandIdentityBrief
): OutreachDraft {
  switch (type) {
    case 'resource-page':       return resourcePageTemplate(prospect, brand);
    case 'guest-post':          return guestPostTemplate(prospect, brand);
    case 'broken-link':         return brokenLinkTemplate(prospect, brand);
    case 'journalist-mention':  return journalistMentionTemplate(prospect, brand);
    case 'competitor-link':     return competitorLinkTemplate(prospect, brand);
    default:                    return resourcePageTemplate(prospect, brand);
  }
}

export const OPPORTUNITY_TYPE_LABELS: Record<BacklinkOpportunityType, string> = {
  'resource-page':      'Resource Page',
  'guest-post':         'Guest Post',
  'broken-link':        'Broken Link',
  'competitor-link':    'Competitor Link',
  'journalist-mention': 'Journalist Mention',
};
