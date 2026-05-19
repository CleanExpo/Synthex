import { evaluateProductionGate } from '@/lib/unite-command-center';

describe('evaluateProductionGate', () => {
  it('blocks production when human approval is missing', () => {
    const result = evaluateProductionGate({
      localTestsPassed: true,
      buildPassed: true,
      previewReady: true,
      authenticatedBrowserReviewPassed: true,
      securityReviewPassed: true,
      rollbackPathDocumented: true,
      publishSpendDefaultsDisabled: true,
      humanApprovalRecorded: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.gate).toBe('production_blocked');
    expect(result.blockers).toContain('human_approval_missing');
  });

  it('lists every missing production blocker', () => {
    const result = evaluateProductionGate({
      localTestsPassed: false,
      buildPassed: false,
      previewReady: false,
      authenticatedBrowserReviewPassed: false,
      securityReviewPassed: false,
      rollbackPathDocumented: false,
      publishSpendDefaultsDisabled: false,
      humanApprovalRecorded: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual([
      'local_tests_not_green',
      'build_not_green',
      'preview_not_ready',
      'authenticated_browser_review_missing',
      'security_review_missing',
      'rollback_path_missing',
      'publish_spend_defaults_not_disabled',
      'human_approval_missing',
    ]);
  });

  it('allows promotion only after every explicit gate passes', () => {
    const result = evaluateProductionGate({
      localTestsPassed: true,
      buildPassed: true,
      previewReady: true,
      authenticatedBrowserReviewPassed: true,
      securityReviewPassed: true,
      rollbackPathDocumented: true,
      publishSpendDefaultsDisabled: true,
      humanApprovalRecorded: true,
    });

    expect(result).toEqual({
      allowed: true,
      gate: 'human_review',
      blockers: [],
    });
  });
});
