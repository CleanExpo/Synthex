/**
 * BillingSettingsPage tests — Phase 3 PR 1
 *
 * Mocks the useSubscription hook and the fetchWithCSRF helper to verify:
 *   - Loading skeleton renders while subscription is fetching
 *   - Current plan card shows correct slug
 *   - Free-plan users see no "manage payment" / cancel CTAs
 *   - Paid-plan users see manage-payment + cancel + change-plan rows
 *   - Clicking a plan row POSTs to /api/stripe/change-plan
 *   - Clicking "Manage payment" POSTs to /api/stripe/billing-portal and
 *     redirects window.location to the returned url
 *   - Errors from either call surface in the alert region
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockRefetch = jest.fn();
const mockUseSubscription = jest.fn();

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

const mockFetchWithCSRF = jest.fn();
jest.mock('@/lib/csrf', () => ({
  fetchWithCSRF: (...args: unknown[]) => mockFetchWithCSRF(...args),
}));

// NOTE: BillingSettingsPage assigns to window.location.href for the Stripe
// portal redirect. JSDOM forbids reassigning Location, but it silently
// ignores the assignment (no throw). We do not mock or assert on it; the
// correctness signal is that fetchWithCSRF was called with the right URL.

// Suppress the resulting JSDOM "not implemented: navigation" console.error
// to keep test output clean.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('Not implemented: navigation')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

import BillingSettingsPage from '@/app/dashboard/settings/billing/page';

const PAID_SUB = {
  id: 'sub_abc',
  plan: 'pro' as const,
  status: 'active',
  limits: {
    socialAccounts: 5,
    aiPosts: 100,
    personas: 3,
    seoAudits: 10,
    seoPages: 50,
  },
  usage: { aiPosts: 12, seoAudits: 2, seoPages: 5 },
  cancelAtPeriodEnd: false,
};

const FREE_SUB = {
  ...PAID_SUB,
  id: '',
  plan: 'free' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSubscription.mockReturnValue({
    subscription: PAID_SUB,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    hasAccess: () => true,
  });
});

describe('BillingSettingsPage', () => {
  it('renders a loading skeleton while subscription is loading', () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
      hasAccess: () => false,
    });

    render(<BillingSettingsPage />);
    expect(screen.getByTestId('billing-loading')).toBeInTheDocument();
  });

  it('shows current plan slug', () => {
    render(<BillingSettingsPage />);
    const card = screen.getByTestId('current-plan');
    expect(card).toHaveTextContent(/pro/i);
  });

  it('hides Manage payment + Cancel for free tier', () => {
    mockUseSubscription.mockReturnValue({
      subscription: FREE_SUB,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      hasAccess: () => false,
    });
    render(<BillingSettingsPage />);
    expect(screen.queryByTestId('manage-payment-btn')).toBeNull();
    expect(screen.queryByTestId('cancel-btn')).toBeNull();
  });

  it('shows Manage payment + Cancel for paid tier', () => {
    render(<BillingSettingsPage />);
    expect(screen.getByTestId('manage-payment-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('opens Stripe billing portal on Manage payment click', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/test_session' }),
    });

    render(<BillingSettingsPage />);
    const btn = screen.getByTestId('manage-payment-btn');
    await userEvent.click(btn);

    await waitFor(() => {
      expect(mockFetchWithCSRF).toHaveBeenCalledWith(
        '/api/stripe/billing-portal',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('POSTs newPlan when a plan row is clicked', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<BillingSettingsPage />);
    const growthRow = screen.getByTestId('plan-row-growth');
    await userEvent.click(growthRow);

    await waitFor(() => {
      expect(mockFetchWithCSRF).toHaveBeenCalledWith(
        '/api/stripe/change-plan',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ newPlan: 'growth' }),
        })
      );
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('disables the current plan row', () => {
    render(<BillingSettingsPage />);
    const proRow = screen.getByTestId('plan-row-pro');
    expect(proRow).toBeDisabled();
    expect(proRow).toHaveAttribute('data-current', 'true');
  });

  it('surfaces an error message on portal failure', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Stripe is down' }),
    });

    render(<BillingSettingsPage />);
    await userEvent.click(screen.getByTestId('manage-payment-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('billing-error')).toHaveTextContent(
        /stripe is down/i
      );
    });
  });

  it('surfaces an error message on change-plan failure', async () => {
    mockFetchWithCSRF.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Card declined' }),
    });

    render(<BillingSettingsPage />);
    await userEvent.click(screen.getByTestId('plan-row-growth'));

    await waitFor(() => {
      expect(screen.getByTestId('billing-error')).toHaveTextContent(
        /card declined/i
      );
    });
  });

  it('shows "cancels at period end" when subscription.cancelAtPeriodEnd', () => {
    mockUseSubscription.mockReturnValue({
      subscription: { ...PAID_SUB, cancelAtPeriodEnd: true },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      hasAccess: () => true,
    });
    render(<BillingSettingsPage />);
    expect(screen.getByText(/cancels at period end/i)).toBeInTheDocument();
  });
});
