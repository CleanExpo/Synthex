/**
 * Unit tests for lib/marketing-agency/evidence-policy.ts (SYN-MCP-001).
 *
 * Pins the v1 truth table:
 *   sourceRef present                      → 'verified'
 *   absent + claimType evidence-required   → 'blocked'
 *   absent + claimType not required        → 'pending_evidence'
 *
 * And the approve-verb write rule (upgrade-only): 'verified' when the policy
 * is satisfied, otherwise `undefined` (leave evidenceStatus untouched).
 *
 * Also pins that the policy shares EVIDENCE_REQUIRED with the campaign
 * export gate (lib/marketing-agency/evidence.ts) so the two verdicts can
 * never drift (bench must_fix `dual-evidence-logic`).
 */

import {
  deriveEvidenceStatus,
  evidenceStatusOnApprove,
} from '@/lib/marketing-agency/evidence-policy';
import {
  EVIDENCE_REQUIRED,
  evaluateClaimEvidence,
} from '@/lib/marketing-agency/evidence';

describe('deriveEvidenceStatus (v1 truth table)', () => {
  test.each(['factual', 'outcome', 'comparative', 'testimonial'])(
    'sourceRef present + %s → verified',
    claimType => {
      expect(deriveEvidenceStatus({ sourceRefId: 'src-1', claimType })).toBe(
        'verified'
      );
    }
  );

  test('sourceRef present + non-required type → verified', () => {
    expect(
      deriveEvidenceStatus({ sourceRefId: 'src-1', claimType: 'subjective' })
    ).toBe('verified');
  });

  test.each(['factual', 'outcome', 'comparative', 'testimonial'])(
    'no sourceRef + evidence-required type %s → blocked',
    claimType => {
      expect(deriveEvidenceStatus({ sourceRefId: null, claimType })).toBe(
        'blocked'
      );
    }
  );

  test.each(['subjective', 'future-looking', 'observation', 'capability'])(
    'no sourceRef + non-required type %s → pending_evidence',
    claimType => {
      expect(deriveEvidenceStatus({ sourceRefId: undefined, claimType })).toBe(
        'pending_evidence'
      );
    }
  );

  test('empty-string sourceRefId is treated as absent', () => {
    expect(
      deriveEvidenceStatus({ sourceRefId: '', claimType: 'factual' })
    ).toBe('blocked');
  });
});

describe('evidenceStatusOnApprove (upgrade-only write for the approve verb)', () => {
  test('policy satisfied (sourceRef present) → verified', () => {
    expect(
      evidenceStatusOnApprove({ sourceRefId: 'src-1', claimType: 'factual' })
    ).toBe('verified');
  });

  test('policy unsatisfied (no sourceRef, required type) → undefined (untouched)', () => {
    expect(
      evidenceStatusOnApprove({ sourceRefId: null, claimType: 'factual' })
    ).toBeUndefined();
  });

  test('policy unsatisfied (no sourceRef, non-required type) → undefined (untouched)', () => {
    expect(
      evidenceStatusOnApprove({ sourceRefId: null, claimType: 'subjective' })
    ).toBeUndefined();
  });
});

describe('shared EVIDENCE_REQUIRED set (no drift vs export gate)', () => {
  test('the export gate blocks exactly the types the policy blocks', () => {
    for (const claimType of EVIDENCE_REQUIRED) {
      // Policy: no source → blocked.
      expect(deriveEvidenceStatus({ sourceRefId: null, claimType })).toBe(
        'blocked'
      );
      // Export gate: same type without evidence refs → blocked export.
      const gate = evaluateClaimEvidence([
        {
          id: 'c1',
          text: 'x',
          type: claimType as never,
          evidenceRefs: [],
        },
      ]);
      expect(gate.status).toBe('blocked');
    }
  });

  test('a non-required type passes both layers without evidence', () => {
    expect(
      deriveEvidenceStatus({ sourceRefId: null, claimType: 'subjective' })
    ).toBe('pending_evidence');
    const gate = evaluateClaimEvidence([
      { id: 'c1', text: 'x', type: 'subjective', evidenceRefs: [] },
    ]);
    expect(gate.status).toBe('pass');
  });
});
