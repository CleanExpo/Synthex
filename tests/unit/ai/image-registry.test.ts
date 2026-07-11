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

  it('includes a loras-capable FLUX.2 dev LoRA entry on fal', () => {
    const lora = IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2/lora');
    expect(lora).toBeDefined();
    expect(lora!.provider).toBe('fal');
    expect(lora!.loras).toBe(true);
    expect(lora!.grounding).toBe(true);
    expect(lora!.deprecated).not.toBe(true);
  });

  it('marks all pre-existing models loras: false', () => {
    const preexisting = IMAGE_MODELS.filter(m => m.id !== 'fal-ai/flux-2/lora');
    expect(preexisting.length).toBeGreaterThan(0);
    for (const m of preexisting) {
      expect(m.loras).toBe(false);
    }
  });

  it('selects the loras-capable model when needsLora is true', () => {
    const m = selectImageModel({ needsReferences: false, needsLora: true });
    expect(m.id).toBe('fal-ai/flux-2/lora');
    expect(m.loras).toBe(true);
  });

  it('NEVER returns the loras entry for needsReferences (regression)', () => {
    const m = selectImageModel({ needsReferences: true });
    expect(m.loras).toBe(false);
    expect(m.id).toBe('fal-ai/flux-2-pro');
  });

  it('the default (no needsReferences/needsLora/preferred) path excludes the loras entry', () => {
    const m = selectImageModel({ needsReferences: false });
    expect(m.loras).toBe(false);
  });

  it('excludes the loras entry even when explicitly preferred without needsLora', () => {
    const m = selectImageModel({
      needsReferences: false,
      preferred: 'fal-ai/flux-2/lora',
    });
    expect(m.loras).toBe(false);
  });
});
