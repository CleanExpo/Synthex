/**
 * CARSI is a company insured as a training organisation for Australian
 * insurance purposes. It is not a registered training organisation, so its
 * markup must never claim national recognition, AQF qualifications or RTO
 * status (founder decision, 22/10/2026). Structured data is copy that search
 * and answer engines repeat, so the guard runs on every string a course pack
 * emits.
 *
 * It is a defined-term filter over four families, not a judge of meaning:
 *   1. national(ly) recognised / recognition / accredited
 *   2. AQF, any mention
 *   3. RTO(s), Registered Training Org / Organisation(s)
 *   4. ASQA (the RTO regulator), any mention
 * Whether the facts passed in are true is the client manifest's job.
 */

const ACCREDITATION_CLAIM =
  /national(?:ly)?[\s-]+(?:recogni[sz]ed|recognition|accredited)|\bAQF\b|registered[\s-]+training[\s-]+org(?:ani[sz]ations?|s)?\b|\bASQA\b|\bRTOs?\b/i;

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
