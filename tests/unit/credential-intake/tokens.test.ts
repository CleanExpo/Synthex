import jwt from 'jsonwebtoken';
import {
  CREDENTIAL_INTAKE_PROVIDERS,
  createCredentialIntakeToken,
  verifyCredentialIntakeToken,
} from '@/lib/credential-intake/tokens';

describe('credential intake tokens', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-with-enough-length-for-jwt-signing';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('round-trips a signed credential intake token', () => {
    const token = createCredentialIntakeToken({
      organizationId: 'org_123',
      providers: ['facebook', 'instagram'],
      createdByUserId: 'user_123',
      purpose: 'CCW EOFY intake',
      expiresInHours: 24,
    });

    const payload = verifyCredentialIntakeToken(token);

    expect(payload).toMatchObject({
      type: 'credential_intake',
      organizationId: 'org_123',
      providers: ['facebook', 'instagram'],
      createdByUserId: 'user_123',
      purpose: 'CCW EOFY intake',
    });
    expect(payload.exp).toBeGreaterThan(payload.iat ?? 0);
  });

  it('falls back to all supported providers when the requested list is invalid', () => {
    const token = createCredentialIntakeToken({
      organizationId: 'org_123',
      providers: ['not-supported'],
      createdByUserId: 'user_123',
    });

    expect(verifyCredentialIntakeToken(token).providers).toEqual([
      ...CREDENTIAL_INTAKE_PROVIDERS,
    ]);
  });

  it('rejects non-intake JWTs', () => {
    const token = jwt.sign(
      { type: 'different', organizationId: 'org_123' },
      process.env.JWT_SECRET as string
    );

    expect(() => verifyCredentialIntakeToken(token)).toThrow(
      'Invalid credential intake token'
    );
  });
});
