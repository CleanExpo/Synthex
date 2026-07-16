/**
 * Unit tests for isLikelyOAuth1ApiKey — the save-time / diagnostic heuristic
 * that distinguishes an X/Twitter OAuth 1.0a API Key (Consumer Key) from an
 * OAuth 2.0 Client ID. Synthex's X flow is OAuth 2.0 only, so the admin
 * platform-credentials POST route uses this to reject the wrong credential
 * type before it is silently stored (which would fail at token exchange).
 *
 * The bounds must be conservative: never flag a real OAuth 2.0 Client ID
 * (~34-char base64url) as OAuth 1.0a, or a legitimate save would be blocked.
 */
import { isLikelyOAuth1ApiKey } from '@/lib/platform-credentials';

describe('isLikelyOAuth1ApiKey', () => {
  it('flags a 25-char alphanumeric OAuth 1.0a API Key shape', () => {
    // X OAuth 1.0a API Keys are ~25-char, purely-alphanumeric strings.
    expect(isLikelyOAuth1ApiKey('K9jf83kfJDKfj39fkKDLfjs82')).toBe(true);
    expect(isLikelyOAuth1ApiKey('xvz1evFS4wEEPTGEFPHBog')).toBe(true);
  });

  it('tolerates surrounding whitespace on an OAuth 1.0a-shaped key', () => {
    expect(isLikelyOAuth1ApiKey('  K9jf83kfJDKfj39fkKDLfjs82  ')).toBe(true);
  });

  it('does NOT flag a ~34-char OAuth 2.0 Client ID (too long)', () => {
    // Real X OAuth 2.0 Client IDs are longer than the 30-char upper bound.
    expect(isLikelyOAuth1ApiKey('M1M5R2ZERjhtd2d0SU9nTUdvUkE6MTpjaQ')).toBe(
      false
    );
  });

  it('does NOT flag a base64url Client ID containing - or _', () => {
    expect(isLikelyOAuth1ApiKey('d0h2S1dX-abc_DEF123')).toBe(false);
  });

  it('does NOT flag values with punctuation or too short', () => {
    expect(isLikelyOAuth1ApiKey('short')).toBe(false);
    expect(isLikelyOAuth1ApiKey('has spaces in it here now')).toBe(false);
    expect(isLikelyOAuth1ApiKey('has:colon:1:ci:structure')).toBe(false);
    expect(isLikelyOAuth1ApiKey('')).toBe(false);
  });
});
