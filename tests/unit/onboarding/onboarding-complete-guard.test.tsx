/**
 * Onboarding entry-page completion guard.
 *
 * A user who has already completed onboarding must NOT be re-onboarded. The
 * entry page (`app/(onboarding)/onboarding/page.tsx`) calls `/api/auth/user` on
 * mount and redirects completed users to `/dashboard` instead of showing the
 * empty "Analyse My Business" form again.
 *
 * Regression guard for the dead-end where landing on /onboarding (bookmark,
 * browser back, or the post-login redirect) re-onboarded a returning user.
 */

import { render, screen, waitFor } from '@testing-library/react';
import OnboardingPage from '@/app/(onboarding)/onboarding/page';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));

jest.mock('@/hooks/use-mascot', () => ({
  useMascot: () => ({ persona: null, imageUrl: null }),
}));

// MascotCard reads persona.tipText and is not under test here — stub it out.
jest.mock('@/components/mascots/MascotCard', () => ({
  MascotCard: () => null,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function mockUserEndpoint(onboardingComplete: boolean) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, user: { onboardingComplete } }),
  }) as unknown as typeof fetch;
}

describe('Onboarding entry page — completion guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom lacks matchMedia; HelpVideo (rendered by the page) reads it.
    // Assign unconditionally — jest's resetMocks clears any prior implementation.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }),
    });
  });

  it('redirects an already-completed user to /dashboard and never shows the form', async () => {
    mockUserEndpoint(true);

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    // The empty entry form must never render for a completed user.
    expect(screen.queryByText('Welcome to SYNTHEX')).not.toBeInTheDocument();
  });

  it('shows the onboarding form for a user who has NOT completed onboarding', async () => {
    mockUserEndpoint(false);

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to SYNTHEX')).toBeInTheDocument();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls through to the form (no redirect) when the auth check fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to SYNTHEX')).toBeInTheDocument();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
