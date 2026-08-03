/**
 * Provider failures that PROVE no request was ever sent.
 *
 * Spend accounting errs high everywhere else: an attempt is recorded before the
 * call with an unknown cost, and settlement charges the reservation rate for
 * anything it cannot price, because a call that may have been billed must never
 * look free. That posture is right when the outcome is genuinely unknown — a
 * timeout, a dropped connection, a 5xx after the request was accepted.
 *
 * It is wrong when the adapter can prove locally that nothing left the process.
 * A missing API key fails before `fetch` is reached, so there is no request, no
 * provider-side record and nothing to bill. Charging for it is not caution, it
 * is invention: a grounded variant with no key would otherwise be billed for
 * the LoRA try, the FLUX fallback and the FLUX retry having made zero calls,
 * multiplied by every variant of the batch (SYN-1115 round-8).
 *
 * Throw this ONLY from a guard that runs before any network I/O. Anything that
 * could conceivably have reached the provider must stay an ordinary error.
 */
export class ProviderNotConfiguredError extends Error {
  /** Discriminator for callers that cannot rely on `instanceof` across bundles. */
  public readonly neverReachedProvider = true as const;

  constructor(
    public readonly provider: string,
    public readonly missing: string
  ) {
    super(`${provider} is not configured: ${missing} is missing`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** True for a failure that provably never reached the provider. */
export function neverReachedProvider(error: unknown): boolean {
  return (
    error instanceof ProviderNotConfiguredError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { neverReachedProvider?: unknown }).neverReachedProvider ===
        true)
  );
}

/**
 * Did this rejection provably happen BEFORE the request reached the network —
 * so nothing can have been billed?
 *
 * Node surfaces these as an `UND_ERR_*` / `ECONNREFUSED` / `ENOTFOUND` code on
 * the error or its `cause`. A timeout or abort is deliberately NOT in the set:
 * the request was already in flight, so the provider may have accepted it.
 *
 * Unrecognised shapes are AMBIGUOUS, not pre-dispatch. Erring toward "may have
 * been billed" over-charges a rare unknown; erring the other way writes off
 * real spend and returns admission headroom, which is the failure this whole
 * area exists to prevent.
 *
 * Lives HERE, beside ProviderNotConfiguredError, rather than in the video
 * adapter where it started: both media paths reach providers over the same
 * network and make the same billed-or-not judgement. Keeping it in one module
 * is what stops the next fix covering one half again (SYN-1115 release review,
 * pass 11 — the video-only version let an ENOTFOUND through the image path
 * settle positive spend for a failed generation).
 */
export function isPreDispatchFailure(error: unknown): boolean {
  const code =
    (error as { cause?: { code?: unknown } } | null)?.cause?.code ??
    (error as { code?: unknown } | null)?.code;
  return (
    typeof code === 'string' &&
    [
      'ENOTFOUND', // DNS could not resolve the host
      'EAI_AGAIN', // DNS lookup timed out — no connection opened
      'ECONNREFUSED', // host reachable, nothing listening
      'UND_ERR_CONNECT_TIMEOUT', // connection never established
      'CERT_HAS_EXPIRED',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
    ].includes(code)
  );
}
