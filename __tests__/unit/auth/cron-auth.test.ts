/**
 * Unit tests — Cron auth helper — SYN-702
 *
 * Covers the per-route-secret-with-shared-fallback pattern that isolates
 * each internal/cron endpoint's auth scope.
 */

import { decide, perRouteSecretEnvName } from '@/lib/auth/cron-auth';

describe('SYN-702 — cron auth decision logic', () => {
  describe('env var name builder', () => {
    it('prefixes with CRON_SECRET_ and uses the route name as-is', () => {
      expect(perRouteSecretEnvName('DELIVER_ADVISOR_BRIEF')).toBe(
        'CRON_SECRET_DELIVER_ADVISOR_BRIEF'
      );
    });
  });

  describe('authorised — per-route secret wins', () => {
    it('matches the per-route secret when both are configured', () => {
      const env = {
        CRON_SECRET: 'shared-abc',
        CRON_SECRET_ADVISOR_BRIEF: 'per-route-xyz',
      };
      expect(decide('Bearer per-route-xyz', 'ADVISOR_BRIEF', env).outcome).toBe(
        'per-route-match'
      );
    });

    it('matches per-route secret even when shared secret is missing', () => {
      const env = { CRON_SECRET_ADVISOR_BRIEF: 'per-route-xyz' };
      expect(decide('Bearer per-route-xyz', 'ADVISOR_BRIEF', env).outcome).toBe(
        'per-route-match'
      );
    });
  });

  describe('authorised — shared fallback', () => {
    it('matches shared CRON_SECRET when no per-route secret is configured', () => {
      const env = { CRON_SECRET: 'shared-abc' };
      expect(decide('Bearer shared-abc', 'ADVISOR_BRIEF', env).outcome).toBe(
        'shared-fallback-match'
      );
    });

    it('shared secret does NOT unlock routes with a per-route secret set', () => {
      // If a per-route secret is explicitly configured, the shared secret
      // must not authenticate — per-route isolation means shared is no
      // longer a master key for that route.
      const env = {
        CRON_SECRET: 'shared-abc',
        CRON_SECRET_ADVISOR_BRIEF: 'per-route-xyz',
      };
      expect(decide('Bearer shared-abc', 'ADVISOR_BRIEF', env).outcome).toBe(
        'mismatch'
      );
    });
  });

  describe('unauthorised', () => {
    it('rejects missing Authorization header', () => {
      const env = { CRON_SECRET: 'shared-abc' };
      expect(decide(null, 'ADVISOR_BRIEF', env).outcome).toBe(
        'missing-auth-header'
      );
    });

    it('rejects wrong secret', () => {
      const env = { CRON_SECRET: 'shared-abc' };
      expect(decide('Bearer wrong', 'ADVISOR_BRIEF', env).outcome).toBe(
        'mismatch'
      );
    });

    it('rejects bare token (no Bearer prefix)', () => {
      const env = { CRON_SECRET: 'shared-abc' };
      expect(decide('shared-abc', 'ADVISOR_BRIEF', env).outcome).toBe(
        'mismatch'
      );
    });
  });

  describe('misconfigured environment', () => {
    it('reports no-secret-configured when neither env var is set', () => {
      const env = {};
      expect(decide('Bearer anything', 'ADVISOR_BRIEF', env).outcome).toBe(
        'no-secret-configured'
      );
    });
  });

  describe('route-isolation property', () => {
    it('per-route secret for ROUTE_A does not authenticate ROUTE_B', () => {
      const env = {
        CRON_SECRET_ROUTE_A: 'secret-a',
        CRON_SECRET_ROUTE_B: 'secret-b',
      };
      expect(decide('Bearer secret-a', 'ROUTE_B', env).outcome).toBe(
        'mismatch'
      );
      expect(decide('Bearer secret-b', 'ROUTE_A', env).outcome).toBe(
        'mismatch'
      );
    });
  });
});
