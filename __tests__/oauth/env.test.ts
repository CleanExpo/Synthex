import { normalizeOAuthEnvValue } from '@/lib/oauth/env';

describe('normalizeOAuthEnvValue', () => {
  it('strips whitespace and literal escaped newlines from OAuth values', () => {
    expect(normalizeOAuthEnvValue('  client.apps.googleusercontent.com\\n ')).toBe(
      'client.apps.googleusercontent.com'
    );
  });

  it('returns an empty string for missing values', () => {
    expect(normalizeOAuthEnvValue(undefined)).toBe('');
  });
});

