import {
  render,
  screen,
  cleanup,
  act,
  renderHook,
} from '@testing-library/react';
import useSWR from 'swr';
import { useSearchConsole } from '@/hooks/useSearchConsole';
import GoogleBusiness from '@/app/dashboard/google-business/page';
import Insights from '@/app/dashboard/google-business/insights/page';
import Local from '@/app/dashboard/local/page';

// Mock the SWR transport/cache boundary; pages and normalising hooks stay real.
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
const totals = {
  searchViews: 0,
  mapsViews: 0,
  websiteClicks: 0,
  phoneClicks: 0,
  directionClicks: 0,
};
const observed = { state: 'OBSERVED', totals, trend: [] };
function transport(insights: unknown, error?: Error) {
  jest.mocked(useSWR).mockImplementation((key: unknown) => {
    const url = String(key);
    const isInsights = url.includes('/google-business/insights');
    const data = isInsights
      ? insights
      : url === '/api/google-business/locations'
        ? {
            locations: [{ id: 'loc', locationName: 'Fixture' }],
            connected: true,
          }
        : url === '/api/user/subscription'
          ? { plan: 'professional' }
          : url === '/api/auth/user'
            ? { success: true, user: { id: 'u' } }
            : {};
    return {
      data,
      error: isInsights ? error : undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as never;
  });
}
beforeEach(() => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ caseStudies: [] }) });
});
it.each([GoogleBusiness, Insights, Local])(
  'withholds gaps and failed cached reads in %p',
  async Page => {
    for (const [data, error] of [
      [undefined, undefined],
      [{ state: 'PARTIAL', data: null }, undefined],
      [{ ...observed, totals: { phoneClicks: 0 } }, undefined],
      [
        { ...observed, trend: [{ date: '2026-10-01', phoneClicks: 0 }] },
        undefined,
      ],
      [observed, new Error('offline')],
    ] as const) {
      transport(data, error);
      await act(async () => {
        render(<Page />);
      });
      expect(screen.getByRole('status')).toHaveTextContent(
        /Incomplete|Unavailable/
      );
      expect(screen.queryAllByText(/^0$/)).toHaveLength(0);
      cleanup();
    }
    transport(observed);
    await act(async () => {
      render(<Page />);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByText(/^0$/).length).toBeGreaterThan(0);
  }
);

it('keeps real GSC zero and clears cached analytics on non-observed refresh', async () => {
  const analytics = {
    rows: [],
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  };
  const { result } = renderHook(() => useSearchConsole());
  for (const state of ['OBSERVED', 'UNAVAILABLE']) {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ state, analytics }),
    } as Response);
    await act(async () => {
      await result.current.fetchAnalytics('https://example.test');
    });
    if (state === 'OBSERVED')
      expect(result.current.searchAnalytics?.totals.clicks).toBe(0);
    else expect(result.current.searchAnalytics).toBeNull();
  }
});
