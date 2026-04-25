/**
 * Unit tests — lib/auth/twilio-signature.ts (SYN-802)
 *
 * Covers verifyTwilioSignature and parseTwilioFormBody using the reference
 * values from the Twilio docs:
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-signatures-in-relaxed-mode
 */

import { verifyTwilioSignature, parseTwilioFormBody } from '@/lib/auth/twilio-signature';

// ---- Reference fixtures (from Twilio docs) ----------------------------------
//
// Auth token  : 12345
// URL         : https://mycompany.com/myapp.php?foo=1&bar=2
// POST params : { CallSid: 'CA1234567890ABCDE', Caller: '+14158675309',
//                Digits: '1234', From: '+14158675309', To: '+18005551212' }
// Expected sig: RSOYDt4T1cUTdK1PDd93/VVr8B8=

const AUTH_TOKEN = '12345';
const URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const PARAMS: Record<string, string> = {
  CallSid: 'CA1234567890ABCDE',
  Caller: '+14158675309',
  Digits: '1234',
  From: '+14158675309',
  To: '+18005551212',
};
const VALID_SIGNATURE = 'RSOYDt4T1cUTdK1PDd93/VVr8B8=';

describe('verifyTwilioSignature', () => {
  it('returns true for the Twilio reference vector', () => {
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, VALID_SIGNATURE)).toBe(true);
  });

  it('returns false for a wrong signature', () => {
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, 'wrongsignature==')).toBe(false);
  });

  it('returns false for a different URL', () => {
    expect(
      verifyTwilioSignature(AUTH_TOKEN, 'https://evil.com/steal?foo=1&bar=2', PARAMS, VALID_SIGNATURE)
    ).toBe(false);
  });

  it('returns false for a different auth token', () => {
    expect(verifyTwilioSignature('wrongtoken', URL, PARAMS, VALID_SIGNATURE)).toBe(false);
  });

  it('returns false for modified params', () => {
    const tamperedParams = { ...PARAMS, CallSid: 'CA_INJECTED' };
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, tamperedParams, VALID_SIGNATURE)).toBe(false);
  });

  it('returns false for an empty signature', () => {
    expect(verifyTwilioSignature(AUTH_TOKEN, URL, PARAMS, '')).toBe(false);
  });
});

describe('parseTwilioFormBody', () => {
  it('parses a well-formed URL-encoded body', () => {
    const body = 'CallSid=CA123&From=%2B14158675309&To=%2B18005551212';
    const result = parseTwilioFormBody(body);
    expect(result).toEqual({
      CallSid: 'CA123',
      From: '+14158675309',
      To: '+18005551212',
    });
  });

  it('decodes + as space', () => {
    const result = parseTwilioFormBody('Name=John+Doe');
    expect(result).toEqual({ Name: 'John Doe' });
  });

  it('handles empty body', () => {
    expect(parseTwilioFormBody('')).toEqual({});
  });

  it('handles keys without values', () => {
    const result = parseTwilioFormBody('foo=bar&baz=');
    expect(result).toEqual({ foo: 'bar', baz: '' });
  });
});
