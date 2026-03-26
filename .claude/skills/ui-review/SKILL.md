---
name: ui-review
description: >-
  Synthex UI validation agent. NEVER run generic Lighthouse audits without
  grounding findings in Synthex's dark glassmorphic interface. NEVER reference
  pnpm. ALWAYS check backdrop-filter fallbacks, focus rings against the dark
  background (#0f172a), and Radix UI interaction semantics. Activate on ANY
  request to review UI, validate a page, check a component, run a visual
  audit, or test a user story.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: capability-uplift-visual
  triggers:
    - ui review
    - ui-review
    - user story validation
    - browser validation
    - visual regression
    - playwright story
    - review
    - validate
    - check ui
    - visual audit
    - user story
    - page check
  requires:
    - api-testing
context: fork
---

# UI Review Agent

## Purpose

Validates Synthex UI flows by executing structured user story Markdown files
through Playwright browser automation. Each story describes a sequence of
browser interactions and assertions. The agent runs each story, captures
screenshots as evidence, and emits a summary report of pass/fail results.

This is distinct from `code-review` (static analysis) and `api-testing`
(HTTP-level testing). UI Review validates the rendered app as a real user
would experience it.

## When to Use

Activate this skill when:

- Validating a new feature works end-to-end in the browser
- Running UI regression checks before a release
- Verifying auth flows (login, signup, password reset) behave correctly
- Confirming dashboard and campaign pages load without console errors
- Spot-checking a fix that affected user-visible behaviour

## When NOT to Use This Skill

- When reviewing code quality or TypeScript compliance (use `code-review`)
- When testing API endpoints directly without a browser (use `api-testing`)
- When auditing database schema or migrations (use `database-prisma`)
- When assessing visual design or aesthetics (use `design` or `ui-ux`)
- Instead use: `e2e` Playwright tests for automated CI coverage

## Tech Stack

- **Browser automation**: Playwright (already in Synthex dev dependencies)
- **Story format**: Markdown files with YAML frontmatter (stored in `.claude/skills/ui-review/stories/`)
- **Screenshots**: Saved to `.claude/skills/ui-review/results/screenshots/` (gitignored)
- **Reports**: Saved to `.claude/skills/ui-review/results/` (gitignored)
- **Target app**: `http://localhost:3000` (default) or URL from story frontmatter

## Instructions

### init — Set up story directories

1. Confirm `.claude/skills/ui-review/stories/` exists (create if not)
2. Confirm `.claude/skills/ui-review/results/` directory exists (create if not, gitignored)
3. Copy `stories/_template.md` to `stories/<feature-name>.md` if creating a new story
4. Confirm `.gitignore` excludes `results/` and `results/screenshots/`

### run — Execute all stories (or a single story)

1. **Discover stories** — List all `.md` files in `.claude/skills/ui-review/stories/` except `_template.md`
2. **Parse frontmatter** — Extract `name`, `url`, `priority` from each story
3. **Sort by priority** — Execute `high` before `medium` before `low`
4. **For each story**:
   a. Open Playwright browser (Chromium headless)
   b. Navigate to the story's `url`
   c. Execute each numbered step in order
   d. After each step, check assertions from `## Expected`
   e. Capture screenshot on failure (and optionally on success if `--screenshots` flag)
   f. Record pass/fail for the story
5. **Write results** — Save JSON report to `results/<timestamp>-report.json`
6. **Emit summary** — Output table of story name, status, failed step (if any)

Parallel execution: when `--parallel N` is specified, run N stories concurrently.

### report — Generate human-readable summary

1. Read most recent JSON report from `results/`
2. Render a Markdown table: story name | priority | status | failed step
3. List any screenshots captured for failed stories
4. Output overall pass rate and recommendation (pass / investigate / block release)

## Story File Format

Stories live in `.claude/skills/ui-review/stories/`. File: `stories/_template.md`
provides the canonical template.

```markdown
---
name: Story Name
url: http://localhost:3000
priority: high
---

## Preconditions

- Application running on localhost:3000
- Test user exists (test@synthex.social / <password from .env.test>)

## Steps

1. Navigate to /login
2. Enter email "test@synthex.social"
3. Enter password from environment
4. Click "Sign In" button
5. Wait for page load

## Expected

- Redirect to /dashboard within 3 seconds
- Dashboard heading is visible
- No console errors
```

Priority values: `high`, `medium`, `low`

## Input Specification

| Parameter   | Type   | Required | Description                                          |
| ----------- | ------ | -------- | ---------------------------------------------------- |
| command     | string | yes      | `init`, `run`, or `report`                           |
| story       | string | no       | Story file name to run a single story (omit for all) |
| parallel    | number | no       | Number of concurrent stories (default: 1)            |
| screenshots | bool   | no       | Capture screenshots on success as well as failure    |
| url         | string | no       | Override base URL (default: from story frontmatter)  |

## Output Specification

| Field       | Type        | Description                             |
| ----------- | ----------- | --------------------------------------- |
| story       | string      | Story name from frontmatter             |
| status      | pass/fail   | Overall story result                    |
| failed_step | string/null | First step that failed, or null on pass |
| screenshots | string[]    | Paths to captured screenshots           |
| duration_ms | number      | Execution time in milliseconds          |
| report_path | string      | Path to full JSON report                |

## Error Handling

| Error                    | Action                                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| App not running          | Abort with `ERROR: app not reachable at <url>` — start dev server first |
| Story file malformed     | Skip story, log parse error, continue with remaining                    |
| Step timeout (>10s)      | Mark step as failed, capture screenshot, move to next story             |
| Selector not found       | Mark step as failed with selector detail                                |
| Console error detected   | Flag as warning unless story explicitly expects errors                  |
| Playwright not installed | Emit `npx playwright install chromium` fix command                      |

## Synthex-Specific Story Guidance

- **Auth precondition**: Stories that require login should use a dedicated test
  account — never hardcode credentials. Reference env vars like `TEST_USER_EMAIL`.
- **Base URL**: Use `http://localhost:3000` for local runs. CI stories should
  use the preview deployment URL from `VERCEL_URL`.
- **Australian English**: Story names and descriptions follow project conventions.
- **Org scoping**: Stories that test organisation-specific pages must include
  org setup in preconditions.
- **No production runs**: Never point stories at the production URL
  (`synthex.social`) — use staging or local only.

## Key Directories

- `.claude/skills/ui-review/stories/` — Story Markdown files (version controlled)
- `.claude/skills/ui-review/results/` — Test reports and screenshots (gitignored)
- `app/` — Pages being tested
- `e2e/` — Playwright E2E tests (separate from stories; stories are agent-driven)

## Commands

```bash
# Run all UI stories (agent-driven via this skill)
just ui-review

# Run Playwright E2E tests (automated suite, separate)
npm run e2e

# Install Playwright browsers if missing
npx playwright install chromium
```

## Integration Points

- Works with **api-testing** to confirm UI actions trigger correct API calls
- Coordinates with **code-review** when a story failure points to a code defect
- Reports to **qa-sentinel** (when active) for release gate decisions
- Complements the Playwright `e2e/` suite — stories are exploratory/agent-driven,
  E2E tests are regression-locked

---

## Capability Uplift — Override Defaults

**NEVER** apply generic accessibility or visual review criteria without
adapting them to Synthex's dark glassmorphic context. Never call `pnpm`
commands — this project uses `npm`.

**INSTEAD** every UI review validates against Synthex's specific interface:

- Backdrop-filter fallback for browsers that don't support it
  (fallback: `background: rgba(15, 23, 42, 0.9)`)
- Focus rings visible against #0f172a: `outline-color` must be #f97316 or white,
  `outline-offset: 2px`
- Glass borders: `1px solid rgba(255, 255, 255, 0.12)` — never solid white
- Text contrast checked against the actual surface colour, not white

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`
