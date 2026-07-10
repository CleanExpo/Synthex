import {
  IMAGE_MODELS,
  selectImageModel,
} from '@/lib/services/ai/image/registry';

describe('image model registry', () => {
  it('includes a grounding-capable FLUX.2 pro entry on fal', () => {
    const flux = IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2-pro');
    expect(flux).toBeDefined();
    expect(flux!.provider).toBe('fal');
    expect(flux!.grounding).toBe(true);
    expect(flux!.capabilities.referenceImages).toBeGreaterThanOrEqual(1);
  });

  it('selects a grounding model when references are needed', () => {
    const m = selectImageModel({ needsReferences: true });
    expect(m.grounding).toBe(true);
    expect(m.deprecated).not.toBe(true);
    expect(m.id).toBe('fal-ai/flux-2-pro');
  });

  it('never selects a deprecated model for grounding', () => {
    const m = selectImageModel({
      needsReferences: true,
      preferred: 'stability',
    });
    expect(m.grounding).toBe(true);
  });
});
