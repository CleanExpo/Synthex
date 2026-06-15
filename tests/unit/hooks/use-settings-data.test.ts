/**
 * useSettingsData Hook Tests
 *
 * Regression coverage for the Settings -> Advanced tab "language" and
 * "timezone" preferences. Both selectors are user-editable and the
 * /api/user/settings route fully persists them, but the hook previously
 * dropped both on save (handleSave only sent theme) and never hydrated them
 * on load (loadUserData only read theme back). The result was a silent
 * save failure: the user picked a language/timezone, saw "All settings
 * saved successfully!", and the choice was discarded.
 *
 * These tests drive the REAL handleSave / loadUserData behaviour through the
 * settingsAPI client and assert the language + timezone round-trip.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------

const mockGetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockGetIntegrations = jest.fn();

jest.mock('@/lib/api/settings', () => ({
  profileAPI: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
  settingsAPI: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  },
  integrationsAPI: {
    getIntegrations: (...args: unknown[]) => mockGetIntegrations(...args),
  },
}));

jest.mock('@/hooks/useActiveBusiness', () => ({
  useActiveBusiness: () => ({ activeBusiness: null }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// Avoid real network for the billing/invoice fetches inside loadUserData.
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { useSettingsData } from '@/hooks/use-settings-data';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfile.mockResolvedValue({ profile: null });
  mockGetIntegrations.mockResolvedValue({ integrations: {} });
  mockUpdateProfile.mockResolvedValue({ success: true });
  mockUpdateSettings.mockResolvedValue({ success: true });
  // billing + invoices fetches -> not ok so they no-op
  mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
});

describe('useSettingsData - language & timezone persistence', () => {
  it('hydrates language and timezone from the settings route on load', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        theme: 'light',
        language: 'fr',
        timezone: 'Europe/Paris',
      },
    });

    const { result } = renderHook(() => useSettingsData());

    await waitFor(() => {
      expect(result.current.advanced.language).toBe('fr');
    });
    expect(result.current.advanced.timezone).toBe('Europe/Paris');
    expect(result.current.advanced.theme).toBe('light');
  });

  it('persists language and timezone (not just theme) on save', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        theme: 'dark',
        language: 'es',
        timezone: 'Asia/Tokyo',
      },
    });

    const { result } = renderHook(() => useSettingsData());

    // Wait for load to hydrate the localisation prefs.
    await waitFor(() => {
      expect(result.current.advanced.language).toBe('es');
    });

    mockUpdateSettings.mockClear();

    await act(async () => {
      await result.current.handleSave();
    });

    const savedTypes = mockUpdateSettings.mock.calls.map(c => c[0]);
    expect(savedTypes).toContain('language');
    expect(savedTypes).toContain('timezone');

    const languageCall = mockUpdateSettings.mock.calls.find(
      c => c[0] === 'language'
    );
    const timezoneCall = mockUpdateSettings.mock.calls.find(
      c => c[0] === 'timezone'
    );
    expect(languageCall?.[1]).toBe('es');
    expect(timezoneCall?.[1]).toBe('Asia/Tokyo');
  });

  it('saves an edited timezone selection through the route', async () => {
    mockGetSettings.mockResolvedValue({
      settings: { theme: 'dark', language: 'en', timezone: 'America/New_York' },
    });

    const { result } = renderHook(() => useSettingsData());

    await waitFor(() => {
      expect(result.current.advanced.timezone).toBe('America/New_York');
    });

    // User changes the timezone selector.
    act(() => {
      result.current.handleAdvancedChange('timezone', 'Europe/London');
    });

    mockUpdateSettings.mockClear();

    await act(async () => {
      await result.current.handleSave();
    });

    const timezoneCall = mockUpdateSettings.mock.calls.find(
      c => c[0] === 'timezone'
    );
    expect(timezoneCall?.[1]).toBe('Europe/London');
  });
});
