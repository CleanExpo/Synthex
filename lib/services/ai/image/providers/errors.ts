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
