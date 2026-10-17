/**
 * Motion Studio — house style.
 *
 * Claude Motion's second lever: one house-style file attached to every brief.
 * Ours already exists as BrandConfig (colour, typography, motion tokens), so the
 * style is resolved from the brand, never described from memory.
 */
import { brands, type BrandSlug } from '@unite-group/brand-config';

export interface HouseStyle {
  slug: BrandSlug;
  displayName: string;
  colours: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    display: string;
    body: string;
    displaySrc: string;
    displayWeight: number;
    bodySrc: string;
    bodyWeight: number;
  };
  motion: {
    fastFrames: number;
    baseFrames: number;
    slowFrames: number;
    easingIn: string;
    easingOut: string;
    easingInOut: string;
    signature: string;
    transitionFrames: number;
  };
  doNot: readonly string[];
}

/** Smallest on-screen label, in px at 1080 px width (phone legibility). */
export const MIN_LABEL_PX = 34;

export function resolveHouseStyle(slug: BrandSlug): HouseStyle {
  const b = brands[slug];
  return {
    slug,
    displayName: b.displayName,
    colours: {
      primary: b.colour.primary,
      secondary: b.colour.secondary,
      accent: b.colour.accent,
      background: b.colour.neutral[900],
      text: b.colour.neutral[50],
    },
    typography: {
      display: b.typography.display.family,
      body: b.typography.body.family,
      displaySrc: b.typography.display.src,
      displayWeight: b.typography.display.weight,
      bodySrc: b.typography.body.src,
      bodyWeight: b.typography.body.weight,
    },
    motion: {
      fastFrames: b.motion.durations.fast,
      baseFrames: b.motion.durations.base,
      slowFrames: b.motion.durations.slow,
      easingIn: b.motion.easing.in,
      easingOut: b.motion.easing.out,
      easingInOut: b.motion.easing.inOut,
      signature: b.motion.signature,
      transitionFrames: b.motion.transitionFrames,
    },
    doNot: b.doNot,
  };
}

/** The "paragraph that makes it look expensive", built from the brand's tokens. */
export function styleParagraph(style: HouseStyle): string {
  return [
    `House style for ${style.displayName}:`,
    `- Colours: primary ${style.colours.primary}, secondary ${style.colours.secondary}, accent ${style.colours.accent} (accent only for the single most important element), background ${style.colours.background}, text ${style.colours.text}.`,
    `- Type: ${style.typography.display} for headlines, ${style.typography.body} for body; no label smaller than ${MIN_LABEL_PX}px at 1080px wide.`,
    `- Motion: signature move "${style.motion.signature}" on every entrance; entry easing ${style.motion.easingIn}, exit ${style.motion.easingOut}, scene transitions ${style.motion.easingInOut} over ${style.motion.transitionFrames} frames; durations fast ${style.motion.fastFrames}, base ${style.motion.baseFrames}, slow ${style.motion.slowFrames} frames at 30fps. Nothing moves linearly.`,
    '- One hero element fills 60–70% of the frame per scene. One idea per scene. Never two title cards in a row.',
    "- Real assets only: our own text, numbers, charts and supplied real photos. No stock, no invented people or footage, no other brand's logos or trademarks.",
    ...style.doNot.map(rule => `- Never: ${rule}`),
  ].join('\n');
}
