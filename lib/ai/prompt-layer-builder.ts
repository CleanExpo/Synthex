/**
 * 3-Layer Prompt Builder (SYN-515)
 *
 * Composes the system prompt from three layers:
 *   - Core   — the org's operating system (BrandOperatingSystem). Falls back to
 *              the caller's built-in default when absent.
 *   - Client — who the content is FOR. Resolves ClientProfile → BrandDNA →
 *              OrgContext, each leg degrading to the next (mirrors the graceful
 *              fallbacks already used across the content generator).
 *   - Task   — the caller's own prompt, passed through untouched (the Task layer
 *              is the user message, not part of the system prompt built here).
 *
 * Parity guard: the builder only ENGAGES (returns a non-null systemPrompt) when
 * a genuinely new artifact exists — a BrandOperatingSystem or a ClientProfile.
 * When neither exists the builder returns { systemPrompt: null } so the caller
 * keeps its exact legacy behaviour (the BrandDNA / OrgContext legs are only used
 * to enrich the Client layer once the builder is already engaged via the Core
 * layer). This keeps every existing org byte-for-byte unchanged until it opts in.
 */

import prisma from '@/lib/prisma';

/** The built-in Core-layer default (matches callAI's non-orgContext string). */
export const DEFAULT_CORE_SYSTEM_PROMPT =
  'You are a viral content expert specializing in creating highly engaging social media content. Generate unique, creative content optimized for maximum engagement.';

export type ClientLayerSource =
  | 'client-profile'
  | 'brand-dna'
  | 'org-context'
  | null;

export interface LayeredPrompt {
  /** Composed system prompt, or null → caller falls back to its own default. */
  systemPrompt: string | null;
  /** Core-layer text (BOS-derived) or null when no BrandOperatingSystem exists. */
  core: string | null;
  /** Client-layer text or null when no client source resolved. */
  client: string | null;
  /** Which source fed the Client layer. */
  clientSource: ClientLayerSource;
  /** Task-layer passthrough (the caller's task type). */
  task: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce a Json field into a string[] of non-empty strings. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/** Core layer — from BrandOperatingSystem. Returns null when none exists. */
function composeCore(
  bos: {
    method: string;
    systemPromptOverride: string | null;
    rules: unknown;
  } | null
): string | null {
  if (!bos) return null;

  const override = bos.systemPromptOverride?.trim();
  if (override) return override;

  // No explicit override — build a Core statement from the structured fields,
  // anchored on the built-in default so tone stays consistent.
  const parts = [DEFAULT_CORE_SYSTEM_PROMPT];
  if (bos.method.trim()) parts.push(`Operating method: ${bos.method.trim()}.`);
  const rules = toStringArray(bos.rules);
  if (rules.length) parts.push(`Rules: ${rules.join('; ')}.`);
  return parts.join(' ');
}

/** Client layer — from a ClientProfile row. */
function composeClientFromProfile(cp: {
  icp: unknown;
  offers: unknown;
  toneKeywords: unknown;
  antiPatterns: unknown;
}): string {
  const bits: string[] = [];
  const icp = cp.icp as { description?: unknown } | null;
  if (icp && typeof icp.description === 'string' && icp.description.trim()) {
    bits.push(`Target customer: ${icp.description.trim()}.`);
  }
  const offers = toStringArray(cp.offers);
  if (offers.length) bits.push(`Offers: ${offers.join(', ')}.`);
  const tone = toStringArray(cp.toneKeywords);
  if (tone.length) bits.push(`Tone: ${tone.join(', ')}.`);
  const anti = toStringArray(cp.antiPatterns);
  if (anti.length) bits.push(`Avoid: ${anti.join(', ')}.`);

  return bits.length
    ? `Write for this client. ${bits.join(' ')}`
    : 'Write for this client.';
}

/** Client layer — from a BrandDNA row (fallback). */
function composeClientFromBrandDna(dna: {
  businessName: string;
  industry: string;
  brandVoice: unknown;
}): string {
  const voice = dna.brandVoice as { tone?: unknown } | null;
  const tone =
    voice && typeof voice.tone === 'string' && voice.tone.trim()
      ? voice.tone.trim()
      : null;
  const industry = dna.industry.trim();
  return `You are creating content for ${dna.businessName}${
    industry ? `, a ${industry} business` : ''
  }.${tone ? ` Brand voice: ${tone}.` : ''}`;
}

/** Client layer — from raw Organization data (final fallback = OrgContext). */
function composeClientFromOrgContext(ctx: {
  businessName: string;
  industry: string | null;
  location: string | null;
  brandVoice: string | null;
}): string {
  return `You are creating content for ${ctx.businessName}${
    ctx.industry ? `, a ${ctx.industry} business` : ''
  }${ctx.location ? ` in ${ctx.location}` : ''}.${
    ctx.brandVoice ? ` ${ctx.brandVoice}` : ''
  }`;
}

/**
 * Resolve the Client layer: ClientProfile → BrandDNA → OrgContext → null.
 * Each leg degrades gracefully (missing row → try the next source).
 */
async function resolveClientLayer(
  orgId: string
): Promise<{ text: string | null; source: ClientLayerSource }> {
  // 1. ClientProfile (preferred)
  const profile = await prisma.clientProfile.findUnique({
    where: { organizationId: orgId },
    select: { icp: true, offers: true, toneKeywords: true, antiPatterns: true },
  });
  if (profile) {
    return { text: composeClientFromProfile(profile), source: 'client-profile' };
  }

  // 2. BrandDNA
  const dna = await prisma.brandDNA.findUnique({
    where: { organizationId: orgId },
    select: { businessName: true, industry: true, brandVoice: true },
  });
  if (dna) {
    return { text: composeClientFromBrandDna(dna), source: 'brand-dna' };
  }

  // 3. OrgContext (mirrors ContentGenerator.buildOrgContext)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, industry: true, aiGeneratedData: true },
  });
  if (org) {
    const aiData = org.aiGeneratedData as Record<string, unknown> | null;
    const location =
      (aiData?.suburb as string) ??
      (aiData?.city as string) ??
      (aiData?.location as string) ??
      null;
    const brandVoice =
      (aiData?.brandVoice as string) ?? (aiData?.tone as string) ?? null;
    return {
      text: composeClientFromOrgContext({
        businessName: org.name,
        industry: org.industry,
        location,
        brandVoice,
      }),
      source: 'org-context',
    };
  }

  return { text: null, source: null };
}

/**
 * Build the layered system prompt for an org + task type.
 *
 * @param orgId    Organisation to build the prompt for.
 * @param taskType The caller's task type (Task-layer passthrough).
 * @returns A LayeredPrompt. `systemPrompt` is null when the org has neither a
 *          BrandOperatingSystem nor a ClientProfile — the caller must then use
 *          its own default prompt (preserving legacy parity).
 */
export async function buildLayeredPrompt(
  orgId: string,
  taskType: string
): Promise<LayeredPrompt> {
  const [bos, clientLayer] = await Promise.all([
    prisma.brandOperatingSystem.findUnique({
      where: { organizationId: orgId },
      select: { method: true, systemPromptOverride: true, rules: true },
    }),
    resolveClientLayer(orgId),
  ]);

  const core = composeCore(bos);
  const client = clientLayer.text;

  // Engage only when a genuinely new artifact exists (Core or a ClientProfile).
  const engaged = core !== null || clientLayer.source === 'client-profile';
  if (!engaged) {
    return {
      systemPrompt: null,
      core,
      client,
      clientSource: clientLayer.source,
      task: taskType,
    };
  }

  const parts = [core ?? DEFAULT_CORE_SYSTEM_PROMPT];
  if (client) parts.push(client);

  return {
    systemPrompt: parts.join(' '),
    core,
    client,
    clientSource: clientLayer.source,
    task: taskType,
  };
}
