/**
 * Brand Video Studio — style registry.
 *
 * Mirror of `.claude/skills/brand-video/styles.json` (the /brand-video CLI
 * command's style source of truth). Kept inline here so the dashboard dropdown
 * and the API validation share one list without reading the skill dir at runtime.
 * When a look is added to the skill's styles.md/json, add it here too.
 */

export interface BrandVideoStyle {
  key: string;
  label: string;
  audience: string;
}

export const BRAND_VIDEO_STYLES: readonly BrandVideoStyle[] = [
  {
    key: 'flat-line',
    label: 'Flat-line Explainer',
    audience: 'B2B SaaS, trades, professional services',
  },
  {
    key: 'hand-doodle',
    label: 'Hand-drawn Doodle',
    audience: 'Broad / educational / social',
  },
  {
    key: 'bold-kinetic',
    label: 'Bold Kinetic',
    audience: 'Paid social / ads / consumer',
  },
  {
    key: 'cinematic-photoreal',
    label: 'Cinematic Photoreal',
    audience: 'Premium brand / launch films',
  },
  {
    key: 'minimal-corporate',
    label: 'Minimal Corporate',
    audience: 'Enterprise / finance / compliance',
  },
  {
    key: 'retro-print',
    label: 'Retro Print',
    audience: 'Distinctive / indie / memorable',
  },
] as const;

export const DEFAULT_BRAND_VIDEO_STYLE = 'flat-line';

export const BRAND_VIDEO_STYLE_KEYS = BRAND_VIDEO_STYLES.map(s => s.key) as [
  string,
  ...string[],
];
