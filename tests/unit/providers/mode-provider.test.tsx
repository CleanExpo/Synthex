import { renderHook } from '@testing-library/react';
import { ModeProvider, useMode } from '@/components/providers/mode-provider';
import * as subscriptionHook from '@/hooks/useSubscription';

jest.mock('@/hooks/useSubscription');

const mockUseSubscription =
  subscriptionHook.useSubscription as jest.MockedFunction<
    typeof subscriptionHook.useSubscription
  >;

// `UseSubscriptionReturn` is not exported from the hook — construct the shape manually.
// refetch must be `() => Promise<void>` to satisfy the hook's return type.
const makeSubscription = (plan: string) =>
  ({
    subscription: {
      id: 'sub_1',
      plan: plan as 'free',
      status: 'active',
      limits: {
        socialAccounts: 1,
        aiPosts: 10,
        personas: 1,
        seoAudits: 0,
        seoPages: 0,
      },
      usage: { aiPosts: 0, seoAudits: 0, seoPages: 0 },
      cancelAtPeriodEnd: false,
    },
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined) as () => Promise<void>,
    hasAccess: jest.fn().mockReturnValue(true) as (plan: never) => boolean,
  }) as ReturnType<typeof subscriptionHook.useSubscription>;

describe.skip('useMode', () => {
  afterEach(() => {
    document.body.className = '';
  });

  test('returns "simple" for starter plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('starter'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('simple');
  });

  test('returns "simple" for free plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('free'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('simple');
  });

  test('returns "pro" for pro plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('pro'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('pro');
  });

  test('returns "pro" for business plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('business'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('pro');
  });

  test('isLoading true when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({
      ...makeSubscription('pro'),
      subscription: null,
      isLoading: true,
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
