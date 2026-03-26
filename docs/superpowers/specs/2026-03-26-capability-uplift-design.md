# Capability Uplift — Skill & Agent System Design

**Date:** 2026-03-26
**Status:** Approved for implementation

---

## Goal

Override the LLMs baked-in default patterns — generic typography (Inter, Roboto), predictable colour schemes (purple gradients on white), bullet-heavy formatting, hollow AI writing voice ("Excited to announce..."), generic WCAG recitations — by injecting Synthex-specific standards into every skill and agent that produces output.

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
│   └── data-viz-standards.md     # Chart/dashboard aesthetic standards
```

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

### Category D — Reference Skills (no uplift needed)

These document existing systems and do not generate creative or code output. They receive only a `type: reference-skill` tag in frontmatter and a one-line note that they are read-only architecture guides.

Skills: `content-pipeline`, `auth-patterns`, `social-integrations`, `video-engine`, `cli-anything`, `client-manager`, `scout`, `codex-agent-loader`, `build-orchestrator`, `project-scanner`, `competitive-local-strategy`, `google-business-profile`, `google-search-console`, `google-updates-sentinel`, `local-seo-agent`, `spec-generator`, `client-retention`, `sql-hardener`, `cli-anything`

---

## Agents

All agents in `.claude/agents/` receive the same treatment as their equivalent category. The `description` field in each agent's frontmatter is made aggressively context-specific. Each agent body gets an uplift section naming what default LLM behaviour it replaces.

---

## Shared Reference File Specifications

### `aesthetic-standards.md`

```
ANTI-PATTERNS (never produce these):
- Inter or Roboto as sole typeface
- Purple (#8B5CF6 / #7C3AED) gradient on white
- Generic glassmorphism without Synthex tokens
- Drop shadows heavier than box-shadow: 0 8px 32px rgba(0,0,0,0.37)
- Flat/minimal "SaaS dashboard" white-on-white layouts

SYNTHEX DESIGN TOKENS:
- Primary: #f97316 (brand orange)
- Background: #0f172a (deep slate)
- Surface: rgba(255,255,255,0.08) with backdrop-filter: blur(12px)
- Border: 1px solid rgba(255,255,255,0.12)
- Text primary: #f8fafc | secondary: #94a3b8
- Heading font: Space Grotesk (weight 300–600)
- Body font: Inter (weight 400 only — never bold headings in Inter)
- Code font: JetBrains Mono
- Radius scale: 6 / 10 / 14 / 20 / 9999px
- Spacing base: 4px (0.25rem)
- Glass shadow: 0 8px 32px rgba(0,0,0,0.37)
- Elevated shadow: 0 20px 40px rgba(0,0,0,0.4)

DATA VISUALISATION:
- Chart backgrounds: transparent over dark surface
- Grid lines: rgba(255,255,255,0.06)
- Primary series: #f97316 | Secondary: #10B981 | Tertiary: #38BDF8
- Never use Chart.js default blue (#4472CA) or default red (#FF6384)
- Axis labels: #64748b, 11px, Space Grotesk
- Annotations: white/70, 12px
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

SYNTHEX VOICE STANDARDS:
- Australian English — colour, organise, recognise
- Specificity over superlatives: use numbers, outcomes, timeframes
- First line earns the read — no preamble, no context-setting
- Platform voice is distinct: LinkedIn (professional authority) ≠ Instagram (visual story) ≠ TikTok (direct challenge)
- CTAs name the action and the benefit: "Book a 15-min call → get your first post live this week"

CONTENT QUALITY GATES (minimum before output):
- Hook lands in first 125 characters (Instagram) / first line (LinkedIn)
- No more than 2 consecutive bullet points without a prose sentence
- Every piece has exactly one CTA — not zero, not two
- Hashtags chosen by search volume tier, not randomly appended
```

### `code-standards.md`

```
ANTI-PATTERNS (never produce these):
- `import { useRouter } from 'next/router'` → use 'next/navigation'
- `window.location.href = '/path'` → use useRouter().push()
- Raw fetch() in 'use client' components → use SWR with credentials:'include'
- Any auth system other than Supabase (never Clerk, NextAuth, Auth.js)
- Prisma queries without org-scope filter
- `prisma db push` for schema changes → use migrate diff + db execute
- `any` types
- try/catch that swallows errors silently

SYNTHEX PATTERNS:
- Auth: getUserIdFromRequestOrCookies() from lib/auth/jwt-utils
- Org scope: every query includes { organizationId } filter
- Mutations: Zod schema + safeParse before any DB write
- Error responses: { error: string, details?: unknown } shape
- Rate limiting: authStrict (5/min), writeDefault (30/min), readDefault (120/min)
- Data fetching: useSWR(url, fetchJson, { credentials:'include' })
- Australian English in all user-facing strings
```

### `data-viz-standards.md`

```
ANTI-PATTERNS:
- Chart.js default colour palette (blues, reds, greens in sequence)
- Grid lines heavier than 1px / opacity > 0.1
- Legends inside chart area blocking data
- No axis labels or units
- Tooltip shows raw numbers without formatting
- Pie charts for more than 4 categories

SYNTHEX CHART STANDARDS:
- Background: transparent (renders over dark surface)
- Grid: rgba(255,255,255,0.06) 1px horizontal only
- Primary series: #f97316 | fill: rgba(249,115,22,0.15)
- Comparison series: #10B981 | fill: rgba(16,185,129,0.15)
- Additional: #38BDF8, #A78BFA, #F472B6
- Axis: { color: '#64748b', fontSize: 11, fontFamily: 'Space Grotesk' }
- Tooltips: dark surface (#1e293b), 1px border rgba(255,255,255,0.12)
- Numbers: formatted with toLocaleString(), currency as AUD
- Responsive: always fill container width, min-height 200px
```

---

## Execution Order (safe, incremental)

### Sprint 1 — Foundation (additive only, zero risk)

- Create `synthex-standards/` directory + 4 reference files
- Single commit

### Sprint 2 — Category A: Visual skills (3 skills)

- `design` → `ui-ux` → `visual-content-brief`
- One commit per skill

### Sprint 3 — Category B: Content skills (6 skills)

- `brand-campaign-generator` → `platform-content-adaptor` → `platform-showcase` → `campaign-planner` → `brand-consistency-checker` → `business-dna`
- One commit per skill

### Sprint 4 — Category C: Code skills (6 skills)

- `route-auditor` → `code-review` → `security-hardener` → `database-prisma` → `api-testing` → `architecture-enforcer`
- One commit per skill

### Sprint 5 — Agents

- Read all `.claude/agents/` files
- Upgrade each agent: aggressive description + uplift block
- One commit per agent

### Sprint 6 — Reference skill tagging (Category D)

- Add `type: reference-skill` tag + one-line note to each
- Single commit

### Safety Rules

- Read each file in full before editing
- Only add uplift block + update frontmatter — no existing content removed
- Triggers are expanded, never narrowed
- Each sprint ends with a clean `git status`

---

## Success Criteria

- [ ] `synthex-standards/` exists with all 4 reference files
- [ ] Every Category A/B/C skill has a `## Capability Uplift` section
- [ ] Every skill trigger description has been made aggressively context-aware
- [ ] Every agent has an uplift block and a sharpened description
- [ ] Category D skills are tagged `type: reference-skill`
- [ ] All commits are clean, type-check passes after each sprint
- [ ] No existing skill content was removed — only uplift blocks added
