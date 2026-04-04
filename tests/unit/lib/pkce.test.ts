/**
 * PKCE Utilities Unit Tests
 *
 * @description Tests for PKCE (Proof Key for Code Exchange) utilities
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEChallenge,
  generateState,
  isValidCodeVerifier,
  verifyCodeChallenge,
  storePKCEState,
  retrievePKCEState,
  getCodeVerifier,
} from '@/lib/auth/pkce';

describe('PKCE Code Generation', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a string of correct length', () => {
      const verifier = generateCodeVerifier();
      // Base64URL encoded 32 bytes = 43 chars (without padding)
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate unique verifiers', () => {
      const verifiers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier());
      }
      expect(verifiers.size).toBe(100);
    });

    it('should only contain valid characters per RFC 7636', () => {
      const verifier = generateCodeVerifier();
      // Valid chars: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      const validPattern = /^[A-Za-z0-9\-._~]+$/;
      expect(validPattern.test(verifier)).toBe(true);
    });

    it('should pass validation', () => {
      const verifier = generateCodeVerifier();
      expect(isValidCodeVerifier(verifier)).toBe(true);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a valid base64url string', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);

      // Base64URL encoded SHA-256 hash = 43 chars
      expect(challenge.length).toBe(43);
    });

    it('should be deterministic', () => {
      const verifier = 'test-verifier-value-that-is-long-enough';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should produce different challenges for different verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      const challenge1 = generateCodeChallenge(verifier1);
      const challenge2 = generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should not contain standard base64 padding', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);

      expect(challenge).not.toContain('=');
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
    });
  });

  describe('generatePKCEChallenge', () => {
    it('should return a complete PKCE challenge object', () => {
      const challenge = generatePKCEChallenge();

      expect(challenge).toHaveProperty('codeVerifier');
      expect(challenge).toHaveProperty('codeChallenge');
      expect(challenge).toHaveProperty('codeChallengeMethod');
      expect(challenge.codeChallengeMethod).toBe('S256');
    });

    it('should generate matching verifier and challenge', () => {
      const { codeVerifier, codeChallenge } = generatePKCEChallenge();

      const expectedChallenge = generateCodeChallenge(codeVerifier);
      expect(codeChallenge).toBe(expectedChallenge);
    });

    it('should generate valid verifier', () => {
      const { codeVerifier } = generatePKCEChallenge();
      expect(isValidCodeVerifier(codeVerifier)).toBe(true);
    });
  });

  describe('generateState', () => {
    it('should generate a 64-character hex string', () => {
      const state = generateState();
      expect(state).toHaveLength(64);
      expect(state).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique states', () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }
      expect(states.size).toBe(100);
    });
  });
});

describe('PKCE Validation', () => {
  describe('isValidCodeVerifier', () => {
    it('should accept valid verifier', () => {
      const verifier = generateCodeVerifier();
      expect(isValidCodeVerifier(verifier)).toBe(true);
    });

    it('should reject verifier that is too short', () => {
      const shortVerifier = 'abc123';
      expect(isValidCodeVerifier(shortVerifier)).toBe(false);
    });

    it('should reject verifier that is too long', () => {
      const longVerifier = 'a'.repeat(129);
      expect(isValidCodeVerifier(longVerifier)).toBe(false);
    });

    it('should accept verifier at minimum length (43 chars)', () => {
      const minVerifier = 'a'.repeat(43);
      expect(isValidCodeVerifier(minVerifier)).toBe(true);
    });

    it('should accept verifier at maximum length (128 chars)', () => {
      const maxVerifier = 'a'.repeat(128);
      expect(isValidCodeVerifier(maxVerifier)).toBe(true);
    });

    it('should reject verifier with invalid characters', () => {
      const invalidVerifier = 'abc123!@#$%^&*()'.padEnd(43, 'a');
      expect(isValidCodeVerifier(invalidVerifier)).toBe(false);
    });

    it('should accept all valid special characters', () => {
      const specialChars = '-._~' + 'a'.repeat(39);
      expect(isValidCodeVerifier(specialChars)).toBe(true);
    });
  });

  describe('verifyCodeChallenge', () => {
    it('should verify matching verifier and challenge', () => {
      const { codeVerifier, codeChallenge } = generatePKCEChallenge();
      expect(verifyCodeChallenge(codeVerifier, codeChallenge)).toBe(true);
    });

    it('should reject non-matching verifier and challenge', () => {
      const { codeChallenge } = generatePKCEChallenge();
      const differentVerifier = generateCodeVerifier();
      expect(verifyCodeChallenge(differentVerifier, codeChallenge)).toBe(false);
    });

    it('should reject tampered challenge', () => {
      const verifier = generateCodeVerifier();
      const tamperedChallenge = 'tampered-challenge-value-that-is-wrong';
      expect(verifyCodeChallenge(verifier, tamperedChallenge)).toBe(false);
    });
  });
});

describe('PKCE State Storage (In-Memory)', () => {
  // These tests use in-memory storage since Redis is not available in test env

  describe('storePKCEState and retrievePKCEState', () => {
    it('should store and retrieve PKCE state', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();
      const provider = 'google';
      const redirectUri = 'http://localhost:3000/auth/callback';

      await storePKCEState(state, verifier, provider, redirectUri);

      const retrieved = await retrievePKCEState(state);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.state).toBe(state);
      expect(retrieved?.codeVerifier).toBe(verifier);
      expect(retrieved?.provider).toBe(provider);
      expect(retrieved?.redirectUri).toBe(redirectUri);
    });

    it('should return null for non-existent state', async () => {
      const result = await retrievePKCEState('non-existent-state');
      expect(result).toBeNull();
    });

    it('should consume state on retrieval (one-time use)', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();

      await storePKCEState(state, verifier, 'google', 'http://localhost:3000');

      // First retrieval should succeed
      const first = await retrievePKCEState(state);
      expect(first).not.toBeNull();

      // Second retrieval should fail (already consumed)
      const second = await retrievePKCEState(state);
      expect(second).toBeNull();
    });

    it('should store optional linkToUserId', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();
      const linkToUserId = 'user-123';

      await storePKCEState(state, verifier, 'github', 'http://localhost:3000', linkToUserId);

      const retrieved = await retrievePKCEState(state);

      expect(retrieved?.linkToUserId).toBe(linkToUserId);
    });

    it('should set expiration timestamp', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();
      const beforeStore = Date.now();

      await storePKCEState(state, verifier, 'google', 'http://localhost:3000');

      const retrieved = await retrievePKCEState(state);
      const afterStore = Date.now();

      // expiresAt should be ~10 minutes from now
      const expectedExpiry = beforeStore + 10 * 60 * 1000;
      expect(retrieved?.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(retrieved?.expiresAt).toBeLessThanOrEqual(afterStore + 10 * 60 * 1000 + 1000);
    });
  });

  describe('getCodeVerifier', () => {
    it('should return code verifier for valid state', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();

      await storePKCEState(state, verifier, 'google', 'http://localhost:3000');

      const retrieved = await getCodeVerifier(state);

      expect(retrieved).toBe(verifier);
    });

    it('should return null for invalid state', async () => {
      const result = await getCodeVerifier('invalid-state');
      expect(result).toBeNull();
    });

    it('should consume the state (one-time use)', async () => {
      const state = generateState();
      const verifier = generateCodeVerifier();

      await storePKCEState(state, verifier, 'google', 'http://localhost:3000');

      // First call should return verifier
      const first = await getCodeVerifier(state);
      expect(first).toBe(verifier);

      // Second call should return null
      const second = await getCodeVerifier(state);
      expect(second).toBeNull();
    });
  });
});

describe('PKCE Security Properties', () => {
  it('should generate cryptographically strong verifiers', () => {
    // Test entropy - all verifiers should be unique
    const verifiers: string[] = [];
    for (let i = 0; i < 1000; i++) {
      verifiers.push(generateCodeVerifier());
    }

    const uniqueVerifiers = new Set(verifiers);
    expect(uniqueVerifiers.size).toBe(1000);
  });

  it('should make it infeasible to derive verifier from challenge', () => {
    // This is a conceptual test - SHA-256 is one-way
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    // Challenge should be completely different from verifier
    expect(challenge).not.toBe(verifier);
    expect(challenge).not.toContain(verifier.substring(0, 10));
  });

  it('should generate different state for CSRF protection', () => {
    const states: string[] = [];
    for (let i = 0; i < 100; i++) {
      states.push(generateState());
    }

    const uniqueStates = new Set(states);
    expect(uniqueStates.size).toBe(100);
  });
});
