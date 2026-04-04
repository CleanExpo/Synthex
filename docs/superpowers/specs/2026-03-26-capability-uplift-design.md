# Capability Uplift — Skill & Agent System Design

**Date:** 2026-03-26
**Status:** Approved for implementation

---

## Goal

Override the LLM's baked-in default patterns — generic typography (Inter, Roboto), predictable colour schemes (purple gradients on white), bullet-heavy formatting, hollow AI writing voice ("Excited to announce..."), generic WCAG recitations — by injecting Synthex-specific standards into every skill and agent that produces output.

Every output-generating skill gets an explicit anti-pattern block, a concrete replacement standard, and a pointer to shared reference material. Reference-only skills get tagged and left alone.

---

## Architecture

### Shared Standards Layer

A new `synthex-standards` skill acts as the single source of truth. All output-generating skills reference it rather than duplicating standards inline.

```
.claude/skills/synthex-standards/
├── SKILL.md                      # Auto-loaded on any visual/content/code task
├── references/
│   ├── aesthetic-standards.md    # Visual anti-patterns + Synthex design tokens
│   ├── content-standards.md      # Voice, writing quality, anti-patterns per content type
│   ├── code-standards.md         # Synthex-specific code patterns
│   └── data-viz-standards.md     # Chart/dashboard aesthetic standards (canonical source)
```

`aesthetic-standards.md` covers typography, colour, spacing, and glass tokens.
`data-viz-standards.md` is the **sole** canonical source for all chart/graph standards.
`aesthetic-standards.md` cross-references `data-viz-standards.md` but does not duplicate chart values.

### Uplift Block Pattern

Every output-generating skill receives this section, customised per domain:

```markdown
## Capability Uplift — Override Defaults

**NEVER** [domain-specific anti-patterns — named explicitly]
**INSTEAD** [the Synthex standard — concrete values, not theory]
**REFERENCE** `.claude/skills/synthex-standards/references/[relevant file]`
```

This pattern follows the four-part Capability Uplift structure:

1. Name what's broken (explicit anti-patterns)
2. Provide the replacement standard (concrete principles with actual values)
3. Bundle reference assets (shared standards files)
4. Trigger aggressively (updated frontmatter descriptions)

### Frontmatter Update Pattern

For every skill, two frontmatter fields are updated. Example showing `design` skill before/after:

**Before:**

```yaml
---
name: design
description: >-
  Design system specialist for SYNTHEX marketing platform. Maintains glassmorphic
  UI consistency, implements responsive layouts, and ensures brand coherence.
  Use when creating UI components, implementing visual elements, reviewing UI
  consistency, or working with the glassmorphic design system.
metadata:
  triggers:
    - design
    - ui component
    - glassmorphism
---
```

**After:**

```yaml
---
name: design
description: >-
  Synthex design system enforcer. NEVER use Inter as a heading font, purple
  gradients on white, or generic glassmorphism. ALWAYS use Space Grotesk
  headings, #f97316 brand orange, #0f172a slate background, and Synthex
  glass tokens. Activate on ANY request involving UI, components, styling,
  layout, visual design, colour, typography, or anything users will see.
metadata:
  type: capability-uplift-visual
  triggers:
    - design
    - ui component
    - glassmorphism
    - visual
    - colour
    - typography
    - layout
    - component
    - styling
    - interface
---
```

The `description` becomes the anti-pattern statement + replacement summary.
The `triggers` list is expanded — existing triggers are never removed, new ones are added.
A `type` field is added to all uplifted skills: `capability-uplift-visual`, `capability-uplift-content`, or `capability-uplift-code`.

---

## Skill Categories

### Category A — Visual Output Skills

Produce UI components, design specs, image prompts. Deepest LLM slop exposure.

Full uplift: anti-pattern block + actual hex/font/spacing values + aggressive trigger description + reference to `aesthetic-standards.md`.

| Skill                  | Primary Anti-Pattern Overridden                                             |
| ---------------------- | --------------------------------------------------------------------------- |
| `design`               | Inter-only typography, generic glassmorphism, purple (#8B5CF6) default      |
| `ui-ux`                | Bullet-list audit reports, generic WCAG recitations without Synthex context |
| `visual-content-brief` | Stock photo aesthetics, generic AI image prompt structure                   |
| `ui-review`            | Generic accessibility checklists, no Synthex-specific interaction standards |

### Category B — Content Output Skills

Produce text content, campaigns, platform posts — the content Synthex users publish.

Uplift overrides generic AI writing voice, bullet-heavy defaults, hollow engagement hooks. Reference `content-standards.md`.

| Skill                       | Primary Anti-Pattern Overridden                               |
| --------------------------- | ------------------------------------------------------------- |
| `brand-campaign-generator`  | Generic hooks, buzzword-heavy copy ("leverage", "synergy")    |
| `platform-content-adaptor`  | Platform-agnostic tone, missing voice specificity             |
| `platform-showcase`         | Generic platform feature descriptions                         |
| `campaign-planner`          | Generic 30/60/90 calendar templates, predictable content arcs |
| `brand-consistency-checker` | Vague feedback ("sounds on-brand", "good feel")               |
| `business-dna`              | Surface-level brand extractions, generic persona archetypes   |

### Category C — Code Output Skills

Produce TypeScript, SQL, test code. Uplift enforces Synthex-specific patterns over generic framework defaults.

Reference `code-standards.md`.

| Skill                   | Primary Anti-Pattern Overridden                              |
| ----------------------- | ------------------------------------------------------------ |
| `route-auditor`         | Generic REST conventions → Synthex Zod + org-scope pattern   |
| `code-review`           | Generic clean code principles → Synthex-specific conventions |
| `security-hardener`     | Generic OWASP checklists → Synthex threat model              |
| `database-prisma`       | Generic ORM patterns → org-scoped queries + migration safety |
| `api-testing`           | Generic Jest patterns → Synthex test conventions             |
| `architecture-enforcer` | Generic architecture principles → Synthex layer rules        |

### Category D — Reference Skills (tag only, no uplift)

These document existing systems and do not generate creative or code output. They receive only a `type: reference-skill` tag in frontmatter and a one-line note that they are read-only architecture guides. No uplift block is added.

Skills: `content-pipeline`, `auth-patterns`, `social-integrations`, `video-engine`, `client-manager`, `scout`, `codex-agent-loader`, `build-orchestrator`, `project-scanner`, `competitive-local-strategy`, `google-business-profile`, `google-search-console`, `google-updates-sentinel`, `local-seo-agent`, `spec-generator`, `client-retention`, `sql-hardener`, `cli-anything`

---

## Agents

### Agent Category Map

Each agent in `.claude/agents/` is assigned a category and uplifted accordingly. Two files are exempt (reference documents, no uplift): `index.md` and `codex/CATALOGUE.md`.

| Agent                    | Category      | Uplift Reference       |
| ------------------------ | ------------- | ---------------------- |
| `build-engineer`         | C — Code      | `code-standards.md`    |
| `code-architect`         | C — Code      | `code-standards.md`    |
| `qa-sentinel`            | C — Code      | `code-standards.md`    |
| `senior-reviewer`        | C — Code      | `code-standards.md`    |
| `verification-agent`     | C — Code      | `code-standards.md`    |
| `codex/security-auditor` | C — Code      | `code-standards.md`    |
| `ceo`                    | B — Content   | `content-standards.md` |
| `hive-mind`              | D — Reference | tag only               |
| `orchestrator-v2`        | D — Reference | tag only               |
| `index.md`               | exempt        | no changes             |
| `codex/CATALOGUE.md`     | exempt        | no changes             |

### Agent Uplift Pattern

Category B and C agents: update `description` to be aggressively context-specific, add `type: capability-uplift-content` or `type: capability-uplift-code` to frontmatter, and add a `## Capability Uplift` block to the body naming what default LLM behaviour is replaced.

Category D agents (`hive-mind`, `orchestrator-v2`): add `type: reference-agent` to frontmatter and a one-line read-only note — same pattern as Category D reference skills. No uplift block.

One commit per agent.

---

## Shared Reference File Specifications

### `aesthetic-standards.md`

```
ANTI-PATTERNS (never produce these):
- Inter or Roboto as sole typeface for headings
- Purple (#8B5CF6 / #7C3AED) gradient on white
- Generic glassmorphism without Synthex tokens (arbitrary rgba + blur)
- Drop shadows heavier than box-shadow: 0 8px 32px rgba(0,0,0,0.37)
- Flat/minimal "SaaS dashboard" white-on-white layouts
- Dark mode as afterthought (Synthex is dark-first)

SYNTHEX DESIGN TOKENS:
- Primary: #f97316 (brand orange)
- Background: #0f172a (deep slate)
- Surface: rgba(255,255,255,0.08) with backdrop-filter: blur(12px)
- Border: 1px solid rgba(255,255,255,0.12)
- Text primary: #f8fafc | secondary: #94a3b8 | muted: #64748b
- Heading font: Space Grotesk (weight 300–600) — NEVER Inter for headings
- Body font: Inter weight 400 only
- Code font: JetBrains Mono
- Radius scale: 6 / 10 / 14 / 20 / 9999px
- Spacing base: 4px (0.25rem)
- Glass shadow: 0 8px 32px rgba(0,0,0,0.37)
- Elevated shadow: 0 20px 40px rgba(0,0,0,0.4)

For chart/data visualisation standards → see data-viz-standards.md
```

### `content-standards.md`

```
ANTI-PATTERNS (never write these):
- "Excited to announce..."
- "In today's fast-paced world..."
- "Leverage [noun] to [verb] your [outcome]"
- "Game-changing", "revolutionary", "disrupting the industry"
- Opening with "I" on LinkedIn
- Three-bullet summary at end of every AI response
- Em-dash after colon to introduce lists
- Hollow CTAs ("Learn more", "Click here")
- Passive voice to hedge ("it could be said that...")

SYNTHEX VOICE STANDARDS:
- Australian English — colour, organise, recognise, licence (noun), authorise
- Specificity over superlatives: use numbers, outcomes, timeframes
- First line earns the read — no preamble, no context-setting
- Platform voice is distinct:
    LinkedIn: professional authority, first-person narrative
    Instagram: visual story, community-focused
    TikTok: direct challenge, fast hook
    Facebook: approachable, conversational
    X/Twitter: punchy, opinionated
- CTAs name the action and the benefit: "Book a 15-min call → get your first post live this week"

CONTENT QUALITY GATES (minimum before output):
- Hook lands in first 125 characters (Instagram) / first line (LinkedIn)
- No more than 2 consecutive bullet points without a prose sentence
- Every piece has exactly one CTA — not zero, not two
- Hashtags chosen by search volume tier, not randomly appended
- Every score reported as: overall / engagement / platform-fit / readability
```

### `code-standards.md`

```
ANTI-PATTERNS (never produce these):
- `import { useRouter } from 'next/router'` → use 'next/navigation'
- `window.location.href = '/path'` → use useRouter().push()
- Raw fetch() in 'use client' components → use SWR with credentials:'include'
- Any auth system other than Supabase (never Clerk, NextAuth, Auth.js)
- Prisma queries without organizationId filter
- `prisma db push` for schema changes → use migrate diff + db execute
- `any` types in request/response handlers
- try/catch that swallows errors silently
- window.confirm() / window.alert() — blocks browser events
- localStorage for auth tokens

SYNTHEX PATTERNS:
- Auth: getUserIdFromRequestOrCookies() from lib/auth/jwt-utils
- Org scope: every query includes { organizationId } or { campaign: { organizationId } }
- Mutations: Zod schema.safeParse(body) before any DB write
- Error responses: { error: string, details?: unknown } shape
- Rate limiting: authStrict (5/min), writeDefault (30/min), readDefault (120/min)
- Data fetching: useSWR(url, fetchJson, { credentials:'include' })
- Australian English in all user-facing strings
- Currency: AUD | Dates: DD/MM/YYYY
```

### `data-viz-standards.md`

```
ANTI-PATTERNS:
- Chart.js/Recharts default colour palette (blues, reds, greens in sequence)
- Grid lines heavier than 1px or opacity > 0.1
- Legends inside chart area blocking data
- No axis labels or units
- Tooltip shows raw numbers without formatting
- Pie charts for more than 4 categories
- White or light chart backgrounds (Synthex is dark-first)

SYNTHEX CHART STANDARDS:
- Background: transparent (renders over #0f172a dark surface)
- Grid: rgba(255,255,255,0.06) 1px horizontal lines only
- Primary series: #f97316 | area fill: rgba(249,115,22,0.15)
- Comparison series: #10B981 | area fill: rgba(16,185,129,0.15)
- Additional series: #38BDF8, #A78BFA, #F472B6
- Axis: { color: '#64748b', fontSize: 11, fontFamily: 'Space Grotesk' }
- Tooltips: background #1e293b, border 1px rgba(255,255,255,0.12), text #f8fafc
- Numbers: formatted with toLocaleString(), currency shown as AUD
- Responsive: always fill container width, min-height 200px
- Annotations: #94a3b8, 12px Space Grotesk
```

---

## Execution Order (safe, incremental)

### Sprint 1 — Foundation (additive only, zero risk)

- Create `.claude/skills/synthex-standards/` directory
- Write `SKILL.md` + all 4 reference files
- Single commit: `feat(skills): synthex-standards shared uplift reference layer`

### Sprint 2 — Category A: Visual skills (4 skills)

- `design` → `ui-ux` → `visual-content-brief` → `ui-review`
- One commit per skill: `feat(skills): uplift [skill-name] — override visual defaults`

### Sprint 3 — Category B: Content skills (6 skills)

- `brand-campaign-generator` → `platform-content-adaptor` → `platform-showcase` → `campaign-planner` → `brand-consistency-checker` → `business-dna`
- One commit per skill: `feat(skills): uplift [skill-name] — override content defaults`

### Sprint 4 — Category C: Code skills (6 skills)

- `route-auditor` → `code-review` → `security-hardener` → `database-prisma` → `api-testing` → `architecture-enforcer`
- One commit per skill: `feat(skills): uplift [skill-name] — override code defaults`

### Sprint 5 — Agents (9 agents, 2 exempt)

- Category C agents: `build-engineer` → `code-architect` → `qa-sentinel` → `senior-reviewer` → `verification-agent` → `codex/security-auditor`
- Category B agents: `ceo`
- Category D agents (tag only): `hive-mind` → `orchestrator-v2`
- Exempt (no changes): `index.md`, `codex/CATALOGUE.md`
- One commit per agent: `feat(agents): uplift [agent-name] — override defaults`

### Sprint 6 — Reference skill tagging (Category D, 18 skills)

- Add `type: reference-skill` frontmatter tag and one-line note to each
- Single commit: `chore(skills): tag category-D reference skills`

### Safety Rules

- Read each file in full before editing
- Only add uplift block + update frontmatter — no existing content removed
- Triggers list is expanded, never narrowed (existing triggers preserved)
- Each sprint ends with `git status` clean before moving to the next
- Verification after each sprint: `git diff --stat HEAD~N` shows only additions

---

## Success Criteria

- [ ] `synthex-standards/` exists with all 4 reference files
- [ ] Every Category A/B/C skill has a `## Capability Uplift` section
- [ ] Every uplifted skill has `type: capability-uplift-*` in frontmatter
- [ ] Every skill trigger description has been made aggressively context-aware
- [ ] Every agent (except `index.md` and `codex/CATALOGUE.md`) has been uplifted or tagged
- [ ] Category D skills are tagged `type: reference-skill`
- [ ] `data-viz-standards.md` is the sole source for chart colours — not duplicated in `aesthetic-standards.md`
- [ ] All commits are clean, each sprint ends with `git status` showing nothing staged
- [ ] `git diff --stat HEAD~N` for any skill commit shows only insertions, zero deletions of existing content
