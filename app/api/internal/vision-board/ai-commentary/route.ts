/**
 * AI commentary endpoint for the Vision Board.
 *
 * Owner-only. Each call critiques one panel ("brand" | "storyboard" | "motion"
 * | "copy" | "competitive" | "runbook") and returns a structured AICommentaryResponse.
 *
 * Uses Gemini 3.1 Pro directly (same provider as /api/demo/analyze). If
 * GEMINI_API_KEY is missing, returns a deterministic stub commentary so the
 * panel still demonstrates correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { ra } from '@unite-group/brand-config';
import { NIR_STORYBOARD } from '@/lib/vision-board/nir-storyboard';
import type { AICommentaryResponse } from '@/lib/vision-board/types';

const RequestSchema = z.object({
  panel: z.enum(['brand', 'storyboard', 'motion', 'copy', 'competitive', 'runbook']),
  payload: z.unknown().optional(),
});

const SYSTEM_PROMPT = `You are an experienced launch reviewer for the Unite-Group portfolio.
The brand under review is RestoreAssist (slug: ra) — Australia's first Australian-designed
full CRM for the restoration industry. The launch is on the App Store as of 2026-05-08.

Critique the supplied panel data on three axes:
1. drift risk (low / medium / high) — how likely is this panel to drift from the locked
   brand voice and positioning?
2. missing pieces — what's not present that should be?
3. surprising observations — what's true here that wasn't obvious?

End with one concrete next step.

Voice rules to enforce:
- never abbreviate "RestoreAssist" to "RA" in voiceover or titles
- forbidden words: leverage, utilise, seamless, powerful, unlock, revolutionary, game-changer,
  world-class, best-in-class, journey, excited, thrilled, delighted
- AI is the assistant (records + documents), not the actor (assesses + diagnoses)
- reading level Grade 4 target, Grade 6 max
- Australian English spellings

Reply ONLY with strict JSON in this exact shape (no prose, no markdown):
{
  "driftRisk": "low" | "medium" | "high",
  "missingPieces": string[],
  "surprisingObservations": string[],
  "recommendedNextStep": string
}`;

function panelData(panel: string): unknown {
  switch (panel) {
    case 'brand':
      return {
        slug: ra.slug,
        tagline: ra.tagline,
        voiceTones: ra.voice.tone,
        forbiddenWordCount: ra.voice.forbiddenWords.length,
        primaryColour: ra.colour.primary,
        readingLevel: ra.pillars?.readingLevel,
        doNot: ra.doNot,
      };
    case 'storyboard':
      return {
        durationSec: NIR_STORYBOARD.totalDurationSec,
        sceneCount: NIR_STORYBOARD.scenes.length,
        scenes: NIR_STORYBOARD.scenes.map(s => ({
          index: s.index,
          onScreenText: s.onScreenText,
          voiceover: s.voiceover,
        })),
      };
    case 'motion':
      return {
        signature: ra.motion.signature,
        durations: ra.motion.durations,
        easing: ra.motion.easing,
      };
    case 'copy':
      return {
        status: 'wave-1-and-3-pending',
        note: 'Pi-CEO has not written positioning/ICP yet. Email + LinkedIn scheduled for Wave 3.',
      };
    case 'competitive':
      return {
        competitors: ['Encircle', 'Xactimate', 'Restorers Connect'],
        ourEdge: '5-step CRM with IICRC-grounded NIR, AU-designed',
      };
    case 'runbook':
      return {
        status: 'wave-4-pending',
        tier: 'standard',
        windowDays: 31,
      };
    default:
      return {};
  }
}

function stubCommentary(panel: AICommentaryResponse['panel']): AICommentaryResponse {
  // Deterministic fallback when ANTHROPIC_API_KEY is missing. The user still sees
  // a structured response with sensible content — they just don't get a fresh model run.
  const map: Record<AICommentaryResponse['panel'], Omit<AICommentaryResponse, 'panel' | 'generatedAt'>> = {
    brand: {
      driftRisk: 'low',
      missingPieces: [
        'No live ElevenLabs voice sample — only the voiceId. Adding a 5-second preview clip would let the reviewer hear what the launch will sound like.',
      ],
      surprisingObservations: [
        'The dark variant flips primary from candy orange (#E55A2B) to teal (#16B5B3). Anyone designing a dark-mode landing page needs to know that.',
      ],
      recommendedNextStep:
        'Render a 5-second ElevenLabs Sarah preview clip and embed it in the Brand panel.',
    },
    storyboard: {
      driftRisk: 'low',
      missingPieces: [
        'No B-roll callouts for scenes 1 and 3 — the visual notes describe outcomes, not specific shots.',
      ],
      surprisingObservations: [
        'Scene 4 carries the entire 5-step claim in 18s. That is the only scene where the operational benefit ("no double-handling") appears verbatim.',
      ],
      recommendedNextStep:
        'Confirm scene 4 visual treatment with the designer skill before queueing the render.',
    },
    motion: {
      driftRisk: 'low',
      missingPieces: ['Spring-physics demo not implemented — only the sweep is previewed.'],
      surprisingObservations: [
        'Transition is 14 frames but base scene reveal is 18 frames — transitions are tighter than scenes by design.',
      ],
      recommendedNextStep:
        'Add a spring-physics preview alongside the sweep so the designer can compare both.',
    },
    copy: {
      driftRisk: 'high',
      missingPieces: [
        'Positioning markdown',
        'ICP markdown',
        'Insurer landing copy',
        '5-touch email sequence',
        '12-piece LinkedIn drumbeat',
      ],
      surprisingObservations: [
        'The Vision Board page exists before any copy artefact — the eyes layer is ahead of the brain layer.',
      ],
      recommendedNextStep:
        'Approve the spawn-task to kick off Pi-CEO Wave 1 (positioning + ICP).',
    },
    competitive: {
      driftRisk: 'medium',
      missingPieces: [
        'No pricing data on competitors',
        'No installed-base / market-share figures',
        'No insurer-network coverage comparison',
      ],
      surprisingObservations: [
        'RestoreAssist is the only competitor with a 5-step workflow — every other tool is a single slice.',
      ],
      recommendedNextStep:
        'Have Pi-CEO research lead pull pricing + installed-base data for the three competitors.',
    },
    runbook: {
      driftRisk: 'high',
      missingPieces: [
        'Per-day drops',
        'Owners',
        'Gate checks',
        'Contingencies',
        'UTM scheme',
      ],
      surprisingObservations: [
        'T+0 is today (2026-05-08) — the App Store work shipped before the marketing runbook was written. T-30→T-0 is retroactive.',
      ],
      recommendedNextStep:
        'Generate the runbook in Wave 4 against the locked Standard tier (LinkedIn organic + email + 2 industry pitches).',
    },
  };
  return {
    panel,
    ...map[panel],
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  // 1. Auth — owner-only
  const auth = await verifyAdmin(req);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorised' },
      { status: 401 }
    );
  }

  // 2. Parse + validate
  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { panel } = parsed.data;

  // 3. If no API key, fall back to deterministic stub.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(stubCommentary(panel), { status: 200 });
  }

  // 4. Real Gemini 3.1 Pro call
  try {
    const userPrompt = JSON.stringify(
      { panel, data: panelData(panel) },
      null,
      2
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.4,
          },
        }),
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const d = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string; thought?: boolean }>;
        };
      }>;
    };
    const rawParts = d?.candidates?.[0]?.content?.parts ?? [];
    const text = rawParts
      .filter(p => !p.thought)
      .map(p => p.text ?? '')
      .join('')
      .trim();

    if (!text) throw new Error('Gemini returned empty response');

    // Strip any accidental code fences.
    const cleanedJson = text.replace(/^```(?:json)?\n?|\n?```$/g, '');
    const parsedResponse = JSON.parse(cleanedJson) as Omit<
      AICommentaryResponse,
      'panel' | 'generatedAt'
    >;

    const result: AICommentaryResponse = {
      panel,
      driftRisk: parsedResponse.driftRisk,
      missingPieces: parsedResponse.missingPieces ?? [],
      surprisingObservations: parsedResponse.surprisingObservations ?? [],
      recommendedNextStep: parsedResponse.recommendedNextStep,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // On any error, fall back to the stub so the UI never breaks.
    const stub = stubCommentary(panel);
    return NextResponse.json(
      {
        ...stub,
        recommendedNextStep:
          stub.recommendedNextStep +
          ' (note: Gemini call failed — showing stub. ' +
          (err instanceof Error ? err.message : 'unknown error') +
          ')',
      },
      { status: 200 }
    );
  }
}
