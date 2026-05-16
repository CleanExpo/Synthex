"""
Browser-harness smoke test — BillingStatusBanner (PR 3, Phase 3)

Verifies that the global billing-status banner renders only when the
dunning state API returns a non-current state. Uses the in-page
network interception pattern (route-level mock) so the test doesn't
require a real failed-payment fixture in production data.

Run:
    BU_NAME=phase3 browser-harness < tests/ui-smoke/dunning-banner.harness.py

Pre-requisites:
    - Synthex dev server running on http://localhost:3000
    - A test user session cookie set (export SYNTHEX_TEST_COOKIE or pre-login)
"""

import os

BASE_URL = os.environ.get("SYNTHEX_BASE_URL", "http://localhost:3000")

# 1. Open the dashboard.
new_tab(f"{BASE_URL}/dashboard")
wait_for_load()

# 2. Inject a fetch interceptor that forces the dunning-state API to return
#    `past_due` so the banner becomes visible. The banner SWR will revalidate
#    on the next refresh tick or on a hard reload.
js("""
const origFetch = window.fetch;
window.__bannerMockState = 'past_due';
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (url && url.includes('/api/billing/dunning-state')) {
    return new Response(
      JSON.stringify({
        state: window.__bannerMockState,
        failedAttempts: 1,
        nextRetryAt: new Date(Date.now() + 86400000).toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return origFetch(input, init);
};
""")

# 3. Hard reload so SWR re-fetches under the interceptor.
js("location.reload();")
wait_for_load()

# Re-install the interceptor (lost across reload).
js("""
const origFetch = window.fetch;
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (url && url.includes('/api/billing/dunning-state')) {
    return new Response(
      JSON.stringify({ state: 'past_due', failedAttempts: 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return origFetch(input, init);
};
""")

# Force SWR revalidation by re-triggering the page (banner uses SWR refresh).
js("location.reload();")
wait_for_load()

# 4. Verify the banner is in the DOM and shows the past_due state.
banner_present = js(
    "document.querySelector('[data-testid=\"billing-status-banner\"]')?.getAttribute('data-state')"
)

assert banner_present == "past_due", (
    f"Expected past_due banner; got: {banner_present!r}"
)

# 5. Screenshot for the PR review record.
capture_screenshot("tests/ui-smoke/_artifacts/dunning-banner-past-due.png")

# 6. Verify graceful absence: mock `current` → banner must NOT render.
js("""
const origFetch = window.fetch;
window.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (url && url.includes('/api/billing/dunning-state')) {
    return new Response(
      JSON.stringify({ state: 'current' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return origFetch(input, init);
};
location.reload();
""")
wait_for_load()

banner_absent = js(
    "document.querySelector('[data-testid=\"billing-status-banner\"]') === null"
)
assert banner_absent, "Banner must NOT render when state=current"

print("PASS — BillingStatusBanner renders for past_due and hides for current")
