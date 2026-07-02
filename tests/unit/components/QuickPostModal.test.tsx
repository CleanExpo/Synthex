/**
 * DOM smoke test for QuickPostModal (SYN-847).
 *
 * Automated stand-in for the manual browser smoke: "switch to a child brand →
 * create a post → the campaign create POST is scoped to THAT brand's org".
 *
 * Strategy (matches repo conventions — RTL + jsdom via jest.worktree.cjs):
 *   - mock `useActiveBusiness` to control the active child-brand org id
 *   - mock global `fetch` (the modal also calls /api/integrations on open —
 *     we route that to an empty list and capture the /api/campaigns POST)
 *   - mock `sonner` so toast() is a no-op in jsdom
 *   - render the modal, drive the create action, and assert the POST body
 *     carried { organizationId: <child brand id> } (and that it is OMITTED
 *     when no brand is active — backward-compatible default-org path).
 *
 * This is the layer the API-boundary test (tests/unit/api/campaigns.test.ts,
 * SYN-847 cases) cannot reach: it proves the FRONT-END caller actually puts the
 * active child org into the request body that the route then authorises.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { QuickPostModal } from '@/components/dashboard/QuickPostModal';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// ── Mock the active-business hook (the brand switcher source of truth) ───────
jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: jest.fn(),
}));
const mockUseActiveBusiness = useActiveBusiness as jest.MockedFunction<
  typeof useActiveBusiness
>;

// ── sonner toast is a no-op under jsdom ──────────────────────────────────────
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

const CHILD_BRAND_ORG_ID = 'child-brand-org-9f3a';

/**
 * Build a useActiveBusiness return value with the given active org.
 * Only `activeOrganizationId` is consumed by QuickPostModal; the rest satisfy
 * the hook's return type.
 */
function activeBusinessReturn(activeOrganizationId: string | null) {
  return {
    businesses: [],
    activeBusiness: null,
    activeOrganizationId,
    isOwner: activeOrganizationId !== null,
    isLoading: false,
    switchBusiness: jest.fn(),
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useActiveBusiness>;
}

/**
 * Mock fetch: /api/integrations (mount) → one connected platform so the modal
 * auto-selects it (QuickPostModal only sets `selectedPlatform` from a connected
 * integration; without one the submit guard short-circuits before any POST);
 * /api/campaigns (submit) → 200 success. Records every call so the test can
 * inspect the campaigns POST body.
 */
function installFetchMock() {
  const fetchMock = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/integrations')) {
        return {
          ok: true,
          json: async () => ({
            integrations: [
              { id: 'int-1', platform: 'linkedin', profileName: 'Child Brand' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/campaigns')) {
        return {
          ok: true,
          json: async () => ({ success: true, campaign: { id: 'camp-1' } }),
        } as Response;
      }

      return { ok: true, json: async () => ({}) } as Response;
    }
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** Find the /api/campaigns POST call and return its parsed JSON body. */
function getCampaignPostBody(fetchMock: jest.Mock): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url, init]) => {
    const u = typeof url === 'string' ? url : String(url);
    return u.includes('/api/campaigns') && init?.method === 'POST';
  });
  if (!call) throw new Error('No POST to /api/campaigns was made');
  return JSON.parse((call[1] as RequestInit).body as string);
}

async function fillAndSubmit() {
  // Wait for the mount-time /api/integrations fetch to resolve and auto-select
  // a connected platform (submit guards on a selected platform).
  await waitFor(() =>
    expect(screen.getByText(/child brand/i)).toBeInTheDocument()
  );

  // Type content (the Create button is disabled until content is non-empty).
  const textarea = screen.getByPlaceholderText(/what do you want to share/i);
  fireEvent.change(textarea, { target: { value: 'Launch our new brand.' } });

  const createButton = screen.getByRole('button', { name: /create post/i });
  await waitFor(() => expect(createButton).not.toBeDisabled());
  fireEvent.click(createButton);

  // Wait for the success path to settle (flushes the post-submit state updates
  // inside act() so React doesn't warn about un-acted updates).
  await waitFor(() =>
    expect(
      (toast as unknown as { success: jest.Mock }).success
    ).toHaveBeenCalled()
  );
}

describe('QuickPostModal — SYN-847 brand-scoped campaign create', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = installFetchMock();
  });

  it('sends the active child-brand organizationId in the campaign POST body', async () => {
    // Simulate: user has switched to a child brand in the workspace switcher.
    mockUseActiveBusiness.mockReturnValue(
      activeBusinessReturn(CHILD_BRAND_ORG_ID)
    );

    render(
      <QuickPostModal
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    );

    await fillAndSubmit();

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(([url, init]) => {
        const u = typeof url === 'string' ? url : String(url);
        return u.includes('/api/campaigns') && init?.method === 'POST';
      });
      expect(posted).toBe(true);
    });

    const body = getCampaignPostBody(fetchMock);
    // The campaign lands under the ACTIVE child brand, not the user's default org.
    expect(body.organizationId).toBe(CHILD_BRAND_ORG_ID);
    expect(body.platform).toBeTruthy();
    expect(body.content).toBe('Launch our new brand.');
  });

  it('"Save as Draft" omits the schedule so the post lands as a draft', async () => {
    // Act-first / schedule-later: the draft button must NOT carry a
    // settings.scheduledAt, even though the modal pre-fills a default time.
    mockUseActiveBusiness.mockReturnValue(activeBusinessReturn(null));

    render(
      <QuickPostModal
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/child brand/i)).toBeInTheDocument()
    );

    const textarea = screen.getByPlaceholderText(/what do you want to share/i);
    fireEvent.change(textarea, { target: { value: 'A rough idea.' } });

    const draftButton = screen.getByRole('button', { name: /save as draft/i });
    await waitFor(() => expect(draftButton).not.toBeDisabled());
    fireEvent.click(draftButton);

    await waitFor(() =>
      expect(
        (toast as unknown as { success: jest.Mock }).success
      ).toHaveBeenCalled()
    );

    const body = getCampaignPostBody(fetchMock);
    expect(body.content).toBe('A rough idea.');
    // No schedule → API treats it as a draft.
    expect(body.settings).toBeUndefined();
  });

  it('omits organizationId when no brand is active (default-org fallback)', async () => {
    // No active brand → hook returns null → body must NOT carry organizationId,
    // so the route falls back to the user's effective default org (legacy path).
    mockUseActiveBusiness.mockReturnValue(activeBusinessReturn(null));

    render(
      <QuickPostModal
        open={true}
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />
    );

    await fillAndSubmit();

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(([url, init]) => {
        const u = typeof url === 'string' ? url : String(url);
        return u.includes('/api/campaigns') && init?.method === 'POST';
      });
      expect(posted).toBe(true);
    });

    const body = getCampaignPostBody(fetchMock);
    expect(body).not.toHaveProperty('organizationId');
    expect(body.content).toBe('Launch our new brand.');
  });
});
