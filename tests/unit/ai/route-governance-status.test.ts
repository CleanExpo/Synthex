/**
 * One HTTP status per Governor refusal (follow-up 3 to PR #1066).
 *
 * Two modules turn an enforcing refusal into a response:
 * lib/ai/route-governance.ts and lib/ai/governor-route-support.ts. They kept
 * separate status tables, and route-governance's fell through to 403 for every
 * budget code it did not list — so a route-governance route answered 403
 * ("forbidden") for an exhausted build cap while a governor-route-support
 * route answered 429 ("try later"). A spend ceiling is a 429.
 *
 * SEAM: both response builders, called directly with a GovernorRefusedError.
 */

jest.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }));
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn(),
}));

import { GovernorRefusedError, type GovernorRefusal } from '@/lib/ai/governor';
import {
  governorProviderFor,
  governorRefusalResponse as routeGovernanceResponse,
} from '@/lib/ai/route-governance';
import { governorRefusalResponse as routeSupportResponse } from '@/lib/ai/governor-route-support';

const BUDGET_AND_CAP: GovernorRefusal[] = [
  'refused_budget_exhausted',
  'refused_budget_unconfigured',
  'refused_budget_invalid_estimate',
  'refused_budget_untrusted_input',
  'refused_build_cap_exceeded',
];

/** Every refusal outcome. `satisfies` keeps this list in step with the type. */
const ALL_REFUSALS = [
  'refused_flag_missing',
  'refused_flag_disabled',
  'refused_kill_switch',
  'refused_byok_missing',
  'refused_byok_revoked',
  'refused_byok_inactive',
  'refused_byok_undecryptable',
  'refused_budget_exhausted',
  'refused_budget_unconfigured',
  'refused_budget_invalid_estimate',
  'refused_budget_untrusted_input',
  'refused_model_unavailable',
  'refused_control_plane_error',
  'failed_provider_error',
  'refused_build_cap_exceeded',
] as const satisfies readonly GovernorRefusal[];

// Compile-time completeness: fails tsc if a GovernorRefusal is missing above.
type Missing = Exclude<GovernorRefusal, (typeof ALL_REFUSALS)[number]>;
const _complete: [Missing] extends [never] ? true : never = true;
void _complete;

describe('governorProviderFor', () => {
  it.each([
    ['OpenRouter', 'openrouter'],
    ['Anthropic', 'anthropic'],
    ['OpenAI', 'openai'],
    ['Google', 'google'],
  ])('maps %s to %s', (name, expected) => {
    expect(governorProviderFor(name)).toBe(expected);
  });

  // No provider runs outside the Governor: an unknown name must not become an
  // ungoverned, unbilled call.
  it('throws for an unknown provider instead of returning an ungoverned null', () => {
    expect(() => governorProviderFor('Local')).toThrow(/Unknown AI provider/);
  });
});

describe('Governor refusal status', () => {
  it.each(BUDGET_AND_CAP)(
    'C6 route-governance answers 429 for %s',
    async outcome => {
      const res = routeGovernanceResponse(
        new GovernorRefusedError(outcome, 'test reason')
      );
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe(outcome);
    }
  );

  it.each([...ALL_REFUSALS])(
    'C6 route-governance and governor-route-support agree on %s',
    outcome => {
      const error = new GovernorRefusedError(outcome, 'test reason');
      const a = routeGovernanceResponse(error);
      const b = routeSupportResponse(error);
      expect(b).not.toBeNull();
      expect(a.status).toBe(b!.status);
    }
  );
});
