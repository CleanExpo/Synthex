/**
 * Retired model defaults (slice 0 of docs/superpowers/specs/2026-10-22-model-registry-design.md).
 *
 * SEAM: the exported default resolvers of the two services, read against the two registries'
 * public APIs (`getModel`/`isModelAvailable`, `IMAGE_MODELS`/`estimateImageCostUsd`).
 *   - resolveCampaignImageModel() — lib/services/campaign-concept-studio.ts
 *   - PROVIDER_PRIORITY — lib/services/client-branded-content.ts
 *   - the text registry's deprecation flags for vendor-retired ids.
 * CATCHES: a default that names a retired, deprecated, unregistered or unpriced model; a
 *   registry that still lists a vendor-retired id as available.
 * MISSES: what production env vars override (CAMPAIGN_CONCEPT_IMAGE_MODEL is read at call
 *   time; prod values are not visible here), and whether a registry id is a valid wire id at
 *   the provider (the registry's OpenAI ids are alias-shaped, e.g. 'gpt-4-o-mini').
 *
 * Vendor dates (read 22/10/2026):
 *   https://developers.openai.com/api/docs/deprecations — dall-e-3 shut down 2026-05-12;
 *     gpt-4-turbo-preview (-> gpt-4-0125-preview) shut down 2026-03-26; gpt-4-turbo and
 *     gpt-image-1 shut down 2026-10-23.
 *   https://ai.google.dev/gemini-api/docs/deprecations — gemini-2.0-flash shut down 2026-06-01.
 */

jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/vault/vault-service', () => ({
  VaultService: { getSecret: jest.fn() },
}));

import { getModel, isModelAvailable } from '@/lib/ai/model-registry';
import {
  IMAGE_MODELS,
  estimateImageCostUsd,
} from '@/lib/services/ai/image/registry';
import { resolveCampaignImageModel } from '@/lib/services/campaign-concept-studio';
import { PROVIDER_PRIORITY } from '@/lib/services/client-branded-content';

const RETIRED_IDS = new Set([
  'dall-e-3',
  'dall-e-2',
  'gpt-image-1',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gemini-2-0-flash',
  'google/gemini-2.0-flash',
]);

function assertUsableImageModel(id: string): void {
  expect(RETIRED_IDS.has(id)).toBe(false);
  const entry = IMAGE_MODELS.find(m => m.id === id);
  expect(entry).toBeDefined();
  expect(entry?.deprecated).not.toBe(true);
  expect(entry?.loras).toBe(false);
  // Unpriced means unusable: estimateImageCostUsd throws UnpricedModelError.
  expect(() =>
    estimateImageCostUsd(entry!, { width: 1024, height: 1024 })
  ).not.toThrow();
}

function assertUsableTextModel(
  provider: 'openrouter' | 'anthropic' | 'openai',
  id: string
): void {
  expect(RETIRED_IDS.has(id)).toBe(false);
  expect(getModel(provider, id)).not.toBeNull();
  expect(isModelAvailable(provider, id)).toBe(true);
}

describe('default checks (control: planted failure is caught)', () => {
  it.each([
    'dall-e-3',
    'stable-diffusion-3',
    'gpt-image-1',
    'fal-ai/flux-2/lora',
  ])('image check rejects %s', id => {
    expect(() => assertUsableImageModel(id)).toThrow();
  });

  it.each([
    ['openai', 'gpt-4-turbo-preview'],
    ['openai', 'gpt-4-turbo'],
    ['anthropic', 'claude-3-5-sonnet'],
  ] as const)('text check rejects %s %s', (provider, id) => {
    expect(() => assertUsableTextModel(provider, id)).toThrow();
  });
});

describe('campaign concept studio image default', () => {
  it('resolves to a non-deprecated, priced image-registry model when no override is set', () => {
    assertUsableImageModel(resolveCampaignImageModel(undefined));
  });

  it('does not report a deprecated override (dall-e-3) as the image model', () => {
    assertUsableImageModel(resolveCampaignImageModel('dall-e-3'));
  });

  it('honours an override that names a usable registry model', () => {
    expect(resolveCampaignImageModel('gemini-3-pro-image')).toBe(
      'gemini-3-pro-image'
    );
  });
});

describe('client-branded-content provider defaults', () => {
  it.each(['openrouter', 'anthropic', 'openai'] as const)(
    '%s default is a registered, non-deprecated text model',
    provider => {
      const row = PROVIDER_PRIORITY.find(r => r.provider === provider);
      expect(row).toBeDefined();
      assertUsableTextModel(provider, row!.defaultModel);
    }
  );
});

describe('text registry marks vendor-retired models deprecated', () => {
  it.each([
    ['openai', 'gpt-4-turbo', '2026-10-23'],
    ['google', 'gemini-2-0-flash', '2026-06-01'],
    ['openrouter', 'google/gemini-2.0-flash', '2026-06-01'],
  ] as const)('%s %s is deprecated as of %s', (provider, id, date) => {
    expect(isModelAvailable(provider, id)).toBe(false);
    expect(
      getModel(provider, id)?.deprecatedDate?.toISOString().slice(0, 10)
    ).toBe(date);
  });
});
