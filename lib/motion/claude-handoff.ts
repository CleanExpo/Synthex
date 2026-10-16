/**
 * Motion Studio — Claude Motion hand-off brief.
 *
 * Claude Motion has no API (Team/Enterprise claude.ai only, beta, 16/10/2026),
 * so for teams that use it Synthex writes the prompt to paste, in the shape
 * the RoboNuggets guide recommends (checked 15/10/2026): the canvas, the look
 * with exact colours, who watches and where, every scene with its seconds,
 * what to avoid, and what done means.
 */
import { MOTION_PLACEMENTS, type MotionBrief } from './brief';
import { MIN_LABEL_PX, type HouseStyle } from './house-style';
import type { MotionPlan } from './planner';

function describe(beat: MotionPlan['props']['beats'][number]): string {
  switch (beat.kind) {
    case 'headline':
      return `"${beat.text}" lands big and holds`;
    case 'stat':
      return `"${beat.value}" counts in huge, then "${beat.label}"${beat.context ? `, then "${beat.context}"` : ''}`;
    case 'compare':
      return `two panels: "${beat.oldLabel}: ${beat.oldText}" in muted grey, then "${beat.newLabel}: ${beat.newText}" in the brand colour`;
    case 'item':
      return `point ${beat.index}: "${beat.text}"`;
    case 'cta':
      return `"${beat.text}" with the brand name, holding to the end`;
  }
}

export function buildClaudeMotionBrief(
  brief: MotionBrief,
  style: HouseStyle,
  plan: MotionPlan
): string {
  const placement = MOTION_PLACEMENTS[brief.placement];
  const s = plan.props.style;
  const scenes = plan.props.beats.map(
    (b, i) =>
      `Scene ${i + 1} (${(b.durationInFrames / plan.fps).toFixed(1)} s): ${describe(b)}.`
  );
  return [
    `Make a ${brief.durationSeconds}-second animation for ${style.displayName}. ${plan.width} x ${plan.height}, ${plan.fps} frames a second.`,
    '',
    `The look: ${s.background} background with a soft ${s.primary} glow, ${s.text} type, ${s.accent} as the single accent for the most important element. ${s.displayFont} for headlines, ${s.bodyFont} for body. Every entrance uses the brand's "${s.signature}" move with easing ${s.easingIn}; nothing moves linearly. One hero element fills 60–70% of the frame in each scene.`,
    'chromaKey' in placement
      ? `Background: solid green ${placement.chromaKey}, nothing else in the frame, so it can be keyed over our own footage. Keep green out of the graphics.`
      : '',
    '',
    `Who watches and where: ${brief.audience}. ${placement.label}.${placement.muted ? ' It plays muted, so every point must read as words on screen.' : ''}`,
    '',
    ...scenes,
    '',
    `Avoid: more than 6 words on screen at once, text near the edges, labels smaller than ${MIN_LABEL_PX}px, one-frame flashes, any fact, number or logo not in the source below, stock imagery or invented people.`,
    '',
    'Done means: every scene plays in order, every key moment holds still for at least a second, every word is readable at phone size (check a still each second, and again at 200px wide), and the call to action holds at the end.',
    '',
    'Source (the only place facts may come from):',
    `"""${brief.source}"""`,
    '',
    'Before you build it, give me its plan in three lines: the look, the scenes with their seconds, and what done looks like. Then build it straight away.',
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n');
}

/** Follow-up message for a single defect, so nothing else changes. */
export function oneDefectFix(defect: string): string {
  return `Fix one defect, then finish: ${defect}. Keep everything else exactly as it is.`;
}
