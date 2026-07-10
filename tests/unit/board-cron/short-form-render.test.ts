/**
 * SYN-500 Phase 4 — short-form render pipeline + social publish builders.
 *
 * Exercises the pure, un-gated logic: vertical scene selection/re-timing, SRT
 * caption generation, per-platform copy, and the honest gated-publish plan.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  resolveShortFormScenes,
  selectShortFormScenes,
  shortFormTotalFrames,
  SHORT_FORM_SCENE_TYPES,
} from '../../../board-cron/remotion/src/lib/resolve-short-scenes';
import {
  resolveScenes,
  FPS,
} from '../../../board-cron/remotion/src/lib/resolve-scenes';
import {
  buildSrt,
  buildCaptionCues,
  framesToSrtTimestamp,
  captionAtFrame,
} from '../../../board-cron/remotion/src/lib/srt';
import type {
  BoardScript,
  PersonaManifest,
} from '../../../board-cron/remotion/src/lib/types';
import {
  extractBeats,
  buildSocialPayloads,
  resolvePublishPlan,
  type PublishEnv,
} from '../../../board-cron/scripts/publish-social';

const REMOTION_SRC = path.resolve(
  __dirname,
  '../../../board-cron/remotion/src'
);

const script = JSON.parse(
  readFileSync(
    path.join(REMOTION_SRC, 'data/session-23-client-journey.json'),
    'utf8'
  )
) as BoardScript;
const manifest = JSON.parse(
  readFileSync(
    path.join(REMOTION_SRC, 'assets/personas/persona-manifest.json'),
    'utf8'
  )
) as PersonaManifest;

describe('short-form scene selection (4a)', () => {
  const shortScenes = resolveShortFormScenes(script, manifest);

  it('keeps only decision / next-actions / closing payoff beats', () => {
    expect(shortScenes.length).toBeGreaterThan(0);
    for (const scene of shortScenes) {
      expect(SHORT_FORM_SCENE_TYPES.has(scene.type)).toBe(true);
    }
    // Must include the decision, the next actions, and the closing CTA.
    const types = shortScenes.map(s => s.type);
    expect(types).toEqual(
      expect.arrayContaining(['decision', 'next_actions', 'closing'])
    );
    // And must NOT include long-form deliberation.
    expect(types).not.toContain('deliberation');
  });

  it('re-bases to frame 0 with monotonic, non-overlapping timing', () => {
    expect(shortScenes[0].startFrame).toBe(0);
    for (let i = 1; i < shortScenes.length; i++) {
      const prev = shortScenes[i - 1];
      const cur = shortScenes[i];
      expect(cur.startFrame).toBeGreaterThanOrEqual(
        prev.startFrame + prev.durationFrames
      );
    }
  });

  it('lands within the vertical Reel/Short budget (40-75s)', () => {
    const totalSeconds = shortFormTotalFrames(shortScenes) / FPS;
    expect(totalSeconds).toBeGreaterThanOrEqual(40);
    expect(totalSeconds).toBeLessThanOrEqual(75);
  });

  it('caps a long long-form beat below its natural duration', () => {
    const full = resolveScenes(script, manifest);
    const shortSel = selectShortFormScenes(full);
    const fullBody = full.find(s => s.type === 'decision_body');
    const shortBody = shortSel.find(s => s.type === 'decision_body');
    expect(fullBody).toBeDefined();
    expect(shortBody).toBeDefined();
    // session-23 decision body is ~200 words (>60s); the short cut caps it.
    expect(shortBody!.durationFrames).toBeLessThan(fullBody!.durationFrames);
    expect(shortBody!.durationFrames).toBeLessThanOrEqual(25 * FPS);
  });
});

describe('SRT caption generation (4a burned-in captions)', () => {
  const shortScenes = resolveShortFormScenes(script, manifest);

  it('produces well-formed, sequential SRT cues', () => {
    const cues = buildCaptionCues(shortScenes);
    expect(cues.length).toBeGreaterThan(0);
    cues.forEach((cue, i) => {
      expect(cue.index).toBe(i + 1);
      expect(cue.endFrame).toBeGreaterThan(cue.startFrame);
      if (i > 0) {
        expect(cue.startFrame).toBeGreaterThanOrEqual(cues[i - 1].startFrame);
      }
    });
  });

  it('renders a valid SRT document with HH:MM:SS,mmm timestamps', () => {
    const srt = buildSrt(shortScenes, FPS);
    expect(srt).toMatch(/^1\n00:00:00,000 --> \d{2}:\d{2}:\d{2},\d{3}\n/);
    expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
  });

  it('formats frame timestamps correctly', () => {
    expect(framesToSrtTimestamp(0, 30)).toBe('00:00:00,000');
    expect(framesToSrtTimestamp(30, 30)).toBe('00:00:01,000');
    expect(framesToSrtTimestamp(45, 30)).toBe('00:00:01,500');
    expect(framesToSrtTimestamp(30 * 65, 30)).toBe('00:01:05,000');
  });

  it('returns the active caption for a mid-scene frame', () => {
    const cues = buildCaptionCues(shortScenes);
    const mid = cues[0];
    const at = captionAtFrame(cues, mid.startFrame + 1);
    expect(at).toBe(mid.text);
    expect(captionAtFrame(cues, -5)).toBeNull();
  });
});

describe('social publish copy builders (4b)', () => {
  const youtubeUrl = 'https://youtu.be/TEST123';
  const payloads = buildSocialPayloads(script, { youtubeUrl });

  it('extracts the decision, next-actions, and risk beats', () => {
    const beats = extractBeats(script);
    expect(beats.session).toBe(23);
    expect(beats.decisionOneLiner.length).toBeGreaterThan(10);
    expect(beats.nextActions.length).toBe(3);
    expect(beats.risk.length).toBeGreaterThan(0);
  });

  it('builds an Instagram caption with hashtags and the YouTube link', () => {
    expect(payloads.instagram.caption).toContain('Session 23');
    expect(payloads.instagram.caption).toContain(youtubeUrl);
    expect(payloads.instagram.hashtags).toEqual(
      expect.arrayContaining(['#Synthex'])
    );
  });

  it('builds a LinkedIn body with DECISION and next actions', () => {
    expect(payloads.linkedin.body).toContain('DECISION:');
    expect(payloads.linkedin.body).toContain('Next actions:');
    expect(payloads.linkedin.body).toContain(youtubeUrl);
  });

  it('builds a 3-tweet thread, each within 280 chars', () => {
    expect(payloads.twitter.tweets).toHaveLength(3);
    for (const tweet of payloads.twitter.tweets) {
      expect(tweet.length).toBeLessThanOrEqual(280);
    }
    expect(payloads.twitter.tweets[0]).toContain(youtubeUrl);
    expect(payloads.twitter.tweets[2]).toContain('Next session in 6 hours');
  });
});

describe('gated publish plan — honest state, no fake success (4b/4c)', () => {
  const payloads = buildSocialPayloads(script, {
    youtubeUrl: 'https://youtu.be/X',
  });

  it('gates every platform when no OAuth / endpoint is configured', () => {
    const plan = resolvePublishPlan(payloads, {} as PublishEnv);
    expect(plan).toHaveLength(3);
    for (const result of plan) {
      expect(result.status).toBe('gated');
      expect(result.published).toBe(false);
      expect(result.postUrl).toBeUndefined();
      expect(result.reason.length).toBeGreaterThan(0);
    }
    // Instagram must cite the Meta OAuth blocker (SYN-1054).
    const ig = plan.find(r => r.platform === 'instagram');
    expect(ig!.reason).toMatch(/Meta OAuth/i);
  });

  it('marks platforms ready only when endpoint + token + OAuth are all present', () => {
    const env: PublishEnv = {
      appUrl: 'https://app.example.com',
      publishToken: 'tok',
      metaOAuthReady: true,
      linkedinOAuthReady: true,
      twitterOAuthReady: true,
    };
    const plan = resolvePublishPlan(payloads, env);
    for (const result of plan) {
      expect(result.status).toBe('ready');
      // "ready" still is NOT "published" — publishing requires the real call.
      expect(result.published).toBe(false);
      expect(result.postUrl).toBeUndefined();
    }
  });

  it('gates a platform whose OAuth is missing even if the endpoint is set', () => {
    const env: PublishEnv = {
      appUrl: 'https://app.example.com',
      publishToken: 'tok',
      metaOAuthReady: false,
      linkedinOAuthReady: true,
      twitterOAuthReady: true,
    };
    const plan = resolvePublishPlan(payloads, env);
    expect(plan.find(r => r.platform === 'instagram')!.status).toBe('gated');
    expect(plan.find(r => r.platform === 'linkedin')!.status).toBe('ready');
  });
});
