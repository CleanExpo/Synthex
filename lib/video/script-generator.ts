/**
 * Script Generator — lib/video/script-generator.ts
 *
 * Generates structured JSON video scripts for both BTS and CLIENT series.
 *
 * Each script contains:
 *   - scenes[]     — visual descriptions for capture/render
 *   - voiceover    — full narration text (anti-slop enforced)
 *   - segments[]   — timestamped sections for YouTube chapters
 *   - tags[]       — SEO/YouTube tags
 *   - description  — YouTube description with timestamps and ABOUT block
 *
 * The generated script is stored in VideoEpisode.scriptContent (JSON).
 *
 * @task SYN-578
 */

import { getAIProvider } from '@/lib/ai/providers';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScriptScene {
  id: string;
  order: number;
  type: 'intro' | 'demo' | 'narration' | 'data' | 'cta' | 'outro';
  /** For 'demo' scenes — which workflow key to capture */
  captureWorkflow?: string;
  /** What the camera/screen should show */
  visualDescription: string;
  /** Voiceover text for this scene (null = screen audio only) */
  voiceoverText: string | null;
  /** Estimated duration in seconds */
  estimatedDurationSeconds: number;
}

export interface ScriptSegment {
  title: string;
  startSeconds: number;
  description: string;
}

export interface GeneratedScript {
  title: string;
  episodeNumber?: number;
  seriesType: 'bts' | 'client';
  targetDurationSeconds: number;
  voiceover: string; // full narration — all scenes concatenated
  scenes: ScriptScene[];
  segments: ScriptSegment[]; // YouTube chapters
  tags: string[];
  description: string; // YouTube description
  thumbnailConcept: string; // description for thumbnail generation
  qualityNotes: string; // hints for the quality gate
}

// ── Series-specific system prompts ───────────────────────────────────────────

const BTS_SYSTEM_PROMPT = `You are a documentary filmmaker producing the "Behind the Scenes" series for Synthex — an AI marketing platform built for Australian and New Zealand small businesses.

Your audience: developers, tech founders, and business owners who want to understand how modern SaaS products are built. They appreciate transparency, technical depth, and honest stories about what worked and what didn't.

TONE: Conversational and direct. Speak like a founder talking to other founders — no marketing fluff. Australian English throughout (colour, organise, licence, travelled).

SERIES CONTEXT: These episodes reveal the real decisions, debates, and pivots behind building Synthex. Every phase of development is documented. This is the authentic story, not a polished PR piece.

OUTPUT FORMAT: Return valid JSON matching the GeneratedScript interface. All fields required.`;

const CLIENT_SYSTEM_PROMPT = `You are a product educator producing the "Benefits for SMB Clients" series for Synthex — an AI marketing platform built specifically for Australian and New Zealand small-to-medium businesses.

Your audience: local business owners (cafés, trades, professional services, retail) who are time-poor, not technical, and sceptical of AI tools that don't deliver real results.

TONE: Practical, benefit-focused, and grounded. Speak like a trusted advisor who knows the SMB world. Show real numbers and specific outcomes. Australian English throughout (colour, organise, licence, travelled).

SERIES CONTEXT: Each episode demonstrates a specific Synthex feature using real system screenshots and actual data. The goal is to show — not tell — why this feature saves time or makes money for a local business.

OUTPUT FORMAT: Return valid JSON matching the GeneratedScript interface. All fields required.`;

// ── JSON schema injected into user prompt ────────────────────────────────────

const SCRIPT_SCHEMA = `
Return a JSON object with this exact structure:
{
  "title": "Episode title (under 60 chars for YouTube)",
  "targetDurationSeconds": number,
  "voiceover": "Full narration transcript — every word spoken in the episode",
  "scenes": [
    {
      "id": "scene-001",
      "order": 1,
      "type": "intro|demo|narration|data|cta|outro",
      "captureWorkflow": "workflowKey (only for demo scenes)",
      "visualDescription": "What appears on screen",
      "voiceoverText": "Narration for this scene or null",
      "estimatedDurationSeconds": number
    }
  ],
  "segments": [
    {
      "title": "Chapter title",
      "startSeconds": number,
      "description": "One-sentence chapter description"
    }
  ],
  "tags": ["array", "of", "youtube", "tags"],
  "description": "Full YouTube description with timestamps, links, and ABOUT block",
  "thumbnailConcept": "Visual description for thumbnail generation",
  "qualityNotes": "Anything the quality gate should check"
}
`;

// ── Topic interface (matches VideoTopicQueue shape) ───────────────────────────

export interface TopicInput {
  title: string;
  description: string;
  sourceType: string;
  sourceRef: string;
  rawContent?: string | null;
  tags?: string[];
}

export interface SeriesContext {
  seriesType: 'bts' | 'client';
  episodeNumber: number;
  targetDurationSeconds?: number;
}

// ── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate a video script for a single episode.
 *
 * Returns the parsed GeneratedScript on success.
 * Throws if AI generation or JSON parsing fails.
 */
export async function generateScript(
  topic: TopicInput,
  series: SeriesContext
): Promise<GeneratedScript> {
  const ai = getAIProvider();
  const targetDuration = series.targetDurationSeconds ?? 480;

  const baseSystemPrompt =
    series.seriesType === 'bts' ? BTS_SYSTEM_PROMPT : CLIENT_SYSTEM_PROMPT;

  const systemPrompt = withAntiSlop(baseSystemPrompt, 'append');

  const userPrompt = buildUserPrompt(topic, series, targetDuration);

  logger.info('ScriptGenerator: generating script', {
    topicTitle: topic.title,
    seriesType: series.seriesType,
    episodeNumber: series.episodeNumber,
    targetDuration,
  });

  const response = await ai.complete({
    model: ai.models.balanced,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('ScriptGenerator: empty response from AI provider');
  }

  const script = parseScriptJSON(rawContent, topic, series);

  logger.info('ScriptGenerator: script generated', {
    title: script.title,
    scenes: script.scenes.length,
    voiceoverWords: script.voiceover.split(/\s+/).length,
  });

  return script;
}

// ── User prompt builder ───────────────────────────────────────────────────────

function buildUserPrompt(
  topic: TopicInput,
  series: SeriesContext,
  targetDuration: number
): string {
  const contextBlock = topic.rawContent
    ? `\n\nSOURCE MATERIAL:\n${topic.rawContent}\n`
    : '';

  const tagsHint = topic.tags?.length
    ? `\n\nRELATED TAGS: ${topic.tags.join(', ')}`
    : '';

  const episodeContext =
    series.seriesType === 'bts'
      ? `This is Episode ${series.episodeNumber} of the "Behind the Scenes" series. ` +
        `Source type: ${topic.sourceType} — Ref: ${topic.sourceRef}.`
      : `This is Episode ${series.episodeNumber} of the "Benefits for SMB Clients" series. ` +
        `Focus on practical, measurable benefits for local AU/NZ business owners.`;

  return (
    `Create a ${targetDuration}-second video script for the following topic.\n\n` +
    `TOPIC: ${topic.title}\n` +
    `DESCRIPTION: ${topic.description}\n\n` +
    `${episodeContext}${contextBlock}${tagsHint}\n\n` +
    `REQUIREMENTS:\n` +
    `- Target runtime: ${targetDuration} seconds (${Math.round(targetDuration / 60)} minutes)\n` +
    `- 4–6 scenes minimum\n` +
    `- Include a "demo" scene that captures the live Synthex dashboard where relevant\n` +
    `- The voiceover field must contain the complete narration transcript\n` +
    `- Include at least 3 YouTube chapter segments\n` +
    `- YouTube description should include timestamps, feature links, and an ABOUT block\n` +
    `- Tags: 8–15 relevant tags mixing product terms and search intent keywords\n\n` +
    SCRIPT_SCHEMA
  );
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseScriptJSON(
  raw: string,
  topic: TopicInput,
  series: SeriesContext
): GeneratedScript {
  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    // Try to extract JSON from within the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `ScriptGenerator: could not parse JSON from response. Error: ${e}`
      );
    }
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      throw new Error('ScriptGenerator: JSON extraction from response failed');
    }
  }

  // Build a validated script — fill in defaults for missing optional fields
  const scenes = Array.isArray(parsed.scenes)
    ? (parsed.scenes as ScriptScene[])
    : [];

  const segments = Array.isArray(parsed.segments)
    ? (parsed.segments as ScriptSegment[])
    : [{ title: 'Introduction', startSeconds: 0, description: topic.title }];

  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as string[])
    : ['synthex', 'ai-marketing', 'smb'];

  const voiceover =
    typeof parsed.voiceover === 'string' && parsed.voiceover.length > 0
      ? parsed.voiceover
      : scenes
          .map(s => s.voiceoverText ?? '')
          .join(' ')
          .trim();

  return {
    title:
      typeof parsed.title === 'string'
        ? parsed.title
        : topic.title.substring(0, 60),
    episodeNumber: series.episodeNumber,
    seriesType: series.seriesType,
    targetDurationSeconds:
      typeof parsed.targetDurationSeconds === 'number'
        ? parsed.targetDurationSeconds
        : 480,
    voiceover,
    scenes,
    segments,
    tags,
    description:
      typeof parsed.description === 'string'
        ? parsed.description
        : `${topic.title}\n\nLearn more at https://synthex.social`,
    thumbnailConcept:
      typeof parsed.thumbnailConcept === 'string'
        ? parsed.thumbnailConcept
        : `Dashboard screenshot with title overlay: "${topic.title}"`,
    qualityNotes:
      typeof parsed.qualityNotes === 'string' ? parsed.qualityNotes : '',
  };
}
