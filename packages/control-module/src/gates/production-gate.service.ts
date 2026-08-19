export interface ProductionGateInput {
  localTestsPassed: boolean;
  buildPassed: boolean;
  previewReady: boolean;
  authenticatedBrowserReviewPassed: boolean;
  securityReviewPassed: boolean;
  rollbackPathDocumented: boolean;
  publishSpendDefaultsDisabled: boolean;
  humanApprovalRecorded: boolean;
}

export interface ProductionGateResult {
  allowed: boolean;
  gate: 'human_review' | 'production_blocked';
  blockers: string[];
}

const BLOCKERS: Array<[keyof ProductionGateInput, string]> = [
  ['localTestsPassed', 'local_tests_not_green'],
  ['buildPassed', 'build_not_green'],
  ['previewReady', 'preview_not_ready'],
  ['authenticatedBrowserReviewPassed', 'authenticated_browser_review_missing'],
  ['securityReviewPassed', 'security_review_missing'],
  ['rollbackPathDocumented', 'rollback_path_missing'],
  ['publishSpendDefaultsDisabled', 'publish_spend_defaults_not_disabled'],
  ['humanApprovalRecorded', 'human_approval_missing'],
];

export function evaluateProductionGate(
  input: ProductionGateInput
): ProductionGateResult {
  const blockers = BLOCKERS.filter(([key]) => !input[key]).map(
    ([, blocker]) => blocker
  );

  return {
    allowed: blockers.length === 0,
    gate: blockers.length === 0 ? 'human_review' : 'production_blocked',
    blockers,
  };
}
