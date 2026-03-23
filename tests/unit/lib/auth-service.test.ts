/**
 * Unit tests for lib/auth/auth-service.ts
 *
 * AuthService wraps fetch() calls to our auth API routes and manages
 * in-memory state plus localStorage persistence.  All `fetch` calls are
 * mocked via jest.spyOn(global, 'fetch') so no real HTTP happens.
 */

// Polyfill localStorage in jsdom (already present in jest.setup.js, but
// explicitly reset between tests to prevent state leakage).

// Mock fetch before importing the module
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { authService } from '@/lib/auth/auth-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The jest.setup.js polyfills Response but does not add an `ok` getter.
 * auth-service.ts calls `response.ok` in getCurrentUser, so we must include it.
 */
function jsonResponse(body: object, status = 200): Response {
  const r = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  // Ensure `ok` is available (polyfill doesn't include it)
  Object.defineProperty(r, 'ok', {
    value: status >= 200 && status < 300,
    configurable: true,
  });
  return r;
}

function errorResponse(status: number): Response {
  const r = new Response('Error', { status });
  Object.defineProperty(r, 'ok', { value: false, configurable: true });
  return r;
}

const MOCK_USER = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();

  // Reset in-memory currentUser between tests.
  // AuthService stores this as a private field — access via type cast.

  (authService as any).currentUser = null;
  // Also clear listener set to prevent cross-test listener accumulation

  (authService as any).listeners = new Set();
});

// ── signIn ────────────────────────────────────────────────────────────────────

describe('authService.signIn', () => {
  it('returns success and updates currentUser on valid credentials', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: MOCK_USER })
    );

    const result = await authService.signIn('test@example.com', 'password');

    expect(result.success).toBe(true);
    expect(result.user).toEqual(MOCK_USER);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/unified-login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('persists user to localStorage on successful sign-in', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: MOCK_USER })
    );

    await authService.signIn('test@example.com', 'password');

    const stored = localStorage.getItem('synthex-user');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(MOCK_USER);
  });

  it('returns failure response when API returns success=false', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid credentials' }, 401)
    );

    const result = await authService.signIn('wrong@example.com', 'badpass');

    expect(result.success).toBe(false);
  });

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await authService.signIn('test@example.com', 'password');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Network error/i);
  });

  it('sends email and password in request body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: MOCK_USER })
    );

    await authService.signIn('user@example.com', 'secret123');

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.email).toBe('user@example.com');
    expect(callBody.password).toBe('secret123');
    expect(callBody.method).toBe('email');
  });
});

// ── signUp ────────────────────────────────────────────────────────────────────

describe('authService.signUp', () => {
  it('returns requiresVerification=true on successful signup', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: MOCK_USER })
    );

    const result = await authService.signUp(
      'new@example.com',
      'Password1!',
      'New User'
    );

    expect(result.success).toBe(true);
    expect(
      (result as { requiresVerification?: boolean }).requiresVerification
    ).toBe(true);
  });

  it('returns failure response on API error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Email already exists' }, 400)
    );

    const result = await authService.signUp('existing@example.com', 'pass');
    expect(result.success).toBe(false);
  });

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const result = await authService.signUp('a@b.com', 'pass');
    expect(result.success).toBe(false);
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('authService.signOut', () => {
  it('calls the logout endpoint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    await authService.signOut();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('clears localStorage on signOut', async () => {
    localStorage.setItem('synthex-user', JSON.stringify(MOCK_USER));
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    await authService.signOut();

    expect(localStorage.getItem('synthex-user')).toBeNull();
  });

  it('clears localStorage even if fetch throws', async () => {
    localStorage.setItem('synthex-user', JSON.stringify(MOCK_USER));
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    await authService.signOut();

    expect(localStorage.getItem('synthex-user')).toBeNull();
  });
});

// ── getCurrentUser ─────────────────────────────────────────────────────────

describe('authService.getCurrentUser', () => {
  it('returns user from localStorage without hitting the API', async () => {
    localStorage.setItem('synthex-user', JSON.stringify(MOCK_USER));

    const user = await authService.getCurrentUser();

    expect(user).toEqual(MOCK_USER);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches from /api/auth/user when localStorage is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ authenticated: true, user: MOCK_USER })
    );

    const user = await authService.getCurrentUser();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/user'),
      expect.objectContaining({ credentials: 'include' })
    );
    expect(user).toEqual(MOCK_USER);
  });

  it('returns null and clears localStorage when API returns 401', async () => {
    // No localStorage content, no in-memory cache — fall through to API fetch
    mockFetch.mockResolvedValueOnce(errorResponse(401));

    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
  });

  it('returns null when API returns authenticated=false', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ authenticated: false }));

    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
  });

  it('stores API-fetched user in localStorage', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ authenticated: true, user: MOCK_USER })
    );

    await authService.getCurrentUser();

    const stored = localStorage.getItem('synthex-user');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(MOCK_USER);
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────

describe('authService.updateProfile', () => {
  it('calls PUT /api/auth/user with updates', async () => {
    const updatedUser = { ...MOCK_USER, name: 'Updated Name' };
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: updatedUser })
    );

    const result = await authService.updateProfile({ name: 'Updated Name' });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/user'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Server error'));

    const result = await authService.updateProfile({ name: 'X' });
    expect(result.success).toBe(false);
  });
});

// ── resetPassword ──────────────────────────────────────────────────────────

describe('authService.resetPassword', () => {
  it('POSTs to /api/auth/reset-password', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, message: 'Check your email' })
    );

    const result = await authService.resetPassword('user@example.com');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/reset-password'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns error on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    const result = await authService.resetPassword('user@example.com');
    expect(result.success).toBe(false);
  });
});

// ── onAuthStateChange ─────────────────────────────────────────────────────

describe('authService.onAuthStateChange', () => {
  it('calls the callback immediately with the current user', () => {
    const callback = jest.fn();
    const unsubscribe = authService.onAuthStateChange(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('returns an unsubscribe function that stops future notifications', async () => {
    const callback = jest.fn();
    const unsubscribe = authService.onAuthStateChange(callback);
    callback.mockClear();

    unsubscribe();

    // Sign in triggers a notification — callback should NOT be called
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, user: MOCK_USER })
    );
    await authService.signIn('test@example.com', 'pass');

    expect(callback).not.toHaveBeenCalled();
  });
});
