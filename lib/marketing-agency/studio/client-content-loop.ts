/**
 * Client Content Studio — per-client content loop (SYN-1005 / VS-3 + VS-4 + VS-5).
 *
 * Encodes the autonomous-but-gated loop:
 *   prepareClientUpdate  → topic+script (content-generator) → avatar video (ElevenLabs+HeyGen)
 *                          → DRAFT with status 'awaiting_approval'  (NOTHING is published)
 *   [ human approval ]
 *   publishApprovedUpdate → HARD GATE: refuses to publish unless approved → one-source→many-surfaces
 *                          → measure (ClientEngagementEvent)
 *
 * All side-effecting collaborators are injected (script gen, avatar gen, persistence,
 * publish, measurement) so the loop is pure and unit-testable, and so the orchestrator
 * never couples to a browser-only or singleton dependency.
 */

import type { HeyGenAvatarVideoJob, HeyGenConsentMetadata } from '../heygen/types';

export interface ClientStudioConfig {
  clientSlug: string;
  displayName: string;
  avatarId: string;
  voiceId: string;
  /** Likeness consent — required (HeyGen enforces it downstream). */
  consent: HeyGenConsentMetadata;
  /** Distribution targets for the pilot (e.g. ['linkedin','youtube']). */
  platforms: string[];
  dimension?: { width: number; height: number };
}

/** Signals the script generator draws on (project activity, health dimensions, etc.). */
export interface StudioContext {
  topicHint?: string;
  [key: string]: unknown;
}

export interface ScriptResult {
  topic: string;
  script: string;
}

export interface StudioDraft {
  clientSlug: string;
  topic: string;
  script: string;
  video: HeyGenAvatarVideoJob;
  platforms: string[];
  status: 'awaiting_approval';
}

export interface PrepareDeps {
  generateScript: (
    config: ClientStudioConfig,
    ctx: StudioContext
  ) => Promise<ScriptResult>;
  generateAvatarVideo: (input: {
    avatarId: string;
    script: string;
    consent: HeyGenConsentMetadata | null;
    voiceId?: string;
    dimension?: { width: number; height: number };
    title?: string;
  }) => Promise<HeyGenAvatarVideoJob>;
  /** Optional persistence of the draft for the approval queue / dashboard. */
  persistDraft?: (draft: StudioDraft) => Promise<void>;
}

export interface Approval {
  approved: boolean;
  approvedBy?: string;
  note?: string;
}

export class NotApprovedError extends Error {
  constructor(clientSlug: string) {
    super(`Refusing to publish ${clientSlug} update: human approval not granted.`);
    this.name = 'NotApprovedError';
  }
}

export interface PublishDeps {
  publish: (args: {
    clientSlug: string;
    platform: string;
    videoUrl: string;
    script: string;
    topic: string;
  }) => Promise<{ platform: string; postId?: string }>;
  /** Optional measurement hook (server-side ClientEngagementEvent emit). */
  emitEvent?: (evt: {
    clientSlug: string;
    platform: string;
    topic: string;
    eventType: string;
  }) => Promise<void>;
}

export interface PublishResult {
  clientSlug: string;
  topic: string;
  published: Array<{ platform: string; postId?: string }>;
}

/**
 * Autonomous half: produce a ready-for-review draft. Generates the script, renders the
 * avatar video, and returns a draft in `awaiting_approval`. **Never publishes.**
 */
export async function prepareClientUpdate(
  config: ClientStudioConfig,
  ctx: StudioContext,
  deps: PrepareDeps
): Promise<StudioDraft> {
  const { topic, script } = await deps.generateScript(config, ctx);

  const video = await deps.generateAvatarVideo({
    avatarId: config.avatarId,
    script,
    consent: config.consent,
    voiceId: config.voiceId,
    dimension: config.dimension,
    title: `${config.displayName}: ${topic}`,
  });

  const draft: StudioDraft = {
    clientSlug: config.clientSlug,
    topic,
    script,
    video,
    platforms: config.platforms,
    status: 'awaiting_approval',
  };

  if (deps.persistDraft) await deps.persistDraft(draft);
  return draft;
}

/**
 * Gated half: publish an approved draft to every target platform and emit a
 * measurement event per surface. **Hard gate** — throws NotApprovedError (and
 * publishes nothing) unless `approval.approved` is true; requires a rendered video URL.
 */
export async function publishApprovedUpdate(
  draft: StudioDraft,
  approval: Approval,
  deps: PublishDeps
): Promise<PublishResult> {
  if (!approval.approved) {
    throw new NotApprovedError(draft.clientSlug);
  }
  if (!draft.video.videoUrl) {
    throw new Error(
      `Cannot publish ${draft.clientSlug} update: avatar video has not finished rendering.`
    );
  }

  const published: Array<{ platform: string; postId?: string }> = [];
  for (const platform of draft.platforms) {
    const result = await deps.publish({
      clientSlug: draft.clientSlug,
      platform,
      videoUrl: draft.video.videoUrl,
      script: draft.script,
      topic: draft.topic,
    });
    published.push({ platform: result.platform ?? platform, postId: result.postId });
    if (deps.emitEvent) {
      await deps.emitEvent({
        clientSlug: draft.clientSlug,
        platform,
        topic: draft.topic,
        eventType: 'client_video_published',
      });
    }
  }

  return { clientSlug: draft.clientSlug, topic: draft.topic, published };
}
