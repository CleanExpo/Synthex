/**
 * DOM render test for the Integrations page reconnect state (SYN integrations
 * reconnect UI).
 *
 * Automated stand-in for the manual browser check: "after an encryption-key
 * rotation, a connection whose stored token can't be decrypted must surface a
 * 'Reconnect needed' state with a Reconnect action — NOT a misleading
 * 'Connected' badge with a Refresh button that then fails."
 *
 * The page is driven by `/api/integrations` (via usePlatformIntegrations),
 * which never decrypts tokens and therefore reports a key-mismatch account as
 * `connected: true`. The authoritative `needsReconnect` signal lives on
 * `GET /api/auth/connections`, which the page fetches directly. This test
 * mocks that fetch to assert:
 *   1. a connection with needsReconnect:true renders the reconnect affordance
 *      and NOT a plain "Connected" badge for that platform, and
 *   2. a healthy connection (no needsReconnect) is unchanged — "Connected" +
 *      Refresh/Disconnect, no reconnect prompt.
 *
 * Strategy matches repo conventions (RTL + jsdom): mock the integration hooks,
 * mock `useActiveBusiness`, mock global `fetch` for /api/auth/connections, and
 * mock `sonner` so toast() is a no-op under jsdom.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import IntegrationsPage from '@/app/dashboard/integrations/page';
import { usePlatformIntegrations } from '@/hooks/use-platform-integrations';
import { useThirdPartyIntegrations } from '@/hooks/use-third-party-integrations';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// ── Mock the integration hooks (data layer for the page) ─────────────────────
jest.mock('@/hooks/use-platform-integrations', () => ({
  usePlatformIntegrations: jest.fn(),
}));
jest.mock('@/hooks/use-third-party-integrations', () => ({
  useThirdPartyIntegrations: jest.fn(),
}));
jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: jest.fn(),
}));

// ── HelpVideo uses window.matchMedia (not in jsdom) and is unrelated to the
//    reconnect behaviour under test — stub it out. ─────────────────────────────
jest.mock('@/components/ui/HelpVideo', () => ({
  HelpVideo: () => null,
}));

// ── sonner toast is a no-op under jsdom ──────────────────────────────────────
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockUsePlatformIntegrations =
  usePlatformIntegrations as jest.MockedFunction<
    typeof usePlatformIntegrations
  >;
const mockUseThirdPartyIntegrations =
  useThirdPartyIntegrations as jest.MockedFunction<
    typeof useThirdPartyIntegrations
  >;
const mockUseActiveBusiness = useActiveBusiness as jest.MockedFunction<
  typeof useActiveBusiness
>;

/** Locate the integration Card for a given visible platform name. */
function cardForPlatform(name: string): HTMLElement {
  const heading = screen.getByText(name);
  // Card root: heading → title div → header flex → CardHeader → Card
  const card = heading.closest('[class*="rounded"]')?.parentElement;
  // Walk up to the nearest element that also contains the action buttons.
  let node: HTMLElement | null = heading;
  while (node && !node.querySelector('button')) {
    node = node.parentElement;
  }
  return (node ?? card) as HTMLElement;
}

describe('IntegrationsPage — reconnect (key-mismatch) state', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Twitter: healthy connection. LinkedIn: key-mismatch (needsReconnect).
    // /api/integrations reports BOTH as connected (it never decrypts tokens).
    mockUsePlatformIntegrations.mockReturnValue({
      integrations: {
        integrations: { twitter: true, linkedin: true },
        details: {
          twitter: { profileName: '@healthy_acct' },
          linkedin: { profileName: 'Stranded Account' },
        },
        readiness: {},
      },
      loading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      refresh: jest.fn(),
    } as unknown as ReturnType<typeof usePlatformIntegrations>);

    mockUseThirdPartyIntegrations.mockReturnValue({
      integrations: [],
      loading: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      refresh: jest.fn(),
    } as unknown as ReturnType<typeof useThirdPartyIntegrations>);

    mockUseActiveBusiness.mockReturnValue({
      activeOrganizationId: null,
      businesses: [],
      activeBusiness: null,
      isOwner: false,
      isLoading: false,
      switchBusiness: jest.fn(),
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useActiveBusiness>);

    // /api/auth/connections returns needsReconnect for linkedin only.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connections: [
          {
            platform: 'twitter',
            connected: true,
            needsReconnect: false,
          },
          {
            platform: 'linkedin',
            connected: false,
            needsReconnect: true,
            reconnectReason:
              'Stored credentials could not be decrypted (encryption key mismatch). Please reconnect this account.',
          },
        ],
      }),
    }) as unknown as typeof fetch;
  });

  it('shows a Reconnect affordance (not "Connected") for a key-mismatch connection', async () => {
    render(<IntegrationsPage />);

    // The reconnect signal arrives via the /api/auth/connections fetch. The
    // stranded card renders the badge AND the notice heading, so there are two
    // "Reconnect needed" nodes for LinkedIn.
    await waitFor(() => {
      expect(screen.getAllByText('Reconnect needed').length).toBeGreaterThan(0);
    });

    const linkedinCard = cardForPlatform('LinkedIn');

    // Reconnect affordance present (badge + notice heading)...
    expect(
      within(linkedinCard).getAllByText('Reconnect needed').length
    ).toBeGreaterThan(0);
    expect(
      within(linkedinCard).getByRole('button', { name: /reconnect/i })
    ).toBeInTheDocument();

    // ...and the misleading "Connected" / "Refresh" affordances are gone.
    expect(
      within(linkedinCard).queryByText('Connected')
    ).not.toBeInTheDocument();
    expect(
      within(linkedinCard).queryByRole('button', { name: /^refresh$/i })
    ).not.toBeInTheDocument();
  });

  it('leaves a healthy connection unchanged (Connected + Refresh, no reconnect prompt)', async () => {
    render(<IntegrationsPage />);

    // Wait until the reconnect signal has been applied (linkedin flips state),
    // so we know the healthy assertion reflects the post-fetch render.
    await waitFor(() => {
      expect(screen.getAllByText('Reconnect needed').length).toBeGreaterThan(0);
    });

    const twitterCard = cardForPlatform('Twitter / X');

    expect(within(twitterCard).getByText('Connected')).toBeInTheDocument();
    expect(
      within(twitterCard).getByRole('button', { name: /refresh/i })
    ).toBeInTheDocument();
    expect(
      within(twitterCard).queryByText('Reconnect needed')
    ).not.toBeInTheDocument();
  });
});
