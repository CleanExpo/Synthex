"""
Browser-harness smoke test — Usage dashboard (PR 2, Phase 3)

Loads /dashboard/usage and verifies the page renders the three metric
bars (posts, ai generations, networks) without runtime errors.

Run:
    BU_NAME=phase3 browser-harness < tests/ui-smoke/usage-page.harness.py
"""

import os

BASE_URL = os.environ.get("SYNTHEX_BASE_URL", "http://localhost:3000")

new_tab(f"{BASE_URL}/dashboard/usage")
wait_for_load()

# Wait briefly for SWR to settle.
js("""
return new Promise(r => setTimeout(r, 1000));
""")

# Verify the three bars exist.
posts_present = js(
    "!!document.querySelector('[data-testid=\"metric-posts\"]')"
)
ai_present = js(
    "!!document.querySelector('[data-testid=\"metric-ai-generations\"]')"
)
networks_present = js(
    "!!document.querySelector('[data-testid=\"metric-networks\"]')"
)

assert posts_present, "metric-posts missing"
assert ai_present, "metric-ai-generations missing"
assert networks_present, "metric-networks missing"

# Verify each bar has a usable data-pct attribute.
posts_pct = js(
    "document.querySelector('[data-testid=\"metric-posts-bar\"]')?.getAttribute('data-pct')"
)
assert posts_pct, "metric-posts-bar missing data-pct"

capture_screenshot("tests/ui-smoke/_artifacts/usage-page.png")

print(f"PASS — Usage page renders 3 metric bars (posts-pct={posts_pct})")
