/**
 * SYN-1119 — a valid service token must also declare an allowlisted source.
 *
 * The cross-product exemption skips user auth, entitlement, and (on voice)
 * quota accounting, so a token that was correct but unattributed let any holder
 * drive money-adjacent generation routes as the sanctioned caller. The source
 * check is least privilege rather than authentication: one shared secret means
 * a holder could claim any source, but an unsanctioned product can no longer
 * reach routes it was never granted, and `sourceApp` is now trustworthy enough
 * to attribute spend against.
 *
 * `SERVICE_TOKEN` is captured at module load, so each case sets the env and
 * re-imports in isolation.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const TOKEN = 'test-service-token-value';

function validate(headers: Record<string, string>, token = TOKEN) {
  let result: { valid: boolean; sourceApp?: string; error?: string };

  jest.isolateModules(() => {
    process.env.SYNTHEX_SERVICE_TOKEN = token;
    const {
      validateServiceToken,
    } = require('@/lib/security/service-token-validator');
    result = validateServiceToken(createMockNextRequest({ headers }));
  });

  return result!;
}

describe('validateServiceToken — source allowlist (SYN-1119)', () => {
  const original = process.env.SYNTHEX_SERVICE_TOKEN;

  afterAll(() => {
    process.env.SYNTHEX_SERVICE_TOKEN = original;
  });

  it('accepts a valid token from the allowlisted source', () => {
    const result = validate({
      'x-service-token': TOKEN,
      'x-source-app': 'restoreassist',
    });

    expect(result.valid).toBe(true);
    expect(result.sourceApp).toBe('restoreassist');
  });

  it('rejects a valid token whose source is not allowlisted', () => {
    const result = validate({
      'x-service-token': TOKEN,
      'x-source-app': 'some-other-product',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Service source not allowed');
  });

  it('rejects a valid token with no source at all', () => {
    const result = validate({ 'x-service-token': TOKEN });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing X-Source-App header');
  });

  it('rejects a valid token whose source header is blank', () => {
    const result = validate({
      'x-service-token': TOKEN,
      'x-source-app': '   ',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing X-Source-App header');
  });

  it('never reports a source when it rejects, so callers cannot attribute a refused request', () => {
    const result = validate({
      'x-service-token': TOKEN,
      'x-source-app': 'some-other-product',
    });

    expect(result.sourceApp).toBeUndefined();
  });

  it('normalises source casing and padding so a legitimate caller is not refused on formatting', () => {
    const result = validate({
      'x-service-token': TOKEN,
      'x-source-app': '  RestoreAssist  ',
    });

    expect(result.valid).toBe(true);
    expect(result.sourceApp).toBe('restoreassist');
  });

  it('still rejects a wrong token even when the source is allowlisted', () => {
    const result = validate({
      'x-service-token': 'wrong-token-same-length!',
      'x-source-app': 'restoreassist',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid service token');
  });

  it('checks the token before the source, so an attacker learns nothing about the allowlist', () => {
    const result = validate({
      'x-service-token': 'wrong',
      'x-source-app': 'some-other-product',
    });

    expect(result.error).toBe('Invalid service token');
  });
});
