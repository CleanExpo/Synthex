/**
 * UsagePage tests — Phase 3 PR 2
 *
 * Mocks the /api/billing/usage endpoint and verifies:
 *   - Loading skeleton renders during fetch
 *   - Three metric bars (posts, ai generations, networks) render
 *   - Bar width matches usage / limit ratio
 *   - Bar colour switches to danger at >= 90%
 *   - Unlimited plans (-1) show the infinity indicator
 *   - Error state renders the fallback card
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockUseSWR = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock('@/lib/fetcher', () => ({
  fetchJson: jest.fn(),
}));

import UsagePage from '@/app/dashboard/usage/page';

const PAID_USAGE = {
  plan: 'pro',
  status: 'active',
  periodStart: '2026-05-01T00:00:00.000Z',
  periodResetAt: '2026-06-01T00:00:00.000Z',
  limits: { socialAccounts: 5, aiPosts: 100, personas: 3 },
  usage: { aiPosts: 30, aiGenerations: 45, networksConnected: 3 },
  authority: { tier: 'free' as const, limits: {} },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UsagePage', () => {
  it('renders a loading skeleton while fetching', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    });

    render(<UsagePage />);
    expect(screen.getByTestId('usage-loading')).toBeInTheDocument();
  });

  it('renders three metric bars when data loaded', async () => {
    mockUseSWR.mockReturnValue({
      data: PAID_USAGE,
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    await waitFor(() => {
      expect(screen.getByTestId('metric-posts')).toBeInTheDocument();
    });
    expect(screen.getByTestId('metric-ai-generations')).toBeInTheDocument();
    expect(screen.getByTestId('metric-networks')).toBeInTheDocument();
  });

  it('renders the correct usage / limit text', () => {
    mockUseSWR.mockReturnValue({
      data: PAID_USAGE,
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    expect(screen.getByTestId('metric-posts')).toHaveTextContent('30 / 100');
    expect(screen.getByTestId('metric-ai-generations')).toHaveTextContent(
      '45 / 100'
    );
    expect(screen.getByTestId('metric-networks')).toHaveTextContent('3 / 5');
  });

  it('marks bars at >= 90% as danger', () => {
    mockUseSWR.mockReturnValue({
      data: {
        ...PAID_USAGE,
        usage: { ...PAID_USAGE.usage, aiPosts: 95 },
      },
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    const bar = screen.getByTestId('metric-posts-bar');
    expect(bar.getAttribute('data-pct')).toBe('95');
    expect(bar.className).toContain('bg-red-500');
  });

  it('marks bars between 75-89% as warning', () => {
    mockUseSWR.mockReturnValue({
      data: {
        ...PAID_USAGE,
        usage: { ...PAID_USAGE.usage, aiPosts: 80 },
      },
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    const bar = screen.getByTestId('metric-posts-bar');
    expect(bar.className).toContain('bg-amber-500');
  });

  it('shows infinity indicator for unlimited (-1) limit', () => {
    mockUseSWR.mockReturnValue({
      data: {
        ...PAID_USAGE,
        limits: { socialAccounts: -1, aiPosts: -1, personas: -1 },
      },
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    const bar = screen.getByTestId('metric-posts-bar');
    expect(bar.getAttribute('data-pct')).toBe('unlimited');
    expect(screen.getByTestId('metric-posts')).toHaveTextContent('∞');
  });

  it('renders error state when fetch fails', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('network error'),
      isLoading: false,
    });

    render(<UsagePage />);
    expect(screen.getByTestId('usage-error')).toBeInTheDocument();
  });

  it('renders the formatted reset date', () => {
    mockUseSWR.mockReturnValue({
      data: PAID_USAGE,
      error: undefined,
      isLoading: false,
    });

    render(<UsagePage />);
    // 1 June 2026 — en-AU long format
    expect(screen.getByTestId('reset-date')).toHaveTextContent(/1 june 2026/i);
  });
});
