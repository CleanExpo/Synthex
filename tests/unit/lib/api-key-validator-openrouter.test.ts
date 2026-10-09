/**
 * OpenRouter save-path: reject non-sk-or keys and accept a live /key 200.
 */

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { validateAPIKey } from '@/lib/encryption/api-key-validator';

describe('validateAPIKey — OpenRouter', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('rejects an OpenAI-shaped key in the OpenRouter slot', async () => {
    const result = await validateAPIKey('openrouter', 'sk-proj-not-openrouter');
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/sk-or-/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a key OpenRouter confirms on /key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await validateAPIKey('openrouter', 'sk-or-v1-testkey12');
    expect(result.isValid).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/key');
  });

  it('strips a Bearer prefix before checking', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await validateAPIKey(
      'openrouter',
      'Bearer sk-or-v1-testkey12'
    );
    expect(result.isValid).toBe(true);
  });
});
