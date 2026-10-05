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
    expect(screen.queryByText(/check back/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sample outlook/i)).toBeInTheDocument();
    const cards = screen.getAllByTestId('sample-season-window');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card).toHaveTextContent(/sample/i);
    }
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
