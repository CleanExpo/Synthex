import {
  VIDEO_MODELS,
  resolveModel,
  estimateCostUsd,
} from '@/lib/services/ai/video/registry';

// fal endpoints that are retired or announced for retirement. Ids stay listed
// after removal so a re-add fails here. fal-ai/veo3.1: fal shutdown 2026-11-17.
const RETIRED_VIDEO_MODEL_IDS = ['fal-ai/veo3.1'];

describe('video model registry', () => {
  it('has at least one model per tier with a capability profile', () => {
    for (const tier of ['draft', 'standard', 'premium'] as const) {
      const models = VIDEO_MODELS.filter(m => m.tier === tier);
      expect(models.length).toBeGreaterThan(0);
      for (const m of models) {
        expect(m.strengths.length).toBeGreaterThan(0);
        expect(m.weaknesses.length).toBeGreaterThan(0);
        expect(m.bestFor).toBeTruthy();
        expect(m.costPerSecondUsd).toBeGreaterThan(0);
      }
    }
  });

  it('resolves draft tier to the cheapest matching model', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
    });
    expect(m.tier).toBe('draft');
    const draftCosts = VIDEO_MODELS.filter(x => x.tier === 'draft').map(
      x => x.costPerSecondUsd
    );
    expect(m.costPerSecondUsd).toBe(Math.min(...draftCosts));
  });

  it('routes audio-on requests to a supportsAudio model within the tier', () => {
    const m = resolveModel('premium', {
      aspectRatio: '16:9',
      durationSeconds: 6,
      audio: true,
    });
    expect(m.supportsAudio).toBe(true);
    expect(m.tier).toBe('premium');
  });

  it('routes image-input requests to a supportsImageInput model', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
      requiresImage: true,
    });
    expect(m.supportsImageInput).toBe(true);
  });

  it('throws a clear error when duration exceeds the tier maximum', () => {
    expect(() =>
      resolveModel('draft', { aspectRatio: '9:16', durationSeconds: 600 })
    ).toThrow(/duration/i);
  });

  it('estimates cost as duration x per-second rate', () => {
    const m = resolveModel('draft', {
      aspectRatio: '9:16',
      durationSeconds: 6,
    });
    expect(estimateCostUsd(m, 6)).toBeCloseTo(m.costPerSecondUsd * 6, 4);
  });

  it('carries no retired fal endpoint', () => {
    const ids = VIDEO_MODELS.map(m => m.id);
    for (const retired of RETIRED_VIDEO_MODEL_IDS) {
      expect(ids).not.toContain(retired);
    }
  });

  it.each(['9:16', '16:9', '1:1'] as const)(
    'routes premium %s + audio + image to Kling 3 Pro',
    aspectRatio => {
      const m = resolveModel('premium', {
        aspectRatio,
        durationSeconds: 8,
        audio: true,
        requiresImage: true,
      });
      expect(m.name).toBe('Kling 3 Pro');
    }
  );

  it('routes premium 1:1 + audio to Kling', () => {
    const m = resolveModel('premium', {
      aspectRatio: '1:1',
      durationSeconds: 6,
      audio: true,
    });
    expect(m.name).toBe('Kling 3 Pro');
  });
});
