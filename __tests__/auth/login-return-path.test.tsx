/**
 * SYN-1215: an invited person who is not signed in is sent to
 * /login?redirect=/invite/accept?token=... (app/invite/accept/page.tsx).
 * Before this fix the login and signup pages ignored ?redirect=, so the
 * invite was silently lost after sign-in. These tests drive the real pages.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
let currentSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => '/login',
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/ui/HelpVideo', () => ({
  HelpVideo: () => null,
}));

jest.mock('@/lib/auth/invite-mode', () => ({
  isInviteOnlyMode: () => false,
}));

import LoginClient from '@/app/(auth)/login/login-client';
import SignupPage from '@/app/(auth)/signup/page';

const INVITE_PATH = '/invite/accept?token=abc123';

function mockFetchOk(body: unknown) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    });
}

function setLocationSearch(search: string) {
  window.history.replaceState({}, '', `/signup${search}`);
}

beforeEach(() => {
  push.mockReset();
  currentSearch = '';
  setLocationSearch('');
});

async function submitLogin() {
  fireEvent.change(screen.getByLabelText(/email/i, { selector: 'input' }), {
    target: { value: 'invitee@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), {
    target: { value: 'Correct-horse-9' },
  });
  fireEvent.submit(
    screen.getByLabelText(/email/i, { selector: 'input' }).closest('form')!
  );
}

describe('login honours a safe ?redirect=', () => {
  it('returns an invited user to the invite after sign-in', async () => {
    currentSearch = `redirect=${encodeURIComponent(INVITE_PATH)}`;
    mockFetchOk({
      success: true,
      user: {
        id: 'u1',
        email: 'invitee@example.com',
        onboardingComplete: false,
      },
    });
    render(<LoginClient />);
    await submitLogin();
    await waitFor(() => expect(push).toHaveBeenCalledWith(INVITE_PATH));
  });

  it('ignores an off-site redirect and keeps the normal destination', async () => {
    currentSearch = `redirect=${encodeURIComponent('//evil.example/phish')}`;
    mockFetchOk({
      success: true,
      user: {
        id: 'u1',
        email: 'invitee@example.com',
        onboardingComplete: true,
      },
    });
    render(<LoginClient />);
    await submitLogin();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(push).not.toHaveBeenCalledWith('//evil.example/phish');
  });

  it('carries the redirect to the create-account link', () => {
    currentSearch = `redirect=${encodeURIComponent(INVITE_PATH)}`;
    render(<LoginClient />);
    const link = screen.getByRole('link', { name: /create one/i });
    expect(link.getAttribute('href')).toBe(
      `/signup?redirect=${encodeURIComponent(INVITE_PATH)}`
    );
  });
});

describe('signup honours a safe ?redirect=', () => {
  async function submitSignup() {
    fireEvent.change(document.getElementById('name')!, {
      target: { value: 'New Invitee' },
    });
    fireEvent.change(document.getElementById('email')!, {
      target: { value: 'invitee@example.com' },
    });
    fireEvent.change(document.getElementById('password')!, {
      target: { value: 'Correct-horse-9!' },
    });
    fireEvent.change(document.getElementById('confirmPassword')!, {
      target: { value: 'Correct-horse-9!' },
    });
    const boxes = document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    boxes.forEach(b => {
      if (!b.checked) fireEvent.click(b);
    });
    fireEvent.submit(document.getElementById('email')!.closest('form')!);
  }

  it('sends a new invitee back to the invite after creating the account', async () => {
    setLocationSearch(`?redirect=${encodeURIComponent(INVITE_PATH)}`);
    mockFetchOk({ success: true, user: { id: 'u2' } });
    render(<SignupPage />);
    await submitSignup();
    await waitFor(() => expect(push).toHaveBeenCalledWith(INVITE_PATH));
  });

  it('goes to onboarding when the redirect is off-site', async () => {
    setLocationSearch(
      `?redirect=${encodeURIComponent('https://evil.example')}`
    );
    mockFetchOk({ success: true, user: { id: 'u2' } });
    render(<SignupPage />);
    await submitSignup();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding'));
  });
});
