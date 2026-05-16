"""
Browser-harness smoke test — Billing settings page (PR 1, Phase 3)

Loads /dashboard/settings/billing and verifies the page renders without
runtime errors, the current-plan card is visible, and the plan picker
exposes the expected plan rows.

Run:
    BU_NAME=phase3 browser-harness < tests/ui-smoke/billing-page.harness.py
"""

import os

BASE_URL = os.environ.get("SYNTHEX_BASE_URL", "http://localhost:3000")

new_tab(f"{BASE_URL}/dashboard/settings/billing")
wait_for_load()

# Wait briefly for SWR to settle, then verify the page primitives.
js("""
return new Promise(r => setTimeout(r, 800));
""")

current_plan_present = js(
    "!!document.querySelector('[data-testid=\"current-plan\"]')"
)
assert current_plan_present, "current-plan card missing"

pro_row_present = js(
    "!!document.querySelector('[data-testid=\"plan-row-pro\"]')"
)
growth_row_present = js(
    "!!document.querySelector('[data-testid=\"plan-row-growth\"]')"
)
scale_row_present = js(
    "!!document.querySelector('[data-testid=\"plan-row-scale\"]')"
)
assert pro_row_present and growth_row_present and scale_row_present, (
    "plan picker missing one of pro/growth/scale rows"
)

# Capture for review record.
capture_screenshot("tests/ui-smoke/_artifacts/billing-page.png")

# Check there are no uncaught JS errors on the page load.
errors = js("""
return window.__BH_errors || [];
""")
assert not errors, f"page logged JS errors: {errors}"

print("PASS — Billing settings page renders with current-plan + plan picker")
