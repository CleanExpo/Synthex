/**
 * Unit test for the self-healing Google Drive factory (SYN-998).
 *
 * The Drive service must obtain its token through the lazy-refresh path
 * (getOAuthAccessToken) so it self-heals like GA4/GSC/GBP, instead of a static
 * decrypted token that dies ~1h after connect.
 */
const getOAuthAccessTokenMock = jest.fn();
jest.mock('@/lib/google/google-auth', () => ({
  getOAuthAccessToken: (...a: unknown[]) => getOAuthAccessTokenMock(...a),
}));

// field-encryption is only used by the deprecated factory; stub it so the
// module imports cleanly under jsdom without real key material.
jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: (v: string) => `decrypted:${v}`,
}));

import {
  driveServiceFromConnection,
  driveServiceFromEncryptedToken,
  GoogleDriveService,
} from '@/lib/storage/google-drive';

beforeEach(() => jest.clearAllMocks());

describe('driveServiceFromConnection (self-healing)', () => {
  it('builds the service from a lazily-refreshed token', async () => {
    getOAuthAccessTokenMock.mockResolvedValue('fresh-token');
    const svc = await driveServiceFromConnection('conn-1');
    expect(svc).toBeInstanceOf(GoogleDriveService);
    expect(getOAuthAccessTokenMock).toHaveBeenCalledWith('conn-1');
  });

  it('propagates a reconnection error when the token cannot be refreshed', async () => {
    getOAuthAccessTokenMock.mockRejectedValue(new Error('reconnection required'));
    await expect(driveServiceFromConnection('conn-2')).rejects.toThrow(
      /reconnection required/,
    );
  });
});

describe('driveServiceFromEncryptedToken (deprecated path)', () => {
  it('still builds a service but does NOT go through the refresh path', () => {
    const svc = driveServiceFromEncryptedToken('enc');
    expect(svc).toBeInstanceOf(GoogleDriveService);
    expect(getOAuthAccessTokenMock).not.toHaveBeenCalled();
  });
});
