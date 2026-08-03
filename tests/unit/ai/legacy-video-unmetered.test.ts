/** @jest-environment node */

/**
 * SYN-1115 release review — the legacy video service must not reach a paid
 * provider, because nothing meters it.
 *
 * ## The defect
 *
 * `lib/services/ai/video-generation.ts` POSTs to Runway, Synthesia and D-ID and
 * contains ZERO quota holds — `grep -c 'holdQuota\\|reserveSpend'` returns 0 —
 * while `app/api/media/generate/video/route.ts` calls it directly at two sites.
 * With a provider key present, an authenticated request therefore spends real
 * money with no organisation resolution, no reservation, no attempt record and
 * no cap: an unlimited bypass of both the shared media budget and the MCP
 * sub-cap.
 *
 * That is the exact hole the whole SYN-1115 branch exists to close — "any
 * caller that does not transit the route's Zod cap could spend without limit" —
 * still open on a second route the branch never touched.
 *
 * ## Why it looked safe and was not
 *
 * Every provider returns `not_configured` today because no key is set, so the
 * path is dormant. That is a CONFIGURATION ACCIDENT, not a control: adding a
 * key turns the bypass live and silent, with nothing to fail and nothing to
 * alert. These tests set a key deliberately, which is the only way to
 * distinguish "guarded" from "currently unreachable".
 *
 * ## Why refusal rather than metering
 *
 * None of these providers has a registry entry or a verified price, and the
 * branch's rule — founder-ratified — is that an unpriced model fails CLOSED.
 * A hold cannot be sized for a call whose cost is unknown, so the honest
 * behaviour is to refuse until the provider is priced and routed through the
 * meter.
 *
 * ZERO SPEND: `fetch` is stubbed, and the assertions are that it is never
 * called.
 */

import {
  generateVideo,
  generateScriptVideo,
  animateImage,
} from '@/lib/services/ai/video-generation';

const originalFetch = global.fetch;
const savedKeys = {
  runway: process.env.RUNWAY_API_KEY,
  synthesia: process.env.SYNTHESIA_API_KEY,
  did: process.env.DID_API_KEY,
};

let fetchMock: jest.Mock;

beforeEach(() => {
  // A key for every provider, so "no request was made" cannot be explained by
  // the provider simply being unconfigured. This is the positive control: with
  // these set, the unguarded code path DOES reach fetch.
  process.env.RUNWAY_API_KEY = 'test-runway-key';
  process.env.SYNTHESIA_API_KEY = 'test-synthesia-key';
  process.env.DID_API_KEY = 'test-did-key';

  fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'should-never-be-reached' }),
    text: async () => '',
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of [
    ['RUNWAY_API_KEY', savedKeys.runway],
    ['SYNTHESIA_API_KEY', savedKeys.synthesia],
    ['DID_API_KEY', savedKeys.did],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('the legacy video service refuses rather than spending unmetered', () => {
  it.each([
    ['text-to-video', 'runway'],
    ['image-to-video', 'runway'],
    ['motion', 'runway'],
    ['avatar', 'synthesia'],
  ] as const)('refuses %s without calling the provider', async type => {
    const result = await generateVideo({
      type,
      prompt: 'a carpet cleaning technician at work',
      script: 'hello',
    } as never);

    // THE assertion: no HTTP request, whatever the key says.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('refuses an explicitly pinned provider', async () => {
    // A pin is the case most likely to be treated as "the caller knows best".
    const result = await generateVideo({
      type: 'avatar',
      provider: 'd-id',
      imageUrl: 'https://example.test/face.png',
      script: 'hello',
    } as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('refuses through the generateScriptVideo wrapper', async () => {
    // Wrappers delegate to generateVideo, so the guard has to live there
    // rather than at each entry point — this proves it does.
    const result = await generateScriptVideo('hello there');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('refuses through the animateImage wrapper', async () => {
    const result = await animateImage('https://example.test/still.png');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('names the real reason, so it is not mistaken for a missing key', async () => {
    const result = await generateVideo({
      type: 'text-to-video',
      prompt: 'a carpet wand',
    } as never);

    // The client-facing contract is unchanged (the route degrades to 422 and
    // never persists a video), but the reason must not claim the key is
    // absent when it is present — that would send someone off to configure a
    // key that would not help.
    expect(String(result.reason ?? result.error)).toMatch(
      /meter|unmetered|spend/i
    );
  });
});
