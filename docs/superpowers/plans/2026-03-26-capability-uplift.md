# Capability Uplift — Skill & Agent System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Override LLM default patterns (Inter font, purple gradients, generic AI voice, hollow code patterns) across all 40+ Synthex skills and 9 agents by building a shared standards layer and adding explicit Capability Uplift blocks to every output-generating skill.

**Architecture:** Sprint 1 creates the `synthex-standards` shared reference layer (5 new files). Sprints 2–4 add uplift blocks + aggressive frontmatter to 16 skills across 3 categories. Sprint 5 upgrades 9 agents. Sprint 6 tags 18 reference skills with `type: reference-skill`. One commit per skill/agent. Each sprint ends clean (`git status` shows nothing staged).

**Tech Stack:** Markdown skill files with YAML frontmatter. `.claude/skills/` and `.claude/agents/` directories. No TypeScript changes — verification is `git diff --stat` showing insertions only, not type-check.

**Spec:** `docs/superpowers/specs/2026-03-26-capability-uplift-design.md`

---

## Sprint 1 — Foundation

### Task 1: Create the synthex-standards shared layer

**Files:**

- Create: `.claude/skills/synthex-standards/SKILL.md`
- Create: `.claude/skills/synthex-standards/references/aesthetic-standards.md`
- Create: `.claude/skills/synthex-standards/references/content-standards.md`
- Create: `.claude/skills/synthex-standards/references/code-standards.md`
- Create: `.claude/skills/synthex-standards/references/data-viz-standards.md`

- [ ] **Step 1: Create the directory and SKILL.md**

Create `.claude/skills/synthex-standards/SKILL.md` with this exact content:

```markdown
---
name: synthex-standards
description: >-
  Synthex Capability Uplift master reference. Contains the authoritative
  anti-patterns and replacement standards that override LLM defaults across
  ALL Synthex skills. ALWAYS read the relevant reference file before producing
  UI, content, chart, or code output. Activate on any visual, content, code,
  campaign, brand, analytics, or design task.
metadata:
  author: synthex
  version: '1.0'
  type: capability-uplift-master
  triggers:
    - design
    - ui
    - component
    - visual
    - content
    - campaign
    - post
    - code
    - route
    - api
    - database
    - query
    - chart
    - analytics
    - brand
    - typography
    - colour
    - color
    - layout
    - styling
    - image
    - prompt
---

# Synthex Standards — Capability Uplift Master Reference

This skill overrides the LLM's baked-in default patterns with Synthex-specific
standards. Read the relevant reference file before producing any output.

## Reference Files

| Domain                                    | File                                | When to Use                      |
| ----------------------------------------- | ----------------------------------- | -------------------------------- |
| Visual design, typography, colour, layout | `references/aesthetic-standards.md` | Any UI / component / visual work |
| Charts, graphs, dashboards                | `references/data-viz-standards.md`  | Any data visualisation           |
| Content, voice, campaigns, posts          | `references/content-standards.md`   | Any content generation           |
| Code, API routes, database queries        | `references/code-standards.md`      | Any code production              |

## Core Principle

Every output-generating skill must explicitly name what it is NOT doing (the LLM
default) and what it IS doing (the Synthex standard). Generic is failure.
Specific is the standard.
```

- [ ] **Step 2: Create aesthetic-standards.md**

Create `.claude/skills/synthex-standards/references/aesthetic-standards.md`:

````markdown
# Aesthetic Standards — Synthex Visual Design

## Anti-Patterns (NEVER produce these)

- Inter or Roboto as sole typeface for headings
- Purple (#8B5CF6 / #7C3AED) gradient on white background
- Generic glassmorphism without Synthex tokens (arbitrary rgba + blur values)
- Drop shadows heavier than `0 8px 32px rgba(0,0,0,0.37)`
- Flat/minimal "SaaS dashboard" white-on-white layouts
- Dark mode as afterthought — Synthex is dark-first, always
- Hardcoded `#ffffff` backgrounds on any dashboard component
- Generic rounded corners (border-radius: 8px everywhere)

## Synthex Design Tokens

```css
/* Colours */
--color-primary: #f97316; /* brand orange */
--color-bg: #0f172a; /* deep slate — the base */
--color-surface: rgba(255, 255, 255, 0.08);
--color-border: rgba(255, 255, 255, 0.12);
--color-text: #f8fafc; /* primary text */
--color-text-muted: #94a3b8; /* secondary text */
--color-text-dim: #64748b; /* labels, captions */
--color-success: #10b981; /* emerald */
--color-error: #f43f5e; /* rose */
--color-info: #38bdf8; /* sky blue */

/* Glass surface */
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);

/* Elevated glass */
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
```
````

## Typography

| Role           | Font           | Weight   | Notes                     |
| -------------- | -------------- | -------- | ------------------------- |
| Headings h1–h3 | Space Grotesk  | 300–600  | NEVER Inter for headings  |
| Body / UI text | Inter          | 400 only | Never bold Inter headings |
| Code / mono    | JetBrains Mono | 400      |                           |
| Labels / caps  | Space Grotesk  | 500      | tracking-wider            |

## Spacing & Radius

```
Base unit: 4px (0.25rem)
Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px

Radius scale:
  sm:   6px   (inputs, tags)
  md:  10px   (cards, buttons)
  lg:  14px   (modals, panels)
  xl:  20px   (large containers)
  full: 9999px (pills, avatars)
```

## For chart/data visualisation standards → see data-viz-standards.md

````

- [ ] **Step 3: Create content-standards.md**

Create `.claude/skills/synthex-standards/references/content-standards.md`:

```markdown
# Content Standards — Synthex Voice & Writing

## Anti-Patterns (NEVER write these)

Phrases that trigger an immediate rewrite:
- "Excited to announce..."
- "In today's fast-paced world..."
- "Leverage [noun] to [verb] your [outcome]"
- "Game-changing", "revolutionary", "disrupting the industry"
- "Seamless", "robust", "scalable", "world-class"
- Opening a LinkedIn post with "I"
- Three-bullet summary at the end of every AI response
- Em-dash after colon to introduce lists (— :)
- Hollow CTAs: "Learn more", "Click here", "Find out more"
- Passive voice to hedge: "it could be said that...", "one might consider..."

## Synthex Voice Standards

**Language:** Australian English throughout — colour, organise, recognise,
licence (noun), authorise, fulfil, programme, centre, travelled.

**Currency:** AUD. **Dates:** DD/MM/YYYY. **Time:** 12-hour with am/pm.

**Register:** Direct, specific, outcomes-focused. Never vague, never corporate.

**Specificity rule:** Replace every superlative with a number or outcome.
- ✗ "dramatically improve your reach"
- ✓ "add 3 posts per week across 5 platforms in under 10 minutes"

**First line rule:** The first line earns the read. No preamble, no context-setting.
- ✗ "As a local business owner, you know how important it is to stay active on social media..."
- ✓ "Your plumbing business could be ranking #1 in Brisbane for 'emergency plumber' by Thursday."

## Platform Voice Matrix

| Platform | Voice | Hook Style |
|----------|-------|------------|
| LinkedIn | Professional authority, first-person narrative | Insight or counterintuitive claim |
| Instagram | Visual story, community-focused | Scene-setting or sensory detail |
| TikTok | Direct challenge, fast | Question or bold statement in first 3 words |
| Facebook | Approachable, conversational | Question to the community |
| X/Twitter | Punchy, opinionated | Controversial or surprising fact |
| YouTube | Informative, searchable | Promise of specific outcome |

## CTA Standards

Every piece has exactly one CTA — not zero, not two.
CTAs name the action AND the benefit:
- ✗ "Book a call"
- ✓ "Book a 15-min call → get your first post live this week"
- ✗ "Learn more"
- ✓ "See how Brisbane plumbers are ranking #1 in 30 days"

## Content Quality Gates (minimum before output)

- [ ] Hook lands in first 125 characters (Instagram) / first line (LinkedIn)
- [ ] No more than 2 consecutive bullet points without a prose sentence between them
- [ ] Exactly one CTA — specific action + specific benefit
- [ ] Hashtags selected by tier: 2–3 broad (1M+), 3–5 medium (100K–1M), 5–10 niche (<100K)
- [ ] No anti-pattern phrases from the list above
- [ ] Australian English throughout
- [ ] Content scorer ≥80 before output (use lib/ai/content-scorer.ts)
````

- [ ] **Step 4: Create code-standards.md**

Create `.claude/skills/synthex-standards/references/code-standards.md`:

````markdown
# Code Standards — Synthex Codebase Patterns

## Anti-Patterns (NEVER produce these)

```typescript
// ✗ Wrong router import
import { useRouter } from 'next/router'
// ✓ Correct
import { useRouter } from 'next/navigation'

// ✗ Direct navigation
window.location.href = '/path'
// ✓ Correct
const router = useRouter(); router.push('/path')

// ✗ Raw fetch in client component
const data = await fetch('/api/things').then(r => r.json())
// ✓ Correct (SWR with credentials)
const { data } = useSWR('/api/things', fetchJson)
// where fetchJson = (url) => fetch(url, { credentials: 'include' }).then(r => r.json())

// ✗ Any auth system other than Supabase
import { auth } from '@clerk/nextjs'
import { getServerSession } from 'next-auth'
// ✓ Always Supabase only
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils'

// ✗ Prisma query without org scope
await prisma.campaign.findMany()
// ✓ Always org-scoped
await prisma.campaign.findMany({ where: { organizationId } })

// ✗ Schema push (breaks production migrations)
npx prisma db push
// ✓ Safe migration
npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script > migration.sql
npx prisma db execute --file migration.sql --schema prisma/schema.prisma

// ✗ any types
const handler = async (req: any, res: any) => {}
// ✓ Typed
export async function POST(request: NextRequest): Promise<NextResponse>

// ✗ Browser confirm/alert (blocks extension events)
window.confirm('Are you sure?')
// ✓ Sonner toast with action
toast.warning('...', { action: { label: 'Confirm', onClick: async () => {} } })

// ✗ Silent catch
catch (err) { /* nothing */ }
// ✓ Always handle or propagate
catch (err) {
  logger.error('context', { error: err })
  return NextResponse.json({ error: 'message' }, { status: 500 })
}
```
````

## Synthex Patterns

### Authentication

```typescript
const userId = await getUserIdFromRequestOrCookies(request);
if (!userId)
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
```

### Organisation scope

```typescript
// Direct org field
const items = await prisma.model.findMany({ where: { organizationId } });
// Via relation
const posts = await prisma.post.findMany({
  where: { campaign: { organizationId } },
});
```

### Mutation validation

```typescript
const Schema = z.object({ field: z.string().min(1) });
const parsed = Schema.safeParse(await request.json());
if (!parsed.success)
  return NextResponse.json(
    { error: 'Validation failed', details: parsed.error.flatten() },
    { status: 400 }
  );
```

### Error response shape

```typescript
// 4xx
{ error: string, details?: unknown }
// 5xx
{ error: string, message?: string }
```

### Rate limiting

```typescript
import { authStrict, writeDefault, readDefault } from '@/lib/rate-limit';
// authStrict: 5 req/min  (auth endpoints)
// writeDefault: 30 req/min (mutations)
// readDefault: 120 req/min (reads)
export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    /* handler */
  });
}
```

### Data fetching in components

```typescript
// In hooks/
const { data, error, isLoading, mutate } = useSWR('/api/things', url =>
  fetch(url, { credentials: 'include' }).then(r => r.json())
);

// In server/API routes
const res = await fetch('/api/things'); // native fetch, no SWR
```

## Language & Format

- Australian English in all user-facing strings
- Currency: AUD (never USD unless explicitly required)
- Dates: DD/MM/YYYY
- Commit format: `type(scope): description` e.g. `fix(api): resolve auth timeout`
- File naming: React `PascalCase.tsx` · Utils `kebab-case.ts` · Skills `SKILL.md`

````

- [ ] **Step 5: Create data-viz-standards.md**

Create `.claude/skills/synthex-standards/references/data-viz-standards.md`:

```markdown
# Data Visualisation Standards — Synthex Charts & Graphs

## Anti-Patterns (NEVER produce these)

- Chart.js / Recharts default colour palette (sequential blues, reds, greens)
- White or light chart backgrounds (Synthex renders charts over dark surfaces)
- Grid lines heavier than 1px or opacity > 0.1
- Legends inside the chart area obscuring data
- No axis labels or missing units
- Tooltips showing raw unformatted numbers (1234567 instead of 1,234,567)
- Pie charts for more than 4 categories (use bar chart instead)
- Hardcoded pixel widths — always responsive
- Chart.js default blue #4472CA or default red #FF6384

## Synthex Chart Palette

| Role | Colour | Hex | Area Fill |
|------|--------|-----|-----------|
| Primary series | Brand orange | `#f97316` | `rgba(249, 115, 22, 0.15)` |
| Comparison | Emerald | `#10B981` | `rgba(16, 185, 129, 0.15)` |
| Third series | Sky blue | `#38BDF8` | `rgba(56, 189, 248, 0.15)` |
| Fourth | Purple | `#A78BFA` | `rgba(167, 139, 250, 0.15)` |
| Fifth | Pink | `#F472B6` | `rgba(244, 114, 182, 0.15)` |

## Chart Anatomy Standards

```typescript
// Background — always transparent
background: 'transparent'

// Grid lines — horizontal only, very subtle
grid: {
  color: 'rgba(255, 255, 255, 0.06)',
  borderDash: [4, 4],
  drawBorder: false,
}

// Axes
ticks: {
  color: '#64748b',
  font: { size: 11, family: 'Space Grotesk' },
}

// Tooltips
tooltip: {
  backgroundColor: '#1e293b',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
  titleColor: '#f8fafc',
  bodyColor: '#94a3b8',
  padding: 12,
}

// Number formatting in tooltips and axes
value.toLocaleString('en-AU')           // general numbers
`$${value.toLocaleString('en-AU')}`     // currency (AUD)
`${value.toFixed(1)}%`                  // percentages
````

## Responsive Sizing

```typescript
// Always fill container, never fixed pixel width
width: '100%';
height: 'auto';
minHeight: 200; // px — floor for small containers
aspectRatio: 16 / 9; // default for full-width charts
aspectRatio: 4 / 3; // for smaller panels
```

## Annotations

```typescript
// Labels, callouts
color: '#94a3b8'
font: { size: 12, family: 'Space Grotesk' }

// Threshold / target lines
borderColor: 'rgba(249, 115, 22, 0.5)'  // orange at 50% opacity
borderDash: [6, 3]
```

````

- [ ] **Step 6: Verify all 5 files exist**

```bash
ls .claude/skills/synthex-standards/
ls .claude/skills/synthex-standards/references/
````

Expected output:

```
SKILL.md
references/
---
aesthetic-standards.md
code-standards.md
content-standards.md
data-viz-standards.md
```

- [ ] **Step 7: Commit Sprint 1**

```bash
git add .claude/skills/synthex-standards/
git commit -m "feat(skills): synthex-standards shared uplift reference layer"
```

Expected: 5 files changed, 0 deletions (insertions count will reflect full file sizes).

- [ ] **Step 8: Sprint 1 boundary — verify clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Sprint 2 — Category A: Visual Output Skills

> Pattern for every task in this sprint:
>
> 1. Read the skill file in full
> 2. Update frontmatter: description → aggressive anti-pattern statement, add `type: capability-uplift-visual`, expand triggers
> 3. Append `## Capability Uplift — Override Defaults` section at END of file (never remove existing content)
> 4. Verify: `git diff --stat` shows only additions
> 5. Commit

---

### Task 2: Uplift `design` skill

**Files:**

- Modify: `.claude/skills/design/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/design/SKILL.md` in full.

- [ ] **Step 2: Replace frontmatter description and add type + triggers**

Change the `description` field to:

```yaml
description: >-
  Synthex design system enforcer. NEVER use Inter as a heading font, purple
  (#8B5CF6) gradients on white, or generic glassmorphism without Synthex tokens.
  ALWAYS use Space Grotesk headings, #f97316 brand orange, #0f172a slate
  background, and the Synthex glass token set. Activate on ANY request involving
  UI, components, styling, layout, visual design, colour, typography, spacing,
  shadows, animations, or anything a user will see on screen.
```

Add to `metadata:`:

```yaml
type: capability-uplift-visual
```

Add to `triggers:` (keep all existing, add new ones):

```yaml
- visual
- colour
- color
- typography
- layout
- component
- styling
- interface
- spacing
- shadow
- animation
- responsive
```

- [ ] **Step 3: Append uplift block at end of file**

````markdown
---

## Capability Uplift — Override Defaults

**NEVER** use Inter as a heading font (it is the #1 LLM typography default),
purple (#8B5CF6 / #7C3AED) gradients on white, generic glassmorphism without
Synthex tokens, flat white-on-white SaaS layouts, or treat dark mode as an
afterthought. The `design` skill's Typography section currently lists Inter for
headings — disregard that line; Space Grotesk is the heading font.

**INSTEAD** every component uses Space Grotesk for headings (weight 300–600),
#f97316 brand orange as the primary accent, #0f172a deep slate as the base
background, and the Synthex glass token set:

```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```
````

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`

````

- [ ] **Step 4: Verify only insertions**

```bash
git diff --stat .claude/skills/design/SKILL.md
````

Expected: `1 file changed, N insertions(+), 0 deletions(-)`

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/design/SKILL.md
git commit -m "feat(skills): uplift design — override Inter/purple/generic-glassmorphism defaults"
```

---

### Task 3: Uplift `ui-ux` skill

**Files:**

- Modify: `.claude/skills/ui-ux/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/ui-ux/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex UX enforcer. NEVER produce generic bullet-list audit reports, recite
  WCAG rules without grounding them in Synthex's dark glassmorphic interface,
  or reference pnpm (this project uses npm). ALWAYS ground findings in
  Synthex's #0f172a dark background, Radix UI primitive semantics, and 4px
  spacing scale. Activate on ANY request to audit UX, review accessibility,
  optimise flows, check interactions, or validate usability.
```

Add `type: capability-uplift-visual` to metadata.

Add triggers: `usability`, `interaction`, `flow`, `wcag`, `a11y`, `audit`, `review`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** produce a generic bullet-list audit report with copy-pasted WCAG
criterion text, reference `pnpm test:e2e` (this project uses `npm run e2e`),
flag Next.js 14 or React 18 patterns as the standard (we run Next.js 15 /
React 19), or run contrast checks against a white background.

**INSTEAD** every audit is grounded in Synthex's actual interface: contrast
ratios are checked against #0f172a dark slate background (not white), ARIA
audit considers that Radix UI primitives already handle most semantics (flag
only when Radix patterns are bypassed), and focus rings are validated in dark
theme (the default ring-offset colour needs to be --color-bg, not white).

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`
```

- [ ] **Step 4: Verify only insertions**

```bash
git diff --stat .claude/skills/ui-ux/SKILL.md
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/ui-ux/SKILL.md
git commit -m "feat(skills): uplift ui-ux — override generic WCAG recitations with Synthex context"
```

---

### Task 4: Uplift `visual-content-brief` skill

**Files:**

- Modify: `.claude/skills/visual-content-brief/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/visual-content-brief/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex visual content enforcer. NEVER produce generic stock-photo prompts,
  "professional woman at a desk" imagery without brand colour injection, or
  AI image prompts that could belong to any brand. ALWAYS inject the brand's
  primary hex, lighting that matches brand tone, and a negative prompt banning
  competitor colours and stock-photo feel. Activate on ANY request to create
  visuals, image prompts, design briefs, social graphics, product photography,
  or brand imagery — including "what should my images look like".
```

Add `type: capability-uplift-visual` to metadata.

Add triggers: `visual brief`, `ai image`, `generate image`, `image generation`, `photography brief`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** produce a prompt that omits the brand's colour palette, uses
"professional woman/man at a clean desk" as a default setting, outputs prompts
that could apply to any brand, or skips the negative prompt.

**INSTEAD** every image prompt uses this structure:
```

[Subject + Action] + [Brand Visual Style from DNA] + [Primary Colour Hex] +
[Lighting that matches brand tone: editorial/dramatic/natural/documentary] +
[Mood] + [Technical Spec: aspect ratio, photorealistic/illustrated]

Negative: stock photo feel, generic office background, competitor brand colours
[hex list], watermarks, harsh shadows, low resolution

```

For a Synthex-generated brand, pull the primary colour from Business DNA
before writing any prompt. A prompt without a hex code is not a Synthex prompt.

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/visual-content-brief/SKILL.md
git add .claude/skills/visual-content-brief/SKILL.md
git commit -m "feat(skills): uplift visual-content-brief — require brand colour injection in every prompt"
```

---

### Task 5: Uplift `ui-review` skill

**Files:**

- Modify: `.claude/skills/ui-review/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/ui-review/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex UI validation agent. NEVER run generic Lighthouse audits without
  grounding findings in Synthex's dark glassmorphic interface. NEVER reference
  pnpm. ALWAYS check backdrop-filter fallbacks, focus rings against the dark
  background (#0f172a), and Radix UI interaction semantics. Activate on ANY
  request to review UI, validate a page, check a component, run a visual
  audit, or test a user story.
```

Add `type: capability-uplift-visual` to metadata.

Add triggers: `review`, `validate`, `check ui`, `visual audit`, `user story`, `page check`

- [ ] **Step 3: Append uplift block**

```markdown
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
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/ui-review/SKILL.md
git add .claude/skills/ui-review/SKILL.md
git commit -m "feat(skills): uplift ui-review — override generic audits with Synthex dark-theme context"
```

- [ ] **Sprint 2 boundary — verify clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Sprint 3 — Category B: Content Output Skills

> Same pattern as Sprint 2 but `type: capability-uplift-content` and reference `content-standards.md`.

---

### Task 6: Uplift `brand-campaign-generator` skill

**Files:**

- Modify: `.claude/skills/brand-campaign-generator/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/brand-campaign-generator/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex campaign content enforcer. NEVER open posts with "Excited to
  announce", use "leverage", "game-changing", or "revolutionary", produce
  platform-agnostic copy, or generate content that scores below 80. ALWAYS
  write platform-distinct hooks, use specific numbers over superlatives,
  and enforce exactly one CTA per piece. Activate on ANY request to create
  a campaign, generate posts, write social content, or launch content for
  a product, offer, or event.
```

Add `type: capability-uplift-content` to metadata.

Add triggers: `write campaign`, `create content`, `generate posts`, `social content`, `launch content`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** open any post with "Excited to announce", "We're thrilled to share",
or "In today's fast-paced world". Never use "leverage", "game-changing",
"revolutionary", "seamless", or "robust". Never produce the same tone for
LinkedIn and TikTok. Never end with a three-bullet summary. Never output
content that scores below 80 via the content scorer.

**INSTEAD** every campaign uses platform-distinct hooks:

- LinkedIn: counterintuitive insight or specific outcome in the first line
- Instagram: scene-setting or sensory detail in 125 characters
- TikTok: direct challenge or bold question in the first 3 words
- Facebook: community question or local-business relatable scenario
- X/Twitter: surprising fact or punchy opinionated take

Every piece has exactly one CTA naming the specific action AND benefit:
"Book a 15-min call → get your first post live this week"

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/brand-campaign-generator/SKILL.md
git add .claude/skills/brand-campaign-generator/SKILL.md
git commit -m "feat(skills): uplift brand-campaign-generator — override generic AI campaign voice"
```

---

### Task 7: Uplift `platform-content-adaptor` skill

**Files:**

- Modify: `.claude/skills/platform-content-adaptor/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/platform-content-adaptor/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex platform content enforcer. NEVER produce copy that reads the same
  across platforms, pad LinkedIn posts with generic business language, or
  treat hashtags as decorative. ALWAYS enforce platform-distinct voice: LinkedIn
  hooks never start with "I", Instagram hooks land in 125 chars, TikTok opens
  with a challenge or question. Activate on ANY request to adapt content for
  platforms, resize a post, create a LinkedIn version, turn content into a
  TikTok script, or distribute content across channels.
```

Add `type: capability-uplift-content`. Expand triggers with: `adapt`, `resize`, `distribute`, `repurpose`, `platform version`

- [ ] **Step 2: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** apply the same voice and structure across all platform adaptations.
Never pad LinkedIn posts with generic opener phrases. Never append hashtags
randomly — every hashtag must be searchable and tiered by volume.

**INSTEAD** enforce the platform voice matrix from content-standards.md.
The first adaptation check: does this LinkedIn version sound like LinkedIn
(professional first-person authority)? Does the TikTok version open with
a challenge in the first 3 words? If not, rewrite before outputting.

Hashtag tier rule: 2–3 broad (1M+), 3–5 medium (100K–1M), 5–10 niche (<100K).
Never append the same hashtag list across all platforms.

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/platform-content-adaptor/SKILL.md
git add .claude/skills/platform-content-adaptor/SKILL.md
git commit -m "feat(skills): uplift platform-content-adaptor — enforce platform-distinct voice"
```

---

### Task 8: Uplift `platform-showcase` skill

**Files:**

- Modify: `.claude/skills/platform-showcase/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/platform-showcase/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex platform showcase enforcer. NEVER describe features with generic
  marketing language ("powerful AI", "seamless integration") or produce
  wall-of-bullets capability lists. ALWAYS lead with a specific client
  outcome, use concrete numbers, and write in Australian English. Activate
  on ANY request to showcase a platform, explain a feature, demonstrate
  capability, or create platform presentation content.
```

Add `type: capability-uplift-content`. Add triggers: `showcase`, `feature demo`, `platform demo`, `capability`, `present`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** describe Synthex features with generic SaaS language: "powerful AI",
"seamless integration", "robust platform", "world-class automation". Never
produce a bullet list of features without an outcome attached to each one.

**INSTEAD** every feature showcase leads with the client outcome:

- ✗ "AI-powered content generation"
- ✓ "Produces 18 platform-ready posts from a single brief in under 4 minutes"

Use specific numbers wherever possible. Write in Australian English. Every
platform is showcased from the client's perspective: what problem does it solve,
how long does it take, what does the client NOT have to do anymore.

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/platform-showcase/SKILL.md
git add .claude/skills/platform-showcase/SKILL.md
git commit -m "feat(skills): uplift platform-showcase — outcome-first over feature-list defaults"
```

---

### Task 9: Uplift `campaign-planner` skill

**Files:**

- Modify: `.claude/skills/campaign-planner/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/campaign-planner/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex campaign planning enforcer. NEVER produce generic Mon-announcement,
  Wed-educational, Fri-promotional calendar arcs, or fill slots with placeholder
  content types without brand-specific reasoning. ALWAYS derive the content arc
  from the brand's DNA and campaign goal, vary cadence by platform, and name
  the specific hook angle for every calendar slot. Activate on ANY request to
  plan a campaign, build a content calendar, schedule posts, or map out a
  30/60/90-day content strategy.
```

Add `type: capability-uplift-content`. Add triggers: `content calendar`, `plan posts`, `schedule content`, `30 day`, `60 day`, `90 day`, `content strategy`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** produce the default Mon/Wed/Fri three-pillar calendar (announce,
educate, promote) applied generically across all brands. Never fill a calendar
slot with "Educational post" without specifying what topic, what angle, and
what platform-specific hook it uses.

**INSTEAD** every calendar slot specifies:

1. Platform (LinkedIn ≠ Instagram — different cadences)
2. Hook angle (the specific opening line concept, not just "educational")
3. Content pillar it belongs to (from Business DNA)
4. CTA direction (what action this piece drives)

Cadence varies by platform: LinkedIn 3×/week max, Instagram daily is fine,
TikTok 1–2×/day is normal, Facebook 4×/week max, X/Twitter up to 3×/day.

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/campaign-planner/SKILL.md
git add .claude/skills/campaign-planner/SKILL.md
git commit -m "feat(skills): uplift campaign-planner — replace generic calendar arcs with brand-derived planning"
```

---

### Task 10: Uplift `brand-consistency-checker` skill

**Files:**

- Modify: `.claude/skills/brand-consistency-checker/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/brand-consistency-checker/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex brand consistency enforcer. NEVER produce vague feedback ("sounds
  on-brand", "good feel", "consistent with your voice"). ALWAYS score against
  specific criteria: vocabulary match percentage, anti-pattern phrase count,
  and CTA quality. Every feedback item must be specific enough to act on
  immediately. Activate on ANY request to check brand consistency, audit
  content against brand guidelines, review voice alignment, or validate that
  content matches a Business DNA profile.
```

Add `type: capability-uplift-content`. Add triggers: `check brand`, `brand audit`, `voice check`, `consistency`, `brand alignment`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** output vague brand feedback: "this sounds on-brand", "good feel",
"consistent with your voice", "aligns with your brand values". This feedback
is useless — it cannot be acted on. Never approve content that contains
anti-pattern phrases from content-standards.md without flagging them.

**INSTEAD** every consistency check produces a structured score:
```

BRAND CONSISTENCY REPORT
─────────────────────────
Vocabulary match: [X]% — [N] DNA words used, [N] missing from expected set
Anti-patterns found: [N] — [list each phrase explicitly]
CTA quality: [Pass/Fail] — [exact CTA text] → names action: [Y/N] + benefit: [Y/N]
Tone match: [X]/10 — [specific description of what's aligned and what isn't]
Overall: [Pass ≥7/10 / Revise <7/10]

Specific fixes:

- Line [N]: Replace "[exact phrase]" → "[suggested replacement]"

```

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/brand-consistency-checker/SKILL.md
git add .claude/skills/brand-consistency-checker/SKILL.md
git commit -m "feat(skills): uplift brand-consistency-checker — replace vague feedback with scored reports"
```

---

### Task 11: Uplift `business-dna` skill

**Files:**

- Modify: `.claude/skills/business-dna/SKILL.md`

- [ ] **Step 1: Read the current file**

Read `.claude/skills/business-dna/SKILL.md` in full.

- [ ] **Step 2: Update frontmatter**

Replace description:

```yaml
description: >-
  Synthex brand DNA extractor. NEVER produce surface-level brand descriptions
  ("professional and friendly"), generic persona archetypes ("busy professional
  aged 25–45"), or tone descriptions that could apply to any brand. ALWAYS
  extract vocabulary the brand actually uses, describe what the brand explicitly
  is NOT, and ground the audience in a specific outcome they are seeking.
  Activate on ANY request to extract brand identity, build a DNA profile,
  define a brand voice, analyse a website for brand signals, or create a
  persona profile.
```

Add `type: capability-uplift-content`. Add triggers: `brand profile`, `brand identity`, `brand voice`, `persona`, `dna`, `website analysis`

- [ ] **Step 3: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** describe a brand's tone as "professional and friendly" (every brand
says this), produce a target audience as "busy professionals aged 25–45" (too
generic to act on), or write brand values that sound like an MBA mission
statement ("we deliver excellence through innovation").

**INSTEAD** a high-quality Business DNA extraction includes:

1. **Vocabulary the brand actually uses** — specific words and phrases pulled
   verbatim from their website/materials, not inferred generics
2. **What the brand is NOT** — explicit exclusions are as valuable as inclusions
   ("never corporate-speak", "never aspirational fluff", "never discounts")
3. **Audience defined by outcome** — not demographics, but what they're seeking:
   - ✗ "Women aged 30–45 interested in wellness"
   - ✓ "Mums who want to lose the baby weight without giving up wine on Friday"
4. **Voice on a spectrum** — position on 3 axes:
   - Formal ←→ Casual
   - Serious ←→ Playful
   - Broad ←→ Niche

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/business-dna/SKILL.md
git add .claude/skills/business-dna/SKILL.md
git commit -m "feat(skills): uplift business-dna — replace generic brand descriptions with specific extraction"
```

- [ ] **Sprint 3 boundary — verify clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Sprint 4 — Category C: Code Output Skills

> Same pattern but `type: capability-uplift-code` and reference `code-standards.md`.

---

### Task 12: Uplift `route-auditor` skill

**Files:**

- Modify: `.claude/skills/route-auditor/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/route-auditor/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex API route compliance scanner. NEVER apply generic REST conventions
  without grounding in Synthex's specific security pattern. ALWAYS audit
  against: getUserIdFromRequestOrCookies() auth, { organizationId } on every
  query, Zod safeParse() on all mutations, withRateLimit() on AI routes, and
  migrate diff + db execute for schema changes. Activate on ANY request to
  audit a route, check API security, review an endpoint, or scan for auth
  or org-scope issues.
```

Add `type: capability-uplift-code`. Add triggers: `route audit`, `api audit`, `security scan`, `endpoint review`, `auth check`

- [ ] **Step 2: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** flag generic REST issues without Synthex context, approve Prisma
queries without `organizationId` filter, accept `prisma db push` for schema
changes, or allow any auth system other than Supabase.

**INSTEAD** every route audit checks these Synthex-specific gates in order:

1. Auth: `getUserIdFromRequestOrCookies(request)` → 401 if null
2. Org scope: every DB query has `{ organizationId }` or `{ campaign: { organizationId } }`
3. Mutations: `ZodSchema.safeParse(body)` → 400 with `{ error, details }` if invalid
4. Rate limiting: `withRateLimit` or equivalent wrapping AI and mutation routes
5. Error shape: all error responses return `{ error: string, details?: unknown }`

Flag any deviation from these 5 gates as a blocker. Everything else is a warning.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/route-auditor/SKILL.md
git add .claude/skills/route-auditor/SKILL.md
git commit -m "feat(skills): uplift route-auditor — enforce Synthex 5-gate security pattern"
```

---

### Task 13: Uplift `code-review` skill

**Files:**

- Modify: `.claude/skills/code-review/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/code-review/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex code quality enforcer. NEVER flag Synthex conventions as bugs
  (Australian English, Supabase-only auth, SWR with credentials:'include',
  selective error boundaries). NEVER suggest Redux, Zustand, tRPC, or any
  pattern absent from this codebase. ALWAYS enforce: useRouter from
  next/navigation, no window.location.href, SWR for client data fetching,
  { error: string } response shape. Activate on ANY request to review code,
  audit a PR, check a component, or validate an implementation.
```

Add `type: capability-uplift-code`. Add triggers: `review code`, `code audit`, `pr review`, `check implementation`, `validate code`

- [ ] **Step 2: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** apply generic clean code principles that contradict Synthex conventions.
Australian English spellings are correct. Supabase-only auth is correct.
SWR with `credentials: 'include'` is correct. Don't flag these as issues.

**INSTEAD** reviews enforce Synthex-specific patterns:

- `useRouter` from `next/navigation` (never `next/router`, never `window.location.href`)
- SWR for all client-side data fetching with `credentials: 'include'` fetcher
- `{ error: string, details?: unknown }` for all 4xx responses
- `{ organizationId }` filter on every Prisma query
- Zod `safeParse` (not `parse`) on all mutation inputs
- `getUserIdFromRequestOrCookies` (not any other auth helper)

Blockers: security issues (missing auth/org-scope), runtime errors.
Warnings: code quality (any types, silent catches, missing error shape).
Suggestions: improvements that don't change behaviour.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/code-review/SKILL.md
git add .claude/skills/code-review/SKILL.md
git commit -m "feat(skills): uplift code-review — replace generic clean-code with Synthex conventions"
```

---

### Task 14: Uplift `security-hardener` skill

**Files:**

- Modify: `.claude/skills/security-hardener/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/security-hardener/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex security posture enforcer. NEVER apply generic OWASP checklists
  without grounding in Synthex's specific threat model. NEVER suggest any
  auth system other than Supabase. ALWAYS audit: SSRF via validateExternalUrl,
  JWT tier elevation via resolveVerifiedTier, CORS via CORS_ORIGIN exact-match,
  org-scope bypass in Prisma. Activate on ANY request to harden security,
  audit vulnerabilities, review auth patterns, check for injection risks,
  or assess an attack surface.
```

Add `type: capability-uplift-code`. Add triggers: `security audit`, `vulnerability`, `harden`, `attack surface`, `injection`, `ssrf`, `csrf`

- [ ] **Step 2: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** run a theoretical OWASP scan without a concrete attack vector for
this specific codebase. Never suggest auth systems other than Supabase.
Never flag issues that the codebase already handles correctly as if they
were open vulnerabilities.

**INSTEAD** audit against Synthex's known attack surfaces in priority order:

1. **SSRF** — user-supplied URLs must go through `validateExternalUrl()` from
   `lib/security/validate-url` before any `fetch()` call
2. **JWT tier elevation** — tier must be resolved via `resolveVerifiedTier()`
   with Redis cache TTL, never decoded from unverified JWT payload directly
3. **CORS** — `CORS_ORIGIN` env var exact-match allowlist in middleware.ts,
   never `origin.includes(hostname)` substring match
4. **Org-scope bypass** — every Prisma query must have `organizationId` filter;
   a query returning data without org filter is a data leak
5. **OAuth open redirect** — `returnTo` must start with `/`, not `//` or `://`

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/security-hardener/SKILL.md
git add .claude/skills/security-hardener/SKILL.md
git commit -m "feat(skills): uplift security-hardener — ground OWASP in Synthex-specific threat model"
```

---

### Task 15: Uplift `database-prisma` skill

**Files:**

- Modify: `.claude/skills/database-prisma/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/database-prisma/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex database operations enforcer. NEVER use prisma db push for schema
  changes — use migrate diff + db execute. NEVER add non-nullable columns
  without defaults. NEVER write Prisma queries without organizationId scope.
  ALWAYS use backward-compatible migrations and validate with prisma validate
  first. Activate on ANY request to change schema, write a query, create a
  migration, add a model, or modify database operations.
```

Add `type: capability-uplift-code`. Add triggers: `schema`, `migration`, `prisma`, `query`, `database`, `model`, `db change`

- [ ] **Step 2: Append uplift block**

````markdown
---

## Capability Uplift — Override Defaults

**NEVER** use `npx prisma db push` for schema changes in any environment —
it bypasses migration history and will silently break production. Never add
a non-nullable column without a default value (breaks existing rows). Never
drop or rename a column without explicit human approval (data loss risk).

**INSTEAD** every schema change follows:

```bash
# 1. Validate first
npx prisma validate

# 2. Generate SQL diff
npx prisma migrate diff \
  --from-schema-datasource \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql

# 3. Review the SQL manually

# 4. Execute
npx prisma db execute --file migration.sql --schema prisma/schema.prisma
```
````

Every new column is either nullable or has a `@default(...)`.
Every query on a multi-tenant model includes `where: { organizationId }`.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`

````

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/database-prisma/SKILL.md
git add .claude/skills/database-prisma/SKILL.md
git commit -m "feat(skills): uplift database-prisma — enforce migrate-diff workflow, ban db push"
````

---

### Task 16: Uplift `api-testing` skill

**Files:**

- Modify: `.claude/skills/api-testing/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/api-testing/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex API testing enforcer. NEVER mock the database in integration tests —
  use real Supabase. NEVER skip the 401 (unauthenticated) or 403 (wrong org)
  test cases. NEVER use pnpm. ALWAYS structure tests as: 401 → 403 → 400 →
  200/201 happy path. Activate on ANY request to write API tests, validate
  endpoints, add test coverage, or check test quality.
```

Add `type: capability-uplift-code`. Add triggers: `api test`, `write tests`, `test coverage`, `endpoint test`, `integration test`

- [ ] **Step 2: Append uplift block**

````markdown
---

## Capability Uplift — Override Defaults

**NEVER** mock the database in integration tests — past incidents showed that
mock/prod divergence caused production failures that passing tests masked.
Never skip the unauthenticated (401) or wrong-org (403) test cases — these
are the most commonly exploited paths. Never use `pnpm` — this project uses `npm`.

**INSTEAD** every API route test suite covers these cases in this order:

```typescript
describe('POST /api/resource', () => {
  it('returns 401 when unauthenticated', async () => { ... })
  it('returns 403 when accessing another org', async () => { ... })
  it('returns 400 when body is invalid', async () => { ... })
  it('returns 201 on success', async () => { ... })
})
```
````

Tests run against real Supabase (test database). The test user is a real
auth.users row. The org is a real Organization row. No mocks for DB calls.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`

````

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/api-testing/SKILL.md
git add .claude/skills/api-testing/SKILL.md
git commit -m "feat(skills): uplift api-testing — no DB mocks, enforce 401/403/400/200 test structure"
````

---

### Task 17: Uplift `architecture-enforcer` skill

**Files:**

- Modify: `.claude/skills/architecture-enforcer/SKILL.md`

- [ ] **Step 1: Read, then update frontmatter**

Read `.claude/skills/architecture-enforcer/SKILL.md` in full.

Replace description:

```yaml
description: >-
  Synthex architecture pattern enforcer. NEVER suggest Redux, Zustand, tRPC,
  GraphQL, Server Actions for mutations, or any pattern absent from this
  codebase. NEVER allow cross-layer imports (page importing from lib/ directly).
  ALWAYS enforce: Pages → Components → Hooks → lib/ → Database. All mutations
  go through API routes. Activate on ANY request to design architecture, review
  patterns, plan a new system, refactor, or assess structural decisions.
```

Add `type: capability-uplift-code`. Add triggers: `architecture`, `pattern`, `refactor`, `design system`, `layer`, `structure`, `new system`

- [ ] **Step 2: Append uplift block**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** recommend architectural patterns not present in the Synthex codebase:
Redux, Zustand, tRPC, GraphQL, Server Actions for mutations, React Query.
Never allow cross-layer imports. Never suggest splitting the monorepo.

**INSTEAD** every architectural decision must:

1. Trace back to an existing pattern in the codebase (find it with Grep first)
2. Follow the layer rule: `app/` pages → `components/` → `hooks/` → `lib/` → Prisma → DB
3. Route all mutations through `app/api/` routes with Zod validation
4. Use SWR for client-side data (never useEffect + fetch)
5. Keep auth in `lib/auth/` — never duplicate auth logic in components

New patterns require: existing pattern was insufficient + migration path documented.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/skills/architecture-enforcer/SKILL.md
git add .claude/skills/architecture-enforcer/SKILL.md
git commit -m "feat(skills): uplift architecture-enforcer — ban absent patterns, enforce layer rule"
```

- [ ] **Sprint 4 boundary — verify clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Sprint 5 — Agents

> Same uplift pattern applied to `.claude/agents/*.md` files.
> Category C agents → `type: capability-uplift-code`, reference `code-standards.md`
> Category B agents → `type: capability-uplift-content`, reference `content-standards.md`
> Category D agents → `type: reference-agent`, one-line note only

---

### Task 18: Uplift `build-engineer` agent

**Files:**

- Modify: `.claude/agents/build-engineer.md`

- [ ] **Step 1: Read the current file**

Read `.claude/agents/build-engineer.md` in full.

- [ ] **Step 2: Update frontmatter description and add type**

Replace description:

```yaml
description: >-
  Synthex Vercel deployment specialist. NEVER use pnpm — this project uses npm.
  NEVER deploy without running npm run type-check && npm run lint && npm test first.
  NEVER modify .env files directly — production secrets live in Vercel dashboard only.
  NEVER push to production without a human review gate. Activate on ANY build failure,
  deployment issue, Vercel configuration, environment variable, or production monitoring task.
```

Add `type: capability-uplift-code` to frontmatter.

- [ ] **Step 3: Append uplift block to agent body**

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** suggest `pnpm` commands — this project uses `npm`. Never skip
the pre-deploy gate. Never modify `.env`, `.env.local`, or `.env.production`
files directly — production secrets live in the Vercel dashboard only.

**INSTEAD** every deployment follows the 5-phase protocol from `build-orchestrator`:

1. Preflight: `npm run type-check && npm run lint && npm test` (all must pass)
2. Build verification: `npm run build` locally if significant changes
3. Database check: `npx prisma validate` if schema changed
4. Deployment: `vercel --prod` or merge to main (triggers Vercel auto-deploy)
5. Post-deploy: verify health endpoint and one user-visible action

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 4: Verify only insertions, then commit**

```bash
git diff --stat .claude/agents/build-engineer.md
git add .claude/agents/build-engineer.md
git commit -m "feat(agents): uplift build-engineer — ban pnpm, enforce 5-phase deploy protocol"
```

---

### Task 19: Uplift `code-architect` agent

**Files:**

- Modify: `.claude/agents/code-architect.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/code-architect.md` in full.

Replace description:

```yaml
description: >-
  Synthex architecture and code quality specialist. NEVER suggest Redux, Zustand,
  tRPC, GraphQL, or any pattern absent from this Next.js 15/Supabase/Prisma codebase.
  NEVER allow cross-layer imports. ALWAYS enforce the Synthex layer rule:
  Pages → Components → Hooks → lib/ → Database. Activate on ANY design decision,
  refactoring plan, PR architecture review, or structural question.
```

Add `type: capability-uplift-code`.

Append to body:

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** suggest architectural patterns absent from this codebase. New patterns
require explicit justification against an existing pattern that was insufficient.

**INSTEAD** every recommendation traces back to an existing pattern found with Grep.
All mutations go through `app/api/` routes. Auth lives in `lib/auth/`. Data
fetching in client components uses SWR. The layer rule is non-negotiable.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git diff --stat .claude/agents/code-architect.md
git add .claude/agents/code-architect.md
git commit -m "feat(agents): uplift code-architect — enforce Synthex layer rule and existing patterns only"
```

---

### Task 20: Uplift `qa-sentinel` agent

**Files:**

- Modify: `.claude/agents/qa-sentinel.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/qa-sentinel.md` in full.

Replace description:

```yaml
description: >-
  Synthex QA and testing specialist. NEVER mock the database in integration
  tests. NEVER skip the 401 (unauthenticated) or 403 (wrong org) test cases.
  NEVER use pnpm. ALWAYS structure tests: 401 → 403 → 400 → 200 happy path,
  against real Supabase. Activate on ANY test failure, test coverage gap,
  quality gate validation, or request to write or review tests.
```

Add `type: capability-uplift-code`.

Append:

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** mock the database (mock/prod divergence caused production failures).
**NEVER** skip auth test cases — the 401 and 403 cases are the highest-value
tests in a multi-tenant SaaS application.

**INSTEAD** every test suite starts with 401 → 403 → 400 → happy path.
Real Supabase. Real auth users. Real org rows. No mocks for DB calls.
Command: `npm test` (never `pnpm`).

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git add .claude/agents/qa-sentinel.md
git commit -m "feat(agents): uplift qa-sentinel — ban DB mocks, enforce 401/403/400/200 test structure"
```

---

### Task 21: Uplift `senior-reviewer` agent

**Files:**

- Modify: `.claude/agents/senior-reviewer.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/senior-reviewer.md` in full.

Replace description:

```yaml
description: >-
  Synthex senior engineering reviewer. NEVER flag Synthex conventions as bugs
  (Australian English spellings, Supabase-only auth, SWR with credentials:'include',
  selective error boundaries). NEVER suggest non-Supabase auth. ALWAYS calibrate
  reviews to Synthex conventions: Blockers are real security/correctness issues,
  Warnings are code quality concerns, Suggestions are improvements. Activate on
  ANY code review, PR review, implementation verification, or architectural assessment.
```

Add `type: capability-uplift-code`.

Append:

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** flag Australian English as a typo. Never flag `credentials: 'include'`
as unnecessary. Never suggest Clerk, NextAuth, or Auth.js.

**INSTEAD** reviews use three severity levels:

- **Blocker**: security issue (missing auth/org-scope), runtime error, data loss risk
- **Warning**: code quality issue (any types, silent catch, missing error shape)
- **Suggestion**: improvement that doesn't change correctness or security

A review with only Suggestions is a passing review.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git add .claude/agents/senior-reviewer.md
git commit -m "feat(agents): uplift senior-reviewer — calibrate to Synthex conventions not generic rules"
```

---

### Task 22: Uplift `verification-agent` agent

**Files:**

- Modify: `.claude/agents/verification-agent.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/verification-agent.md` in full.

Replace description:

```yaml
description: >-
  Synthex implementation verifier. NEVER declare work complete without running
  npm run type-check && npm run lint && npm test. NEVER accept "should work",
  "probably passes", "seems correct", or "likely fixed" as verification.
  ALWAYS run the gate and report actual pass/fail counts. Activate on ANY
  request to verify, check, validate, confirm completion, or close a task.
```

Add `type: capability-uplift-code`.

Append:

````markdown
---

## Capability Uplift — Override Defaults

**NEVER** use banned completion phrases: "should work", "probably passes",
"seems correct", "likely fixed". These are not verification — they are guesses.

**INSTEAD** verification means running the gate and reporting actual output:

```bash
npm run type-check   # Must show: "Found 0 errors"
npm test             # Must show: "X tests passed, 0 failed"
npm run lint         # Must show: 0 errors, 0 warnings
```
````

Then one manual check of the specific user-visible outcome described in the task.
Only then: "Verified — 0 type errors, 47 tests passing, 0 lint warnings."

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`

````

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git add .claude/agents/verification-agent.md
git commit -m "feat(agents): uplift verification-agent — ban completion phrases, require actual gate output"
````

---

### Task 23: Uplift `codex/security-auditor` agent

**Files:**

- Modify: `.claude/agents/codex/security-auditor.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/codex/security-auditor.md` in full.

Replace description:

```yaml
description: >-
  Synthex security auditor. NEVER apply generic OWASP without a concrete attack
  vector for this codebase. NEVER suggest non-Supabase auth. ALWAYS check
  Synthex's 5 attack surfaces: SSRF (validateExternalUrl), JWT tier elevation
  (resolveVerifiedTier), CORS (CORS_ORIGIN exact-match), org-scope bypass
  (Prisma organizationId), OAuth open redirect (returnTo validation). Activate
  on ANY security audit, vulnerability review, auth pattern question, or
  hardening request.
```

Add `type: capability-uplift-code`.

Append:

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** produce a generic vulnerability checklist without tying each item
to a real attack vector in the Synthex codebase.

**INSTEAD** audit Synthex's 5 known attack surfaces in priority order:

1. SSRF: user-supplied URLs → `validateExternalUrl()` before any `fetch()`
2. JWT tier elevation: tier from `resolveVerifiedTier()` not raw JWT decode
3. CORS: `CORS_ORIGIN` exact-match, not `origin.includes()`
4. Org-scope bypass: `organizationId` filter on every Prisma query
5. OAuth redirect: `returnTo` starts with `/`, not `//` or `://`

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
```

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git add .claude/agents/codex/security-auditor.md
git commit -m "feat(agents): uplift codex/security-auditor — Synthex 5-surface threat model"
```

---

### Task 24: Uplift `ceo` agent

**Files:**

- Modify: `.claude/agents/ceo.md`

- [ ] **Step 1: Read, update frontmatter, append uplift**

Read `.claude/agents/ceo.md` in full.

Replace description:

```yaml
description: >-
  Synthex CEO — strategic executive voice. NEVER use business buzzwords
  ("leverage", "synergy", "disrupting", "pivot"). NEVER recommend features
  without a measurable client outcome. ALWAYS trace every decision to: what
  does this do for the client's phone calls, bookings, or Google ranking?
  Activate on ANY product decision, client outcome question, pricing,
  competitive positioning, roadmap prioritisation, or simplification call.
```

Add `type: capability-uplift-content`.

Append:

```markdown
---

## Capability Uplift — Override Defaults

**NEVER** produce strategy documents that read like generic SaaS playbooks.
Never use: "leverage", "synergy", "disruptive", "pivot", "north star metric"
(unless quoting someone else). Never recommend a feature without answering
"what does this do for the client's actual business results?"

**INSTEAD** every strategic recommendation answers three questions:

1. What client outcome does this drive? (phone calls, bookings, rankings, revenue)
2. How quickly does the client see the result? (days/weeks/months)
3. What does the client NOT have to do because of this? (the automation value)

Synthex's promise: take any local business from sign-up to #1 in their local
search in the shortest time with the least effort. Every decision either
accelerates this promise or doesn't belong in the roadmap.

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
```

- [ ] **Step 2: Verify only insertions, then commit**

```bash
git add .claude/agents/ceo.md
git commit -m "feat(agents): uplift ceo — ban buzzwords, enforce client-outcome-first reasoning"
```

---

### Task 25: Tag `hive-mind` agent (Category D)

**Files:**

- Modify: `.claude/agents/hive-mind.md`

- [ ] **Step 1: Read `hive-mind.md` in full**

- [ ] **Step 2: Add `type: reference-agent` to frontmatter**

Add to frontmatter: `type: reference-agent`

Append to body:

```markdown
> **Reference agent:** This is an orchestration agent — it routes tasks to
> specialist agents and does not generate direct output. No capability uplift
> block is needed.
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/agents/hive-mind.md
git add .claude/agents/hive-mind.md
git commit -m "chore(agents): tag hive-mind as reference-agent (Category D)"
```

---

### Task 25b: Tag `orchestrator-v2` agent (Category D)

**Files:**

- Modify: `.claude/agents/orchestrator-v2.md`

- [ ] **Step 1: Read `orchestrator-v2.md` in full**

- [ ] **Step 2: Add `type: reference-agent` to frontmatter**

Add to frontmatter: `type: reference-agent`

Append to body:

```markdown
> **Reference agent:** This is an orchestration agent — it routes tasks to
> specialist agents and does not generate direct output. No capability uplift
> block is needed.
```

- [ ] **Step 3: Verify only insertions, then commit**

```bash
git diff --stat .claude/agents/orchestrator-v2.md
git add .claude/agents/orchestrator-v2.md
git commit -m "chore(agents): tag orchestrator-v2 as reference-agent (Category D)"
```

- [ ] **Sprint 5 boundary — verify clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Sprint 6 — Category D: Reference Skill Tagging

### Task 26: Tag all 18 Category D reference skills

**Files (modify frontmatter only — add `type: reference-skill` and one-line note):**

```
.claude/skills/content-pipeline/SKILL.md
.claude/skills/auth-patterns/SKILL.md
.claude/skills/social-integrations/SKILL.md
.claude/skills/video-engine/SKILL.md
.claude/skills/client-manager/SKILL.md
.claude/skills/scout/SKILL.md
.claude/skills/codex-agent-loader/SKILL.md
.claude/skills/build-orchestrator/SKILL.md
.claude/skills/project-scanner/SKILL.md
.claude/skills/competitive-local-strategy/SKILL.md
.claude/skills/google-business-profile/SKILL.md
.claude/skills/google-search-console/SKILL.md
.claude/skills/google-updates-sentinel/SKILL.md
.claude/skills/local-seo-agent/SKILL.md
.claude/skills/spec-generator/SKILL.md
.claude/skills/client-retention/SKILL.md
.claude/skills/sql-hardener/SKILL.md
.claude/skills/cli-anything/SKILL.md
```

- [ ] **Step 1: For each file, read it in full, then add `type: reference-skill` to frontmatter**

The `metadata:` block in each file gets one new line:

```yaml
type: reference-skill
```

- [ ] **Step 2: Append one-line note at the very end of each file**

```markdown
> **Reference skill:** This skill documents existing system architecture and does
> not generate creative, visual, or code output. No capability uplift block needed.
```

- [ ] **Step 3: Verify all 18 files show only insertions**

```bash
git diff --stat .claude/skills/content-pipeline/SKILL.md \
  .claude/skills/auth-patterns/SKILL.md \
  .claude/skills/social-integrations/SKILL.md
# (repeat spot-check for a few files)
```

Expected for each: `1 file changed, N insertions(+), 0 deletions(-)`

- [ ] **Step 4: Stage and commit all 18 at once**

```bash
git add .claude/skills/content-pipeline/SKILL.md \
  .claude/skills/auth-patterns/SKILL.md \
  .claude/skills/social-integrations/SKILL.md \
  .claude/skills/video-engine/SKILL.md \
  .claude/skills/client-manager/SKILL.md \
  .claude/skills/scout/SKILL.md \
  .claude/skills/codex-agent-loader/SKILL.md \
  .claude/skills/build-orchestrator/SKILL.md \
  .claude/skills/project-scanner/SKILL.md \
  .claude/skills/competitive-local-strategy/SKILL.md \
  .claude/skills/google-business-profile/SKILL.md \
  .claude/skills/google-search-console/SKILL.md \
  .claude/skills/google-updates-sentinel/SKILL.md \
  .claude/skills/local-seo-agent/SKILL.md \
  .claude/skills/spec-generator/SKILL.md \
  .claude/skills/client-retention/SKILL.md \
  .claude/skills/sql-hardener/SKILL.md \
  .claude/skills/cli-anything/SKILL.md

git commit -m "chore(skills): tag 18 Category D reference skills with type: reference-skill"
```

---

## Verification — Final Check

After all sprints complete:

- [ ] `ls .claude/skills/synthex-standards/references/` shows 4 files
- [ ] `grep -r "Capability Uplift" .claude/skills/ --include="SKILL.md" -l | wc -l` returns 16
- [ ] `grep -r "Capability Uplift" .claude/agents/ -l | wc -l` returns 7
- [ ] `grep -r "type: reference-skill" .claude/skills/ --include="SKILL.md" -l | wc -l` returns 18
- [ ] `grep -r "type: reference-agent" .claude/agents/ -l | wc -l` returns 2
- [ ] `git log --oneline | head -30` shows ~26 commits with `feat(skills)/feat(agents)/chore` prefixes
- [ ] `git diff --stat origin/main HEAD` shows 0 deletions across all skill/agent files
