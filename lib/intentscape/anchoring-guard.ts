import {
  type AnchoringAudit,
  type AnchoringIssue,
  type VisionMap,
  VISION_LENSES,
} from './contracts';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'have',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'we',
  'with',
]);

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter(token => token.length > 1 && !STOP_WORDS.has(token))
  );
}

function tokenSimilarity(
  left: string,
  right: string
): {
  jaccard: number;
  originCoverage: number;
} {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  if (a.size === 0 || b.size === 0) {
    return { jaccard: 0, originCoverage: 0 };
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return {
    jaccard: union === 0 ? 0 : intersection / union,
    originCoverage: intersection / a.size,
  };
}

export type AnchorMatch = 'exact' | 'near' | null;

export function detectAnchorMatch(
  originSignal: string,
  candidate: string
): AnchorMatch {
  const origin = normalizeText(originSignal);
  const compared = normalizeText(candidate);
  if (!origin || !compared) return null;

  if (
    origin === compared ||
    origin.includes(compared) ||
    compared.includes(origin)
  ) {
    return 'exact';
  }

  const { jaccard, originCoverage } = tokenSimilarity(origin, compared);
  if (jaccard >= 0.72 || originCoverage >= 0.82) return 'near';
  return null;
}

function anchorIssue(
  originSignal: string,
  candidate: string,
  path: string
): AnchoringIssue | null {
  const match = detectAnchorMatch(originSignal, candidate);
  if (!match) return null;
  return {
    code: match === 'exact' ? 'origin-copy' : 'near-copy',
    path,
    message:
      match === 'exact'
        ? 'Candidate copies the origin signal and cannot gain goal authority.'
        : 'Candidate is too close to the origin signal to demonstrate independent vision expansion.',
  };
}

function mechanismSimilarity(left: string, right: string): number {
  return tokenSimilarity(left, right).jaccard;
}

export function auditVisionMap(
  originSignal: string,
  visionMap: VisionMap,
  checkedAt = new Date().toISOString()
): AnchoringAudit {
  const issues: AnchoringIssue[] = [];
  const seenLenses = new Set<string>();

  visionMap.lensFindings.forEach((finding, index) => {
    if (seenLenses.has(finding.lens)) {
      issues.push({
        code: 'duplicate-lens',
        path: `lensFindings.${index}.lens`,
        message: `Lens ${finding.lens} appears more than once.`,
      });
    }
    seenLenses.add(finding.lens);
  });

  for (const lens of VISION_LENSES) {
    if (!seenLenses.has(lens)) {
      issues.push({
        code: 'missing-lens',
        path: 'lensFindings',
        message: `Required independent lens ${lens} is missing.`,
      });
    }
  }

  visionMap.researchBranches.forEach((branch, index) => {
    const issue = anchorIssue(
      originSignal,
      branch.question,
      `researchBranches.${index}.question`
    );
    if (issue) issues.push(issue);
  });

  const branchIds = new Set(
    visionMap.researchBranches.map(branch => branch.id)
  );
  visionMap.hypotheses.forEach((hypothesis, index) => {
    const desiredChangeIssue = anchorIssue(
      originSignal,
      hypothesis.desiredChange,
      `hypotheses.${index}.desiredChange`
    );
    if (desiredChangeIssue) issues.push(desiredChangeIssue);

    for (const branchId of hypothesis.researchBranchIds) {
      if (!branchIds.has(branchId)) {
        issues.push({
          code: 'unlinked-research-branch',
          path: `hypotheses.${index}.researchBranchIds`,
          message: `Hypothesis references missing research branch ${branchId}.`,
        });
      }
    }

    if (hypothesis.researchBranchIds.length === 0) {
      issues.push({
        code: 'missing-research-branch',
        path: `hypotheses.${index}.researchBranchIds`,
        message: 'Every hypothesis needs decision-changing research.',
      });
    }
  });

  for (let left = 0; left < visionMap.hypotheses.length; left += 1) {
    for (
      let right = left + 1;
      right < visionMap.hypotheses.length;
      right += 1
    ) {
      const leftHypothesis = visionMap.hypotheses[left];
      const rightHypothesis = visionMap.hypotheses[right];
      if (!leftHypothesis || !rightHypothesis) continue;
      if (
        mechanismSimilarity(
          leftHypothesis.causalMechanism,
          rightHypothesis.causalMechanism
        ) >= 0.65
      ) {
        issues.push({
          code: 'duplicate-mechanism',
          path: `hypotheses.${left}.causalMechanism`,
          message: `Hypotheses ${leftHypothesis.id} and ${rightHypothesis.id} do not differ enough in causal mechanism.`,
        });
      }
    }
  }

  return { passed: issues.length === 0, issues, checkedAt };
}

export function auditGoalCandidate(
  originSignal: string,
  desiredChange: string,
  checkedAt = new Date().toISOString()
): AnchoringAudit {
  const issue = anchorIssue(originSignal, desiredChange, 'desiredChange');
  const issues = issue ? [issue] : [];
  return { passed: issues.length === 0, issues, checkedAt };
}

export const __testing = {
  meaningfulTokens,
  normalizeText,
  tokenSimilarity,
};
