/**
 * Customer-facing copy for AI / publish failures.
 * Never surface provider codes or token-like strings.
 */

export function humanizeAiError(
  error: string | undefined,
  status?: number
): string {
  const text = (error ?? '').trim();
  const lower = text.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /unauthorized|user not found|api[_ ]key|invalid key|openrouter/i.test(lower)
  ) {
    return 'We could not reach the writing assistant. Check Settings → AI Credentials, then try again.';
  }
  if (status === 429 || /rate limit|too many/i.test(lower)) {
    return 'Too many drafts just now. Wait a minute and try again.';
  }
  if (/organisation|organization|provision/i.test(lower)) {
    return 'Your account is still finishing setup. Refresh, or complete onboarding first.';
  }
  if (!text || text.length > 140 || /token|sk-|bearer /i.test(lower)) {
    return 'We could not create a draft. Try again in a moment.';
  }
  return text;
}

/** Blocked publish / schedule — customer sentence + next step. */
export function humanizePublishBlocker(
  error: string | undefined,
  status?: number
): string {
  const text = (error ?? '').trim();
  const lower = text.toLowerCase();

  if (
    /platform_credentials|not connected|oauth|token expired|needsrefresh|insufficientpermissions/i.test(
      lower
    )
  ) {
    return 'That account is not ready. Open Platforms, connect or refresh it, then try again. You can still save a draft.';
  }
  if (/practice|shadow|live.?mode|not live/i.test(lower)) {
    return 'You are in practice mode. The post stays in Synthex until you switch to Live on Calendar.';
  }
  if (/empty|no content|required.*content|body/i.test(lower)) {
    return 'There is nothing to send. Add the post text, then schedule or post.';
  }
  if (status === 401 || status === 403) {
    return 'Sign in again, then retry. If it still fails, check Platforms.';
  }
  if (!text || text.length > 140 || /token|sk-|bearer /i.test(lower)) {
    return 'We could not schedule that post. Check Platforms, then try again.';
  }
  return text;
}
