# DESIGN.md — Synthex

> The brand contract every AI agent (Claude Code, Claude Design, Cursor, v0, Aura)
> reads before producing UI, copy, or motion for this repo. Source of truth at
> `packages/brand-config/src/brands/synthex.ts`. This file is the human-
> and agent-readable projection plus Phill's 7 non-negotiable rules.
>
> **Special note:** Synthex hosts the canonical BrandConfig package
> (`packages/brand-config`) that every other portfolio repo's DESIGN.md
> references. Changes to brand tokens originate here and propagate outward
> via remotion-brand-codify.
>
> Updated: 2026-05-11. Spec: Google DESIGN.md v1 (community implementation).

---

## Brand Voice

- **Legal name:** Synthex
- **Tagline:** Synthetic intelligence at production scale.
- **Audience (primary):** ML engineers and platform teams shipping AI products
- **Audience (secondary):** CTOs evaluating synthetic-data infrastructure
- **Tone:** expert, authoritative, technical, automation-focused, ROI-grounded
- **Cadence:** medium.
- **Voice register:** technical authority without hype. Every claim is
  quantified or marked as estimate. No 10x-your-results language. Show the
  pipeline, the throughput, and the cost.
- **Default channel:** LinkedIn.

---

## Visual Tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| `--synthex-primary` | `#FF6B35` | Candy orange — brand primary |
| `--synthex-secondary` | `#0F172A` | Slate-900 — body chrome |
| `--synthex-accent` | `#22D3EE` | Cyan — signal / output indicator |
| `--neutral-50` | `#F8FAFC` | Canvas |
| `--neutral-100` | `#E2E8F0` | Surface |
| `--neutral-500` | `#64748B` | Muted text |
| `--neutral-900` | `#0F172A` | Body text |
| `--success` | `#10B981` | Pass |
| `--warning` | `#F59E0B` | Attention |
| `--danger` | `#EF4444` | Danger |

> **Known divergence:** `lib/remotion/registry.ts` uses `#f59e0b` (amber) for
> Synthex composition default colour for unbranded fallbacks.
> `brand-content.ts` and `brands/synthex.ts` are the canonical source for
> brand-specific output.

### CEO-Surface Overlay Tokens (Phill Rule 6)

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#0e1014` | Gun Metal — CEO views |
| `--red-500` | `#b30000` | Candy Red — CEO actions |
| `--orange-400` | `#e07020` | CEO secondary |
| `--green-500` | `#00a854` | CEO success |

### Typography
- **Display:** Inter, weight 800.
- **Body:** Inter, weight 400.
- **Mono:** JetBrains Mono, weight 500.

### Radius
- CEO register: 4–6px (sharp).
- Product / customer register: 10px (soft).

### Motion
- **Signature:** sweep (horizontal reveal — decisive, technical).
- Durations (frames @ 30fps): fast 8, base 16, slow 32.
- Easing: expo-out / expo-in / expo-in-out.
- Transition between scenes: 12 frames.

---

## Forbidden Patterns

### Icons (Phill Rule 1)
- **NO Lucide, HeroIcons, FontAwesome, or any other icon library in app code.**

### AI-Slop Phrases (brand-guardian global banned list)
- "In today's fast-paced world", "Game-changer", "Seamless" (unless quoting),
  "Leverage" (as verb), "Robust", "Cutting-edge", "State-of-the-art",
  "Dive into" / "delve into", "It's worth noting", "In conclusion" / "To
  summarise" as paragraph openers, "Our passionate team", "End-to-end
  solution", "Best-in-class", "Empower" / "empowering", "Unlock [potential]",
  rhetorical question paragraph openers.

### Synthex-Specific Forbidden
- `leverage`, `synergy` (in `forbiddenWords`)
- Never imply Synthex generates training data without consent.
- Never use stock AI-cliché imagery — no glowing brains, no blue particles,
  no neural-network-as-art, no "robot hand touching human hand".
- No unquantified claims ("10x your results", "transform your AI stack").

### Visual
- No generic AI aesthetics. This rule is especially strict for an AI
  infrastructure company. Synthex products must look like they were built
  by engineers, not auto-generated.
- No placeholder logos or initials for any business or client.
- No Lorem ipsum.

---

## Required Patterns

### Custom Geometric Marks (Phill Rule 2 — Option B)
- 24×24 viewBox, 1.5px stroke, square caps, miter joins, sharp corners,
  1–3 paths max, derived from the hexagon in the Unite-Group logo mark.

### Real Logos (Phill Rule 4)
- Real logo at `public/logos/synthex/{primary,inverted,icon}.svg`.
- Customer logos in `public/logos/{slug}.{png,svg}`. Logo auto-fetch via
  `/api/logo-fetch?domain=` where available.

### Technical Surfaces
- **Architecture diagrams:** real components, real arrows, real data shapes.
  Never decorative.
- **Code blocks:** real runnable code with the language clearly tagged.
- **Metric cards:** the number + the unit + the time window + the source.

### CEO-Facing Surfaces (Phill Rule 5)
- Show **WHAT TO DO**, not just metrics.
- Health scores in the background strip.
- Every metric paired with an action.

### Design Tokens (Phill Rule 6)
- No hardcoded colours, radii, or typography. Use the tokens above.
- This repo is the source-of-truth — additions here propagate to all other
  portfolio repos. Be deliberate.

### Autonomy (Phill Rule 7)
- Any process that runs manually (brand-codify, content publish, evaluation
  runs) must be automated and observable.

---

## Approval Gates

Before any client-facing surface ships to production:

1. **brand-guardian skill** returns `APPROVED`.
2. **qa-lead skill** passes the rubric.
3. **One hallucination = automatic REVISE** for any technical / product claim.
   Synthex is an authority brand — wrong technical claims are existential.
4. **The $2B filter** — every piece positions Synthex as the synthetic-data
   authority. Pieces that undermine that positioning block.

---

## CI Lint Integration

This repo runs the DESIGN.md lint on every PR via
`.github/workflows/design-lint.yml`. The lint asserts:

1. `.claude/DESIGN.md` exists.
2. All 6 required H2 headings are present.
3. No **net-new** imports from `lucide-react`, `@heroicons/react`, or
   `@fortawesome/*`. Baseline at `.github/design-md-lint.baseline.txt`.
4. AI-slop phrase scan (warn-only in v1).

To run locally: `bash .github/scripts/design-md-lint.sh`.

Existing CI surfaces: `ci.yml`, `accuracy-gate.yml`, `agent-pr-checks.yml`,
`brand-intelligence-cron.yml`, `client-value-scorecard.yml`,
`hermes-skill-check.yml`, `lighthouse.yml`, `review-board.yml`,
`security.yml`, `deploy.yml`. design-lint runs alongside on every PR.

---

## References

- Source of truth (typed): `packages/brand-config/src/brands/synthex.ts`
- Visual tokens (.design.md): `packages/brand-config/src/brands/synthex.design.md`
- Brand-config package overview: `packages/brand-config/src/types.ts`
- Phill's 7 design rules: `~/.claude/projects/-Users-phill-mac-2nd-Brain/memory/feedback_design_preferences.md`
- Brand guardian skill: `~/.claude/skills/brand-guardian/SKILL.md`
- Pattern reference: `~/2nd Brain/2nd Brain/Wiki/design-system-approach.md`
