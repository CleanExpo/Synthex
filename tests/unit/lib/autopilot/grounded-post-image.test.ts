/**
 * Unit tests for the autopilot grounded-image attachment helper.
 *
 * Enforces the dark-safety invariant (docs/specs/autopilot-grounded-images.md §2):
 * a scheduled autonomous post only keeps status 'scheduled' when a real GROUNDED
 * image is produced; any block/failure/ungrounded outcome downgrades the post to
 * 'draft' and attaches NO image (never a placeholder/stock/ungrounded URL).
 */

import { attachGroundedImage } from '@/lib/autopilot/grounded-post-image';
import type { ImageGenerationResult } from '@/lib/services/ai/image-generation';

const baseInput = {
  businessName: 'CCW Carpet Cleaning',
  industry: 'carpet-cleaning',
  offerings: ['carpet steam cleaning', 'stain removal'],
  theme: 'promotional' as const,
  platform: 'instagram',
  orgId: 'org-1',
  userId: 'user-1',
  runId: 'run-1',
};

function fakeGen(result: ImageGenerationResult) {
  return jest.fn().mockResolvedValue(result);
}

describe('attachGroundedImage — dark-safety invariant', () => {
  it('(a) grounded success attaches the image and keeps status scheduled', async () => {
    const gen = fakeGen({
      success: true,
      provider: 'stability',
      imageUrl: 'https://fal.media/files/real.png',
      grounded: true,
      referenceSet: 'carpet-cleaning',
      refCount: 4,
    });

    const out = await attachGroundedImage(baseInput, { generateImage: gen });

    expect(gen).toHaveBeenCalledTimes(1);
    expect(out.images).toEqual(['https://fal.media/files/real.png']);
    expect(out.status).toBe('scheduled');
    expect(out.meta.imageGrounded).toBe(true);
    expect(out.meta.imageReferenceSet).toBe('carpet-cleaning');
    expect(out.meta.imageRefCount).toBe(4);
    expect(out.meta.imageBlocked).toBeUndefined();
  });

  it('(b) blocked (no owned refs) downgrades to draft with NO image', async () => {
    const gen = fakeGen({
      success: false,
      provider: 'stability',
      grounded: false,
      blocked: true,
      error:
        'No owned references for this subject — add real photos to the reference library first.',
    });

    const out = await attachGroundedImage(baseInput, { generateImage: gen });

    expect(out.images).toEqual([]);
    expect(out.status).toBe('draft');
    expect(out.meta.imageBlocked).toBe(true);
    expect(out.meta.downgradeReason).toBe('image-blocked');
    expect(out.meta.imageBlockReason).toContain('No owned references');
  });

  it('(c) plain failure downgrades to draft with NO image', async () => {
    const gen = fakeGen({
      success: false,
      provider: 'stability',
      error: 'Grounded generation failed after retry: network',
    });

    const out = await attachGroundedImage(baseInput, { generateImage: gen });

    expect(out.images).toEqual([]);
    expect(out.status).toBe('draft');
    expect(out.meta.imageGrounded).toBe(false);
    expect(out.meta.downgradeReason).toBe('image-blocked');
  });

  it('(d) ungrounded success is treated as non-grounded — draft, NO image', async () => {
    const gen = fakeGen({
      success: true,
      provider: 'gemini',
      imageUrl: 'https://example.com/ungrounded.png',
      grounded: false,
    });

    const out = await attachGroundedImage(baseInput, { generateImage: gen });

    expect(out.images).toEqual([]);
    expect(out.status).toBe('draft');
  });

  it('never passes the useReferences escape hatch or a provider pin', async () => {
    const gen = fakeGen({
      success: true,
      provider: 'stability',
      imageUrl: 'https://fal.media/files/x.png',
      grounded: true,
    });

    await attachGroundedImage(baseInput, { generateImage: gen });

    const options = gen.mock.calls[0][0];
    expect(options.useReferences).toBeUndefined();
    expect(options.provider).toBeUndefined();
    // Context is the autonomous system context (never request-derived).
    const ctx = gen.mock.calls[0][1];
    expect(ctx.autonomyLevel).toBe('autonomous');
    expect(ctx.organizationId).toBe('org-1');
    expect(ctx.userId).toBe('user-1');
  });
});
