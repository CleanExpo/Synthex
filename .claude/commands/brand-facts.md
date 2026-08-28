---
description: Build or update a brand's approved-claims sidecar (facts_approved + anti_references) that the design engine reads before it will print any claim
argument-hint: <brand-slug> [source URL or evidence reference]
---

Invocation: $ARGUMENTS

1. **Resolve the brand.** Unknown slug ⇒ **STOP**. `BrandSlug` is a closed union
   in `packages/brand-config/src/types.ts`; onboarding a new brand means editing
   `types.ts`, `brands/index.ts` and a `.design.md`, which is `brandprint`'s
   build recipe (`references/audit-recipe.md` → `references/build-recipe.md`)
   and a separate PR. Not this command's job.
2. **For voice, vocabulary and audience: invoke the `business-dna` skill.**
   Do not re-derive them here — that data already has an owner and a store.
3. **This command's only output** is
   `packages/brand-config/src/brands/<slug>.claims.md`.
4. **Extracted marketing claims never auto-enter `facts_approved`.** A website
   saying "#1 in QLD" is not substantiation. Every entry needs a source, a
   verified date, and — where one exists — the `vg_ref` of its row in
   `.claude/memory/verification-gates.md`. A claim whose VG row reads
   `[verification needed]` or `[placeholder]` must **not** be added.
5. **`anti_references` are text notes only** — never scrape or store a
   competitor's assets.
6. Only `foundation-keeper` may write `verification-gates.md`. If a claim needs
   a new gate, say so and stop; do not flip a gate from here.
