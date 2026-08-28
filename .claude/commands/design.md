---
description: Generate N radically different, client-ready marketing art-boards for a portfolio brand via the synthex-design skill — rendered, seen, and independently scored. Draft only.
argument-hint: '[asset] for [subject] | brand: carsi | audience: ... | cta: ... | facts: claim1; claim2 | n: 3'
---

Read and follow `.claude/skills/synthex-design/SKILL.md` exactly, end to end.

Invocation: $ARGUMENTS

- Parse the slots per §1. If SUBJECT is missing, ask **once**, then proceed.
  Defaults: `N=3`, `ASSET=instagram_post`, `BRAND=synthex`, `IMAGERY=none`.
- **Unknown BRAND ⇒ STOP.** `BrandSlug` is a closed union
  (`dr`, `nrpg`, `ra`, `carsi`, `synthex`, `unite`, `john-coutis`). Onboarding a
  new brand is a `brandprint` job, not this command's.
- Load brand context per §2 — the `.design.md`, the `.ts`, and the `.claims.md`
  sidecar — and cite all three by path. `tokenStatus: 'proposal'` ⇒ STOP.
- State the category default being avoided (§3) into the manifest.
- Render every board **and read the PNGs back** (§8) before any critique.
  Scoring from HTML is an invalid run.
- Run the §9 stage-2 review by dispatching the `design-critic` subagent. Call it
  independent-context review — never cross-vendor.
- Finish with the §12 output contract (files + manifest, status DRAFT), the
  index-row write, and one line naming the recommended variation and why.
- Never publish, post, or schedule anything.

> This is marketing creative. For product UI, components, or the Synthex glass
> design system, use the `design` skill instead.
