/**
 * generateCaseStudyScript — lib/videos/generateCaseStudyScript.ts
 *
 * Produces the four-section narration script for a "Featured in Synthex"
 * case-study short (SYN-508), anchored on the client's real weekly-digest data.
 *
 *   intro (10s) → results highlight (20s) → quote (10s) → CTA (10s)
 *
 * Uses the direct Anthropic Messages API (no SDK) with claude-haiku-4-5, the
 * same pattern as lib/ai/content-evaluator.ts, and records spend via
 * trackPipelineCost() after generation.
 *
 * @task SYN-508
 */
import {
  trackPipelineCost,
  calculatePipelineCost,
} from '@/lib/pipelines/track-cost';

const MODEL = 'claude-haiku-4-5-20251001';

/** Source metrics for the script — sourced from a weekly_digests row. */
export interface CaseStudyDigestData {
  /** Human client / business name. */
  businessName: string;
  /** e.g. "6.4%" or 6.4 */
  avgEngagementRate?: string | number | null;
  /** e.g. ["Reels", "Carousels"] */
  topContentTypes?: string[] | null;
  /** e.g. "Instagram" */
  bestPlatform?: string | null;
  /** Optional free-form standout wins to feed the results section. */
  highlights?: string[] | null;
}

/** The structured 4-section script the Remotion composition renders. */
export interface CaseStudyScript {
  /** ~10s hook naming the client + the transformation. */
  intro: string;
  /** ~20s concrete results grounded in the digest metrics. */
  resultsHighlight: string;
  /** ~10s first-person client quote. */
  quote: string;
  /** ~10s call to action to the viewer. */
  cta: string;
}

const SCRIPT_SYSTEM_PROMPT = `You are a short-form video scriptwriter for Synthex, writing 60–90 second case-study narration for a client success story.

Write in a confident, concrete, non-hyperbolic voice. Never invent metrics — use ONLY the numbers supplied. If a metric is missing, speak qualitatively instead of fabricating a figure.

Return STRICT JSON only (no markdown fence, no prose) with exactly these keys:
{
  "intro": "≈10s hook naming the client and the transformation",
  "resultsHighlight": "≈20s of concrete results grounded in the supplied metrics",
  "quote": "≈10s first-person client quote, plausible and specific",
  "cta": "≈10s call to action inviting the viewer to start with Synthex"
}`;

/** Compose the user message from the digest data (deterministic — testable). */
export function buildScriptUserMessage(data: CaseStudyDigestData): string {
  const lines = [
    `Client / business name: ${data.businessName}`,
    data.avgEngagementRate != null
      ? `Average engagement rate: ${data.avgEngagementRate}`
      : null,
    data.bestPlatform ? `Best-performing platform: ${data.bestPlatform}` : null,
    data.topContentTypes?.length
      ? `Top content types: ${data.topContentTypes.join(', ')}`
      : null,
    data.highlights?.length
      ? `Standout wins:\n- ${data.highlights.join('\n- ')}`
      : null,
  ].filter(Boolean);

  return `Generate the case-study script from this data:\n\n${lines.join('\n')}`;
}

/** Parse + validate the model's JSON into a CaseStudyScript, or throw. */
export function parseCaseStudyScript(raw: string): CaseStudyScript {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const obj = JSON.parse(cleaned) as Partial<CaseStudyScript>;
  const required: (keyof CaseStudyScript)[] = [
    'intro',
    'resultsHighlight',
    'quote',
    'cta',
  ];
  for (const key of required) {
    if (typeof obj[key] !== 'string' || (obj[key] as string).trim() === '') {
      throw new Error(`Case-study script missing section: ${key}`);
    }
  }
  return {
    intro: obj.intro!,
    resultsHighlight: obj.resultsHighlight!,
    quote: obj.quote!,
    cta: obj.cta!,
  };
}

/**
 * Generate the case-study script and record its cost.
 *
 * @param data    digest-derived metrics for the featured client
 * @param options `clientId` + `runId` are threaded into the cost ledger
 */
export async function generateCaseStudyScript(
  data: CaseStudyDigestData,
  options: { clientId?: string | null; runId?: string } = {}
): Promise<CaseStudyScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: SCRIPT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildScriptUserMessage(data) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = payload.content.find(b => b.type === 'text')?.text ?? '';
  const script = parseCaseStudyScript(text);

  // Cost tracking — after script generation, per ticket contract.
  const inputTokens = payload.usage?.input_tokens ?? 0;
  const outputTokens = payload.usage?.output_tokens ?? 0;
  await trackPipelineCost({
    pipeline_name: 'featured_case_study_script',
    client_id: options.clientId ?? null,
    run_id: options.runId ?? crypto.randomUUID(),
    model: MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: calculatePipelineCost(MODEL, inputTokens, outputTokens),
  });

  return script;
}
