/**
 * Margot short: template to word-timed captions, beat plan and avatar job.
 *
 * Adapted from Hypit (hypit-ai/hypit, modified Apache 2.0), commit e26d914.
 * The flow follows Hypit's order of work (script, speech, word alignment,
 * captions, render) but every provider is injected, so tests and dry runs make
 * no paid call. Compositing the beat plan (picture-in-picture, split screen,
 * visual inserts) is the next step and is not done here.
 *
 * Order matters for spend: configuration and the footage-first check run
 * before ElevenLabs, and the check runs again on real timings before HeyGen.
 */
import type {
  HeyGenAvatarVideoJob,
  HeyGenAvatarVideoRequest,
  HeyGenConsentMetadata,
} from '../../marketing-agency/heygen/types';
import {
  assertBeatsMatchScript,
  checkBeatPlan,
  planBeats,
  resolveMargot,
  swapSlots,
  type BeatPlanCheck,
  type PlannedBeat,
  type ViralFormatTemplate,
} from './format-template';
import { parseAnchoredScript } from './anchored-script';
import { buildCaptionCues, scheduleCues, toAss } from './karaoke-captions';
import {
  charactersToWords,
  timeScriptWords,
  type CharacterAlignment,
  type WordTiming,
} from './word-timing';

export interface SpeakResult {
  success: boolean;
  audioBase64?: string;
  contentType?: string;
  /** ElevenLabs /with-timestamps alignment. */
  alignment?: CharacterAlignment;
  error?: string;
}

export interface MargotShortDeps {
  /** ElevenLabs text-to-speech with timestamps. */
  speak: (opts: { text: string; voiceId: string }) => Promise<SpeakResult>;
  uploadAudio: (audioBase64: string, contentType: string) => Promise<string>;
  heygen: {
    createAvatarVideo: (
      r: HeyGenAvatarVideoRequest
    ) => Promise<HeyGenAvatarVideoJob>;
  };
}

export interface MargotShortInput {
  template: ViralFormatTemplate;
  slots?: Record<string, string>;
  env?: Record<string, string | undefined>;
  consent: HeyGenConsentMetadata | null;
  title?: string;
}

export interface ManifestStep {
  provider: 'elevenlabs' | 'heygen';
  /** Metered units: characters for ElevenLabs, seconds of audio for HeyGen. */
  units: number;
  unitName: 'characters' | 'seconds';
  /** Not priced here: read spend from the provider's own usage endpoint. */
  estimatedCostUsd: null;
  jobId?: string;
  status: string;
}

export interface MargotShortResult {
  spokenText: string;
  timings: WordTiming[];
  ass: string;
  plan: PlannedBeat[];
  check: BeatPlanCheck;
  heygen: HeyGenAvatarVideoJob;
  manifest: { templateId: string; host: string; steps: ManifestStep[] };
}

const PORTRAIT = { width: 1080, height: 1920 };
const GUESS_SECONDS_PER_WORD = 0.4;

export async function buildMargotShort(
  input: MargotShortInput,
  deps: MargotShortDeps
): Promise<MargotShortResult> {
  const margot = resolveMargot(input.env ?? process.env);
  if (!input.consent) {
    throw new Error(
      'HeyGen consent is missing; refusing to spend on speech first'
    );
  }
  const filled = swapSlots(input.template, input.slots ?? {});
  if (filled.host !== 'margot') {
    throw new Error(
      `Host "${filled.host}" has no voice or avatar configured; only Margot is supported`
    );
  }
  const script = parseAnchoredScript(filled.script);
  assertBeatsMatchScript(filled.beats, script);

  // Free check on estimated timing, before any paid call.
  const guess: WordTiming[] = script.words.map(w => ({
    index: w.index,
    text: w.text,
    start: w.index * GUESS_SECONDS_PER_WORD,
    end: (w.index + 1) * GUESS_SECONDS_PER_WORD,
    estimated: true,
  }));
  const early = checkBeatPlan(planBeats(filled.beats, script.anchors, guess));
  if (!early.ok)
    throw new Error(
      `Beat plan rejected before any paid call: ${early.issues.join('; ')}`
    );

  const speech = await deps.speak({
    text: script.spokenText,
    voiceId: margot.voiceId,
  });
  if (!speech.success || !speech.audioBase64) {
    throw new Error(
      `Voice generation failed: ${speech.error ?? 'no audio returned'}`
    );
  }
  if (!speech.alignment)
    throw new Error('Voice generation returned no word timestamps');

  const timings = timeScriptWords(
    script.words,
    charactersToWords(speech.alignment)
  );
  const evidence = charactersToWords(speech.alignment);
  const audioEnd = Math.max(
    ...evidence.map(w => w.end),
    ...timings.map(t => t.end)
  );
  const plan = planBeats(filled.beats, script.anchors, timings, audioEnd);
  const check = checkBeatPlan(plan);
  if (!check.ok)
    throw new Error(
      `Beat plan rejected before HeyGen render: ${check.issues.join('; ')}`
    );

  const ass = toAss(scheduleCues(buildCaptionCues(timings, script.cueStarts)));
  const audioUrl = await deps.uploadAudio(
    speech.audioBase64,
    speech.contentType ?? 'audio/mpeg'
  );
  // An empty URL would make HeyGen fall back to its own text-to-speech voice,
  // which is not Margot's. Stop before the render.
  if (!audioUrl || !audioUrl.trim()) {
    throw new Error(
      'Audio URL is empty; refusing a HeyGen render with a stand-in voice'
    );
  }
  const heygen = await deps.heygen.createAvatarVideo({
    avatarId: margot.avatarId,
    audioUrl,
    consent: input.consent,
    dimension: PORTRAIT,
    title: input.title,
  });

  const seconds = audioEnd;
  return {
    spokenText: script.spokenText,
    timings,
    ass,
    plan,
    check,
    heygen,
    manifest: {
      templateId: filled.id,
      host: filled.host,
      steps: [
        {
          provider: 'elevenlabs',
          units: script.spokenText.length,
          unitName: 'characters',
          estimatedCostUsd: null,
          status: 'done',
        },
        {
          provider: 'heygen',
          units: Math.round(seconds * 10) / 10,
          unitName: 'seconds',
          estimatedCostUsd: null,
          jobId: heygen.id,
          status: heygen.status,
        },
      ],
    },
  };
}
