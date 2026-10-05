/**
 * SYN-1218 — /onboarding/season-brief must give first value immediately.
 *
 * When no industry-specific signals come back, the page used to tell a new
 * user to "check back in 24 hours". It must instead render a usable sample
 * outlook, clearly labelled as a sample, with no deferral promise.
 */

import { render, screen } from '@testing-library/react';
import SeasonBriefPage from '@/app/(onboarding)/onboarding/season-brief/page';
import { getSampleSeasonWindows } from '@/lib/seasonal/sample-season-windows';
import { settle } from '../../helpers/settle';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

describe('Season brief — immediate sample (SYN-1218)', () => {
  beforeEach(() => {
    stubMatchMedia();
    window.sessionStorage.clear();
  });

  it('renders a labelled sample outlook instead of a 24-hour deferral when no signals exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signals: [] }),
    }) as unknown as typeof fetch;

    render(<SeasonBriefPage />);
    await settle();

    expect(screen.queryByText(/24 hours/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your industry/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/already knows what's coming/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /upcoming australian calendar windows/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/general sample, not based on your business/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/check back/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sample outlook/i)).toBeInTheDocument();
    const cards = screen.getAllByTestId('sample-season-window');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card).toHaveTextContent(/sample/i);
    }
  });

  it('keeps the personalised heading and description when real signals are present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signals: [
          {
            id: 'sig-1',
            opportunityLabel: 'Winter heating demand',
            windowStart: '2027-06-01T00:00:00.000Z',
            windowEnd: '2027-06-30T00:00:00.000Z',
            confidenceScore: 85,
            signalType: 'seasonal_peak',
            source: 'test',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<SeasonBriefPage />);
    await settle();

    expect(
      screen.getByRole('heading', { name: /already knows what's coming/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/based on your industry/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId('sample-season-window')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/sample outlook/i)).not.toBeInTheDocument();
  });

  it('builds upcoming sample windows from fixed AU dates, soonest first', () => {
    const windows = getSampleSeasonWindows(new Date(2026, 9, 5), 4);
    expect(windows.map(w => w.opportunityLabel)).toEqual([
      'Black Friday & Cyber Monday',
      'Christmas',
      'Australia Day',
      "Mother's Day",
    ]);
    // Mother's Day 2027 is Sunday 9 May.
    expect(new Date(windows[3].windowEnd).getDate()).toBe(9);
  });
});
