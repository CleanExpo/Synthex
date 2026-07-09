/**
 * Unit tests for lib/analytics/engagement-events (SYN-612).
 *
 * Covers:
 *  - session id generation + stability across calls (sessionStorage)
 *  - gtag emission with session_id + page_path params
 *  - server dual-write POST to /api/analytics/engagement-event
 *  - dashboard_visit 30-min-per-page debounce (dedup)
 *  - per-occurrence firing for non-dashboard_visit events
 *
 * @jest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  fireEngagementEvent,
  getEngagementSessionId,
  shouldFireDashboardVisit,
  _resetEngagementTelemetryForTests,
} from '@/lib/analytics/engagement-events';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GtagMock = jest.Mock<(...args: unknown[]) => void>;

describe('engagement-events (SYN-612)', () => {
  let gtag: GtagMock;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    window.sessionStorage.clear();
    _resetEngagementTelemetryForTests();

    gtag = jest.fn() as GtagMock;
    (window as unknown as { gtag: GtagMock }).gtag = gtag;

    fetchMock = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    // Deterministic pathname for pagePath defaulting.
    window.history.pushState({}, '', '/dashboard/authority');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a stable per-session UUID', () => {
    const first = getEngagementSessionId();
    const second = getEngagementSessionId();
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
  });

  it('fires a gtag event with session_id + page_path', () => {
    fireEngagementEvent('authority_hub_viewed');

    expect(gtag).toHaveBeenCalledTimes(1);
    const [type, name, params] = gtag.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(type).toBe('event');
    expect(name).toBe('authority_hub_viewed');
    expect(params.page_path).toBe('/dashboard/authority');
    expect(params.session_id).toMatch(UUID_RE);
  });

  it('dual-writes to the engagement-event API with a valid body', () => {
    fireEngagementEvent('calendar_post_approved', {
      pagePath: '/dashboard/calendar',
      data: { post_id: 'post_123' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/analytics/engagement-event');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.eventType).toBe('calendar_post_approved');
    expect(body.pagePath).toBe('/dashboard/calendar');
    expect(body.eventData).toEqual({ post_id: 'post_123' });
    expect(body.sessionId).toMatch(UUID_RE);
  });

  it('debounces dashboard_visit to one fire per page within the window', () => {
    fireEngagementEvent('dashboard_visit', { pagePath: '/dashboard' });
    fireEngagementEvent('dashboard_visit', { pagePath: '/dashboard' });

    // Second call for the same page is suppressed.
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A different page fires independently.
    fireEngagementEvent('dashboard_visit', { pagePath: '/dashboard/settings' });
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('logs non-dashboard_visit events per-occurrence (no debounce)', () => {
    fireEngagementEvent('settings_changed', { data: { setting: 'timezone' } });
    fireEngagementEvent('settings_changed', { data: { setting: 'timezone' } });

    expect(gtag).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shouldFireDashboardVisit returns false on the second call for a page', () => {
    expect(shouldFireDashboardVisit('/dashboard/x')).toBe(true);
    expect(shouldFireDashboardVisit('/dashboard/x')).toBe(false);
    expect(shouldFireDashboardVisit('/dashboard/y')).toBe(true);
  });

  it('falls back to dataLayer when gtag is unavailable', () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];

    fireEngagementEvent('review_response_started', {
      data: { review_id: 'rev_1' },
    });

    const dl = (
      window as unknown as { dataLayer: Array<Record<string, unknown>> }
    ).dataLayer;
    expect(dl).toHaveLength(1);
    expect(dl[0]!.event).toBe('review_response_started');
    expect(dl[0]!.review_id).toBe('rev_1');
  });
});
