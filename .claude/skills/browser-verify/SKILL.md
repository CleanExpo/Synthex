---
name: browser-verify
description: >-
  Autonomous browser-based verification of implemented features. Closes the
  verification gate without human intervention by navigating to a URL, capturing
  a screenshot, checking for console errors, confirming visible elements, and
  producing a structured PASS/FAIL report. Use immediately after implementing
  any UI feature, fixing a visual bug, or as the final step in the
  verification-gate.md checklist. Also use when the user asks "check if X is
  working in the browser", "verify the dashboard", or "confirm the page loads".
metadata:
  author: synthex
  version: '1.0'
  type: action-skill
  triggers:
    - verify in browser
    - check if it works
    - browser verification
    - visual confirmation
    - screenshot
    - does the page load
    - confirm feature visible
    - close verification gate
context: fork
---

# Browser Verification Skill

## Purpose

Autonomously verify that a feature, page, or fix is working correctly in a
real browser session — without requiring Phill to manually open a browser.

This skill produces a structured PASS/FAIL report that satisfies the
`verification-gate.md` requirement.

---

## Tool Selection

| Scenario                          | Preferred MCP                  |
| --------------------------------- | ------------------------------ |
| Navigate + screenshot + console   | `mcp__chrome-devtools__*`      |
| Authenticated user journey        | `mcp__Claude_in_Chrome__*`     |
| Click / fill / assert             | `mcp__plugin_playwright_playwright__*` |
| Dev server preview (localhost)    | `mcp__Claude_Preview__*`       |

**Primary tool:** Chrome DevTools MCP for most verifications.
**Fallback:** Claude in Chrome if DevTools tab is not open.

---

## Verification Protocol

Execute all 5 steps. Do not skip steps. Report each result immediately.

### Step 1 — Navigate

```
mcp__chrome-devtools__navigate_page(url)
  OR
mcp__Claude_in_Chrome__navigate(url)
```

- Target: the feature URL (production: `https://synthex.social/...` or dev: `http://localhost:3000/...`)
- Wait for page to fully load before proceeding

### Step 2 — Screenshot

```
mcp__chrome-devtools__take_screenshot()
  OR
mcp__Claude_in_Chrome__upload_image (use read_page for content)
```

- Capture full-page screenshot
- Visually confirm: expected UI elements are present and laid out correctly
- Flag: blank areas, 404 content, loading spinners that haven't resolved, overlapping elements

### Step 3 — Console Check

```
mcp__chrome-devtools__list_console_messages()
  OR
mcp__Claude_in_Chrome__read_console_messages()
```

**FAIL conditions (any of these = verification FAIL):**
- `[Error]` messages (unless pre-existing, documented in `.claude/memory/compass.md`)
- Unhandled promise rejections
- React hydration errors (`Hydration failed`, `Text content does not match`)
- Auth errors that shouldn't appear (`401`, `403`, `Unauthorised`)
- Network failures to required API endpoints

**PASS conditions:**
- Zero error-level messages
- Warnings only (acceptable — do not fail on warnings)

### Step 4 — Network Check

```
mcp__chrome-devtools__list_network_requests()
  OR
mcp__Claude_in_Chrome__read_network_requests()
```

**Check for:**
- Any API calls returning 5xx (server errors) → FAIL
- Any API calls returning 401/403 unexpectedly → FAIL
- Key data endpoints loaded successfully (200/304) → PASS
- No CORS errors → PASS

### Step 5 — Element Verification

For the specific feature being verified, confirm expected elements are present:

```
mcp__chrome-devtools__take_snapshot()
  OR
mcp__Claude_in_Chrome__find(selector)
```

Check the specific observable outcomes from the verification checklist:
- Required text, headings, or labels visible
- Interactive elements (buttons, links) present and not disabled unexpectedly
- Data sections populated (not empty/loading)
- No error state banners when data should be present

---

## Authenticated Route Protocol

If the target URL requires authentication (`/dashboard/...`):

1. First use `browser-auth` skill to establish a session
2. Confirm auth cookie is present
3. Then proceed with Steps 2–5 above

If auth is not available in the current browser session:
- Report: "Authentication required — run `browser-auth` skill first, then retry"

---

## Output Format

Always produce this report:

```markdown
## Browser Verification Report — [Feature Name]

**URL:** [verified URL]
**Timestamp:** [HH:MM DD/MM/YYYY]
**Environment:** production (synthex.social) | development (localhost:3000)

### Screenshot
[Description of what was visible — or attach screenshot]

### Console
- Errors: [count] — [list errors, or "None"]
- Warnings: [count] (not blocking)

### Network
- Failed requests: [count] — [list, or "None"]
- Key API responses: [list with status codes]

### Element Check
- [Expected element 1]: ✅ Present | ❌ Missing
- [Expected element 2]: ✅ Present | ❌ Missing

---
### Result: ✅ PASS | ❌ FAIL

**PASS criteria met:** [list which criteria passed]
**Blockers (if FAIL):** [exact error messages or missing elements]
**Next action:** [only if FAIL — specific remediation step]
```

---

## Pass / Fail Rules

| Condition                                        | Result |
| ------------------------------------------------ | ------ |
| Page loads, no console errors, elements present  | ✅ PASS |
| Any `[Error]` in console                         | ❌ FAIL |
| Any 5xx network response on a required endpoint  | ❌ FAIL |
| Blank page or full-page error boundary           | ❌ FAIL |
| Expected element missing                         | ❌ FAIL |
| Unexpected redirect (e.g. sent to /login)        | ❌ FAIL |
| Warnings only (no errors)                        | ✅ PASS |
| 3rd-party non-critical 4xx (analytics, etc.)     | ✅ PASS |

---

## Replacing the Human Verification Gate

After producing a PASS report, replace the standard verification checklist
with:

```
✅ Browser verification PASSED — autonomous check via browser-verify skill.
[Paste the Browser Verification Report above]
```

A PASS report from this skill satisfies `verification-gate.md` requirements
for UI/feature changes. The human review gate (PR merge) still applies.
