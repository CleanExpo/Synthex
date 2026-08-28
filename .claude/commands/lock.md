---
description: Lock a winning art-board — freeze its theme, save it as a reusable template, generate the matching funnel suite, and record the decision in the brand's taste log
argument-hint: <run-id> <variation-name>
---

Follow §13 of `.claude/skills/synthex-design/SKILL.md` for the variation named
in: $ARGUMENTS

1. Freeze its `tokens.json` →
   `docs/marketing-agency/design-runs/templates/<BRAND>/<slug>.tokens.json`.
2. Save its board as a parameterised template (`{{HOOK}}`, `{{SUPPORT}}`,
   `{{CTA}}`, `{{IMAGE}}`) →
   `docs/marketing-agency/design-runs/templates/<BRAND>/<slug>.html`.
3. Generate the funnel suite from the same tokens: landing hero, 3 posts,
   1 story, og_image, email header — all DRAFT, same output contract.
4. Append the lock decision **and the stated reason** as one line to
   `docs/marketing-agency/design-runs/taste/<BRAND>.md`. Rejections get a line
   too. This is a decision log, not a performance loop.
5. Promote the record and the winner PNG per §12 tier 2 — the record under
   `docs/marketing-agency/design-runs/<run-id>/`, the PNG under
   `public/marketing-agency/design-runs/<run-id>/`.

**Precondition:** never promote a board still carrying a
`[NEEDS APPROVAL: …]` claim. Resolve the claim in the brand's `.claims.md`
first, or pick a different variation.
