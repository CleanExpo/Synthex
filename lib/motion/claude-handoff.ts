/**
 * Motion Studio — Claude Motion hand-off brief.
 *
 * Claude Motion has no API (Team/Enterprise claude.ai only, beta, 16/10/2026),
 * so for teams that use it Synthex writes the brief to paste: brief + house
 * style + self-critique, following the method that tested best.
 */
import { MOTION_PLACEMENTS, type MotionBrief } from './brief';
import { styleParagraph, type HouseStyle } from './house-style';
import type { MotionPlan } from './planner';

export function buildClaudeMotionBrief(
  brief: MotionBrief,
  style: HouseStyle,
  plan: MotionPlan
): string {
  const placement = MOTION_PLACEMENTS[brief.placement];
  return [
    `Make a ${brief.durationSeconds}-second ${placement.aspect} animation for ${brief.audience}. It plays: ${placement.label}.`,
    placement.muted
      ? 'It plays muted, so every point must read as words on screen.'
      : 'It may play with sound, but every key point must still read as words on screen.',
    'Use only what is in the source below. Do not add, round or calculate any number that is not listed. End on the call to action.',
    '',
    'On-screen lines, in order:',
    ...plan.onScreen.map((t, i) => `${i + 1}. ${t}`),
    '',
    `Call to action: ${brief.cta}`,
    '',
    'Source:',
    `"""${brief.source}"""`,
    '',
    styleParagraph(style),
    '',
    'Before showing me: render a still every 1 second and judge each like a senior brand design director; judge again at 200px wide (phone) and fix anything that looks cheap, clipped or unreadable.',
  ].join('\n');
}

/** Follow-up message for a single defect, so nothing else changes. */
export function oneDefectFix(defect: string): string {
  return `Fix one defect, then finish: ${defect}. Keep everything else exactly as it is.`;
}
