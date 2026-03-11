/**
 * PR Journalist CRM — Pitch Drafter (Phase 92)
 *
 * Pure template-based pitch draft generation. No AI call.
 * Returns structured draft content for the user to refine before sending.
 *
 * @module lib/pr/pitch-drafter
 */

import type { PRDraftSuggestion } from './types';
import type { JournalistContact } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pitch templates by beat
// ---------------------------------------------------------------------------

const BEAT_OPENERS: Record<string, string> = {
  technology:    'As someone who covers the technology landscape,',
  business:      'Given your coverage of the Australian business community,',
  startups:      'As a journalist following the startup ecosystem,',
  finance:       'Given your expertise in financial markets and economic trends,',
  marketing:     'As someone who covers marketing and brand strategy,',
  ecommerce:     'Given your coverage of retail and e-commerce,',
  sustainability:'As a journalist reporting on sustainability and ESG,',
  health:        'Given your coverage of the health and wellness sector,',
  property:      'As someone who covers the property market,',
  education:     'Given your expertise in education and learning,',
  default:       'As a journalist covering this space,',
};

// ---------------------------------------------------------------------------
// Main draft generation function
// ---------------------------------------------------------------------------

/**
 * Generate a structured pitch draft for a journalist.
 * Pure template generation — no AI call. User should refine before sending.
 *
 * @param journalist - The journalist contact record
 * @param brandIdentity - Brand name and description
 * @param angle - The pitch angle/hook (1-2 sentences)
 * @returns Structured pitch draft with subject, body, and personalisation note
 */
export function generatePitchDraft(
  journalist: JournalistContact,
  brandIdentity: { canonicalName: string; description: string },
  angle: string
): PRDraftSuggestion {
  const firstName = journalist.name.split(' ')[0] ?? journalist.name;
  const primaryBeat = journalist.beats?.[0] ?? 'default';
  const opener = BEAT_OPENERS[primaryBeat] ?? BEAT_OPENERS.default;

  // Generate subject line
  const subject = generateSubject(brandIdentity.canonicalName, angle, primaryBeat);

  // Generate pitch body
  const body = [
    `Hi ${firstName},`,
    '',
    `${opener} I wanted to reach out about ${brandIdentity.canonicalName}.`,
    '',
    angle,
    '',
    `${brandIdentity.description}`,
    '',
    'I thought this might be relevant to your readers given the current focus on ' +
      (primaryBeat !== 'default' ? `${primaryBeat} and innovation` : 'industry trends') + '.',
    '',
    'I\'d love to set up a quick call or send through more detail. Happy to provide:',
    '- Background data and supporting research',
    '- Access to spokespeople for quotes',
    '- Exclusive embargo access if helpful',
    '',
    'Would you be interested in exploring this story?',
    '',
    'Best regards,',
    '[Your Name]',
    '[Your Title]',
    `[Your Contact Details]`,
  ].join('\n');

  // Generate personalisation note
  const personalisation = generatePersonalisation(journalist, primaryBeat);

  return {
    subject,
    body,
    personalisation,
    angle,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function generateSubject(
  brandName: string,
  angle: string,
  beat: string
): string {
  // Create a concise subject line from the angle
  const angleWords = angle.split(' ').slice(0, 8).join(' ');
  const cleanAngle = angleWords.replace(/[.!?]+$/, '');

  // Subject line variants by beat
  const subjects: Record<string, string> = {
    technology:    `[Exclusive] ${brandName}: ${cleanAngle}`,
    startups:      `${brandName} — Story Pitch: ${cleanAngle}`,
    business:      `Story idea for ${beat} desk: ${brandName}`,
    default:       `Press pitch: ${brandName} — ${cleanAngle}`,
  };

  return subjects[beat] ?? subjects.default;
}

function generatePersonalisation(
  journalist: JournalistContact,
  beat: string
): string {
  const notes: string[] = [];

  if (journalist.beats && journalist.beats.length > 0) {
    notes.push(
      `Journalist covers: ${journalist.beats.slice(0, 3).join(', ')}`
    );
  }

  if (journalist.tier && journalist.tier !== 'cold') {
    notes.push(`Relationship tier: ${journalist.tier}`);
  }

  if (journalist.lastContactedAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(journalist.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    notes.push(`Last contacted: ${daysSince} days ago`);
  }

  notes.push(
    `Tip: Personalise the opener to reference a recent article from ${journalist.outlet} to increase response rate.`
  );

  return notes.join('\n');
}
