import { z } from 'zod';

export const BoardInputSourceSchema = z.enum([
  'telegram',
  'plaud',
  'meeting_notes',
  'manual',
  'obsidian',
  'pipedream',
]);

export const SensitivitySchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export const BoardInputSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  source: BoardInputSourceSchema,
  speaker: z.string().min(1),
  rawText: z.string().min(1),
  cleanedText: z.string().min(1),
  sensitivity: SensitivitySchema,
  capturedAt: z.string().datetime(),
  evidenceRefs: z.array(z.string().min(1)).default([]),
});

export type BoardInputSource = z.infer<typeof BoardInputSourceSchema>;
export type Sensitivity = z.infer<typeof SensitivitySchema>;
export type BoardInput = z.infer<typeof BoardInputSchema>;
