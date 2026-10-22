/**
 * CARSI is a company insured as a training organisation for Australian
 * insurance purposes. It is not a registered training organisation, so its
 * markup must never claim national recognition, AQF qualifications or RTO
 * status (founder decision, 22/10/2026). Structured data is copy that search
 * and answer engines repeat, so the guard runs on every string a course pack
 * emits.
 */

const ACCREDITATION_CLAIM =
  /nationally\s+recogni[sz]ed|\bAQF\b|registered\s+training\s+organi[sz]ation|\bRTO\b/i;

export class AccreditationClaimError extends Error {
  constructor(readonly field: string) {
    super(
      `Refusing accreditation claim in ${field}: CARSI is not a registered training organisation`
    );
    this.name = 'AccreditationClaimError';
  }
}

export function assertNoAccreditationClaims(
  fields: Record<string, string | undefined>
): void {
  for (const [field, text] of Object.entries(fields)) {
    if (text && ACCREDITATION_CLAIM.test(text)) {
      throw new AccreditationClaimError(field);
    }
  }
}
