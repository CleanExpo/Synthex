/**
 * Vision Board — shared types
 *
 * SYN-923 (Vision Board UI). The Vision Board is the Synthex-side review surface
 * over Pi-CEO's research output. It reads symlinked artefacts from
 * `.claude/external-research/pi-ceo/marketing-studio/.research/` server-side
 * and hydrates 7 panels client-side.
 */

export type WaveStatus = 'pending' | 'in-progress' | 'ready' | 'blocked';

export interface WaveState {
  wave: 0 | 1 | 2 | 3 | 4;
  status: WaveStatus;
  artefactPath?: string;       // path inside the symlinked Pi-CEO research dir
  lastUpdated?: string;         // ISO date
  note?: string;
}

export interface StoryboardScene {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  onScreenText: string;
  voiceover: string;
  visualNote: string;            // brief description of what's on screen
}

export interface NIRStoryboard {
  jobId: string;
  brand: 'ra';
  composition: 'Explainer';
  channel: 'linkedin';
  aspectRatio: '1920x1080';
  totalDurationSec: 90;
  voiceId: string;
  topic: string;
  scenes: StoryboardScene[];
}

export interface VoiceEnforceScore {
  passed: boolean;
  forbiddenWordHits: string[];
  readingLevelGrade: number;
  australianEnglishOk: boolean;
  raAbbreviationCount: number;        // count of "RA" abbreviations — must be 0
  aiAsActorPhrases: string[];          // AI written as actor not assistant
  notes: string[];
}

export interface AICommentaryRequest {
  panel: 'brand' | 'storyboard' | 'motion' | 'copy' | 'competitive' | 'runbook';
  payload: unknown;                    // panel data to critique
}

export interface AICommentaryResponse {
  panel: AICommentaryRequest['panel'];
  driftRisk: 'low' | 'medium' | 'high';
  missingPieces: string[];
  surprisingObservations: string[];
  recommendedNextStep: string;
  generatedAt: string;
}
