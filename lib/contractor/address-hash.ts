/**
 * Address hashing utility for SYN-836 contractor onboarding.
 *
 * Q3.2.5 P10 binding: raw street addresses are PII. They are NEVER stored,
 * NEVER logged. The hash is what flows through the event pipeline + audit
 * trail. P16 deletion preserves the hashed record (de-identified) but cannot
 * recover the raw address — this is by design.
 *
 * @see SYN-836 (parent: SYN-834 epic)
 */

// `crypto` is loaded lazily inside `hashAddress()`. Reached from
// instrumentation.ts via the nrpg-pipeline-bootstrap chain which is compiled
// for both Node and Edge targets. Top-level Node imports break the Edge
// bundle build; lazy require keeps webpack's static analysis clean while
// preserving runtime behaviour (this code path only executes on Node).

/**
 * Normalise a raw address before hashing. Lowercases, collapses whitespace,
 * strips common noise (commas, periods inside abbreviations) so two callers
 * who pass the "same" address produce the same hash.
 *
 * NOT a perfect address normaliser — that would need geocoding. This is
 * just enough to handle "12 Smith St, Brisbane" vs "12  smith  st brisbane".
 */
export function normaliseAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,.;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hash a raw address to a 64-char hex sha256 digest.
 * The full 64 chars are used (not truncated) because we need low collision
 * probability across the AU contractor base.
 *
 * @throws Error if the input is empty after normalisation.
 */
export function hashAddress(raw: string): string {
  if (typeof raw !== 'string') {
    throw new Error('hashAddress: input must be a string');
  }
  const normalised = normaliseAddress(raw);
  if (normalised.length === 0) {
    throw new Error('hashAddress: input is empty after normalisation');
  }
  // `eval('require')` so webpack can't statically resolve `crypto` during
  // Edge bundle compilation. Safe — this code path only runs on Node
  // (gated by instrumentation.ts NEXT_RUNTIME === 'nodejs').
  const nodeRequire = eval('require') as NodeRequire;
  const { createHash } = nodeRequire('crypto') as typeof import('crypto');
  return createHash('sha256').update(normalised, 'utf-8').digest('hex');
}
