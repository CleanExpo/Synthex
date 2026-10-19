/**
 * Base64-only batch variants render from their bytes.
 *
 * The batch route now returns imageBase64 for variants without an imageUrl
 * (the Gemini escape hatch). The hook must keep it and the card must render a
 * data URI from it. It must never fall back to /api/media/assets/{id}/image
 * without a mediaAssetId — that endpoint answers 503 while media_assets is not
 * provisioned.
 */

import { render, screen, renderHook, act } from '@testing-library/react';
import { BatchFeedbackCard } from '@/components/ai/batch-feedback-card';
import {
  useImageGeneration,
  type BatchResult,
} from '@/hooks/use-image-generation';

const B64 = 'iVBORw0KGgoB64';

describe('BatchFeedbackCard — base64-only variant', () => {
  it('renders a data URI from imageBase64 when there is no imageUrl', () => {
    const batch: BatchResult = {
      batchGroupId: 'g1',
      images: [
        {
          generationId: 'gen-1',
          success: true,
          provider: 'gemini',
          imageBase64: B64,
        },
      ],
    };
    render(<BatchFeedbackCard batch={batch} />);
    const img = screen.getByAltText('Generated variant');
    expect(img.getAttribute('src')).toBe(`data:image/png;base64,${B64}`);
    expect(img.getAttribute('src')).not.toContain('/api/media/assets/');
  });

  it('still prefers imageUrl when present', () => {
    const batch: BatchResult = {
      batchGroupId: 'g1',
      images: [
        {
          generationId: 'gen-1',
          success: true,
          provider: 'gemini',
          imageUrl: 'https://cdn.example/a.png',
          imageBase64: B64,
        },
      ],
    };
    render(<BatchFeedbackCard batch={batch} />);
    expect(screen.getByAltText('Generated variant').getAttribute('src')).toBe(
      'https://cdn.example/a.png'
    );
  });
});

describe('useImageGeneration.generateBatch — keeps imageBase64', () => {
  it('maps imageBase64 from the batch response onto the variant', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          batchGroupId: 'g1',
          images: [
            {
              generationId: 'gen-1',
              success: true,
              provider: 'gemini',
              imageBase64: B64,
            },
          ],
        }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useImageGeneration());
    let batch: BatchResult | null = null;
    await act(async () => {
      batch = await result.current.generateBatch({ prompt: 'a van' });
    });
    expect(batch!.images[0].imageBase64).toBe(B64);
  });
});
