/**
 * SYN-1216 — /onboarding/connect Finish setup.
 *
 * All channels are Coming soon. Finish must call complete (no connected
 * platform required), leave Finishing… on error, and push /dashboard on
 * success so the operator is not stuck on the connect step.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import ConnectPage from '@/app/(onboarding)/onboarding/connect/page';
import { BRAND_MIRROR_COOKIE } from '@/lib/constants/onboarding';
import { settle } from '../../helpers/settle';
import { toast } from 'sonner';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  }),
}));

jest.mock('@/components/ui/HelpVideo', () => ({
  HelpVideo: () => null,
}));

jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

function stubMatchMedia() {
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
}

describe('Connect page — Finish setup (SYN-1216)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubMatchMedia();
    document.cookie = `${BRAND_MIRROR_COOKIE}=1`;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('completes with every channel Coming soon and navigates to /dashboard', async () => {
    global.fetch = jest.fn().mockImplementation((url: unknown) => {
      if (String(url).includes('/api/onboarding/complete')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, organizationId: 'org-1' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    render(<ConnectPage />);
    await settle();

    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
    await settle();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/onboarding/complete',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(window.localStorage.getItem('onboardingComplete')).toBe('true');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('surfaces a complete-call error and leaves Finishing…', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to complete onboarding' }),
    }) as unknown as typeof fetch;

    render(<ConnectPage />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
    await settle();

    expect(toast.error).toHaveBeenCalledWith('Failed to complete onboarding');
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /finish setup/i })
    ).not.toBeDisabled();
    expect(screen.queryByText('Finishing…')).not.toBeInTheDocument();
  });

  it('surfaces a timeout instead of staying on Finishing…', async () => {
    const abortErr = new DOMException(
      'The operation was aborted.',
      'AbortError'
    );
    global.fetch = jest.fn().mockRejectedValue(abortErr) as unknown as typeof fetch;

    render(<ConnectPage />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
    await settle();

    expect(toast.error).toHaveBeenCalledWith(
      'Setup is taking too long. Please try again.'
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText('Finishing…')).not.toBeInTheDocument();
  });
});
