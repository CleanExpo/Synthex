/**
 * Unit tests for the Artlist asset-need detector (SYN-979).
 *
 * Pure function — no prisma, no network. Asserts the audio/video keyword
 * heuristic, video precedence, mood derivation, and the no-need default.
 */
import { detectAssetNeed } from '@/lib/marketing-agency/artlist/need';

describe('detectAssetNeed', () => {
  test('flags a video need and derives assetType=video (video takes precedence)', () => {
    const need = detectAssetNeed({
      title: 'Launch a LinkedIn reel',
      recommendation: 'Cut a 30s video with an upbeat soundtrack',
      nextAction: 'Storyboard the clip',
    });
    expect(need.needsAsset).toBe(true);
    expect(need.assetType).toBe('video');
    expect(need.mood).toBe('energetic');
    expect(need.durationSec).toBeGreaterThan(0);
    expect(need.matchedKeyword).not.toBeNull();
  });

  test('flags an audio-only need when no video surface is mentioned', () => {
    const need = detectAssetNeed({
      title: 'Podcast intro refresh',
      recommendation: 'Commission a calm background music bed',
    });
    expect(need.needsAsset).toBe(true);
    expect(need.assetType).toBe('audio');
    expect(need.mood).toBe('calm');
  });

  test('returns no need for a text/claim-only opportunity', () => {
    const need = detectAssetNeed({
      title: 'DR job-evidence story',
      recommendation: 'Lead with a job evidence photo and timeline',
      nextAction: 'Link the source report',
    });
    expect(need.needsAsset).toBe(false);
    expect(need.matchedKeyword).toBeNull();
  });

  test('falls back to the default mood when no mood keyword is present', () => {
    const need = detectAssetNeed({
      title: 'YouTube explainer',
      recommendation: 'Produce a short animation',
    });
    expect(need.needsAsset).toBe(true);
    expect(need.assetType).toBe('video');
    expect(need.mood).toBe('confident corporate');
  });
});
