/**
 * Motion Studio — the brief.
 *
 * Claude Motion's first lever is "write it like a brief, not a wish": what it
 * is, how long, the exact source words, and where it plays. The brief is also
 * the only source of facts: every figure on screen must come from `source`.
 */
import { z } from 'zod';

export const MOTION_PLACEMENTS = {
  'feed-portrait': {
    aspect: '9:16',
    muted: true,
    label: 'Social feed, portrait (plays muted)',
  },
  'feed-square': {
    aspect: '1:1',
    muted: true,
    label: 'Social feed, square (plays muted)',
  },
  youtube: { aspect: '16:9', muted: false, label: 'YouTube / with sound' },
  website: {
    aspect: '16:9',
    muted: true,
    label: 'Website embed (autoplays muted)',
  },
  presentation: {
    aspect: '16:9',
    muted: false,
    label: 'Presentation / meeting',
  },
} as const;

export type MotionPlacement = keyof typeof MOTION_PLACEMENTS;

const line = (max: number) => z.string().trim().min(1).max(max);

export const MotionContentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stat'),
    stat: line(24),
    label: line(80),
    context: line(160),
  }),
  z.object({
    kind: z.literal('comparison'),
    oldWay: line(160),
    newWay: line(160),
  }),
  z.object({
    kind: z.literal('case-study'),
    challenge: line(160),
    solution: line(160),
    result: line(160),
    metric: z.string().trim().max(24).optional(),
  }),
  z.object({
    kind: z.literal('how-to'),
    steps: z
      .array(
        z.object({
          step: line(80),
          detail: z.string().trim().max(120).optional(),
        })
      )
      .min(1)
      .max(5),
  }),
  z.object({ kind: z.literal('list'), items: z.array(line(80)).min(1).max(5) }),
  z.object({
    kind: z.literal('explainer'),
    scenes: z
      .array(
        z.object({
          text: line(80),
          subtitle: z.string().trim().max(120).optional(),
        })
      )
      .min(1)
      .max(8),
  }),
]);

export type MotionContent = z.infer<typeof MotionContentSchema>;
export type MotionKind = MotionContent['kind'];

/** A figure the animation computes from source numbers; recomputed before use. */
export const DerivedFigureSchema = z.object({
  label: line(60),
  operation: z.enum(['percent', 'ratio', 'difference', 'sum']),
  inputs: z.array(z.number().finite()).min(2).max(6),
  decimals: z.number().int().min(0).max(2).default(0),
});

export type DerivedFigure = z.infer<typeof DerivedFigureSchema>;

export const MotionBriefSchema = z.object({
  brand: line(120),
  placement: z.enum(
    Object.keys(MOTION_PLACEMENTS) as [MotionPlacement, ...MotionPlacement[]]
  ),
  durationSeconds: z.number().int().min(6).max(60),
  audience: line(200),
  cta: line(80),
  /** The brand's own words or data: the only permitted source of facts. */
  source: line(6000),
  content: MotionContentSchema,
  derived: z.array(DerivedFigureSchema).max(5).default([]),
});

export type MotionBrief = z.infer<typeof MotionBriefSchema>;
