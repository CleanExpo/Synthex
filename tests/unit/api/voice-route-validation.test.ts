/**
 * SYN-859: validates voiceId regex allowlist on the GET handler before the
 * value is passed into ElevenLabs URL construction.
 *
 * Tests:
 *   - 400 on path-traversal-style voiceId (../foo)
 *   - 400 on percent-encoded slash
 *   - 400 on overly long voiceId (>64 chars)
 *   - 200 on a legitimate ElevenLabs voiceId (21m00Tcm4TlvDq8ikWAM)
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// next/server: minimal NextResponse polyfill (jsdom doesn't ship one).
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

  class MockNextResponse {
    status: number;
    private _body: string;
    headers: { get: () => null; set: jest.Mock; has: () => boolean };

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.headers = { get: () => null, set: jest.fn(), has: () => false };
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    ...actual,
    NextResponse: MockNextResponse,
  };
});

// Bypass auth for these tests — we are testing input validation, not auth.
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({
      allowed: true,
      context: { userId: 'test-user-id' },
    }),
    createSecureResponse: (data: unknown, status = 200) => {
      const body = JSON.stringify(data);
      return {
        status,
        json: () => Promise.resolve(JSON.parse(body)),
        headers: { get: () => null, set: () => undefined, has: () => false },
      };
    },
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

const mockGetVoiceSettings = jest.fn();
jest.mock('@/lib/services/ai/voice-generation', () => ({
  generateSpeech: jest.fn(),
  generateSpeechStream: jest.fn(),
  cloneVoice: jest.fn(),
  getVoices: jest.fn().mockResolvedValue([]),
  getCustomVoices: jest.fn().mockResolvedValue([]),
  deleteVoice: jest.fn(),
  getVoiceSettings: (...args: unknown[]) => mockGetVoiceSettings(...args),
  getCharacterQuota: jest.fn().mockResolvedValue({
    characterCount: 0,
    characterLimit: 0,
    canExtendCharacterLimit: false,
  }),
  DEFAULT_VOICES: {},
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

import { GET } from '@/app/api/media/generate/voice/route';

describe('SYN-859 — GET /api/media/generate/voice voiceId validation', () => {
  beforeEach(() => {
    mockGetVoiceSettings.mockReset();
  });

  it('returns 400 for path-traversal voiceId (../foo)', async () => {
    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/media/generate/voice?voiceId=../foo',
    });
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    expect(mockGetVoiceSettings).not.toHaveBeenCalled();
  });

  it('returns 400 for percent-encoded slash', async () => {
    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/media/generate/voice?voiceId=abc%2Fdef',
    });
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    expect(mockGetVoiceSettings).not.toHaveBeenCalled();
  });

  it('returns 400 for overly long voiceId (>64 chars)', async () => {
    const longId = 'a'.repeat(65);
    const req = createMockNextRequest({
      url: `http://localhost:3000/api/media/generate/voice?voiceId=${longId}`,
    });
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    expect(mockGetVoiceSettings).not.toHaveBeenCalled();
  });

  it('accepts a legitimate ElevenLabs voiceId and calls getVoiceSettings', async () => {
    mockGetVoiceSettings.mockResolvedValue({
      stability: 0.5,
      similarityBoost: 0.75,
    });

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/media/generate/voice?voiceId=21m00Tcm4TlvDq8ikWAM',
    });
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    expect(mockGetVoiceSettings).toHaveBeenCalledWith('21m00Tcm4TlvDq8ikWAM');
  });
});
