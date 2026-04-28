# `lib/landing-page/` — Per-Suburb Landing-Page Generator (Foundation)

Produces the deterministic scaffold (HTML + JSON-LD + audit-trace) for a (`serviceCategory` × `suburb`) landing page on `disasterrecovery.com.au`. Foundation primitive for SYN-838 in the SYN-834 NRPG → DR pipeline.

**Linear:** SYN-838 (parent: SYN-834 epic)
**Owners:** `senior-copywriter` + `seo-schema` + `local-seo-geo-veteran`

> **Scope note:** This module ships the **gating primitives**. AI-generated copy and the cross-repo deploy are deliberately out of scope — those need CEO/auth sign-off. The validators here run regardless of who wrote the copy (deterministic template OR future AI variant via the `copyOverride` slot).

---

## Files

| File                | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `types.ts`          | `BuildLandingPageInput/Result`, `BrandIdentity`, `ValidationFinding`, regex consts |
| `template.ts`       | Deterministic copy template (no AI)                                                |
| `jsonld-builder.ts` | LocalBusiness + Service + Place JSON-LD graph                                      |
| `validators.ts`     | Aid Rule · category-claim · schema-vs-content match · PII leak                     |
| `page-builder.ts`   | Main API — `buildLandingPage(input, opts?)`                                        |
| `index.ts`          | Public re-exports                                                                  |

## Hard rules (binding behaviour)

1. **`sourceOfTruthJobId` required** on every call (Q3.2.4 H8). Embedded as an HTML comment in the rendered page for audit trace.
2. **`serviceCategory` whitelist** — `water-damage` | `fire` | `mould`. Mirrors SYN-840 sitemap whitelist.
3. **Aid Rule (block)** — copy NEVER frames AI as the actor. The `AI_AS_ACTOR_REGEX` catches `AI restores`, `AI cleans`, etc. Block-level finding → caller MUST reject.
4. **Category-claim gate (block by default)** — phrases like `leading`, `first`, `best`, `no.1` require `verificationGateState='verified'` from the caller. Without it → block. With it → warn (caller still confirms binding).
5. **Schema-vs-content match (block)** — Q3.2.3 A4. Visible copy MUST mention the noun the JSON-LD `Service.serviceType` declares (`water damage` / `fire damage` / `mould`). Mismatch → block.
6. **No contractor PII (block)** — copy must contain no phone numbers, no street addresses, and no caller-supplied forbidden substrings (typically contractor names). Page represents DR's coverage, not any individual contractor (Q3.2.5 P10).

## Usage

### Build the deterministic page (default)

```ts
import { buildLandingPage } from '@/lib/landing-page';

const result = buildLandingPage({
  sourceOfTruthJobId: event.sourceOfTruthJobId,
  serviceAreaCoverageId: coverageId,
  suburb: 'Brisbane CBD',
  postcode: '4000',
  serviceCategory: 'water-damage',
  brand: {
    name: 'Disaster Recovery',
    legalName: 'Disaster Recovery Pty Ltd',
    url: 'https://disasterrecovery.com.au',
    logoUrl: 'https://disasterrecovery.com.au/logo.png',
    telephone: '+61730000000',
    hq: { lat: -27.4698, lng: 153.0251, addressLocality: 'Brisbane' },
  },
});

if (!result.ok) {
  // CALLER MUST REJECT — block-level findings present.
  for (const v of result.validations.filter(v => v.severity === 'block')) {
    logger.error('landing-page rejected', { rule: v.rule, message: v.message });
  }
  return;
}

await commitPageToDrRepo({
  slug: result.slug,
  html: result.html,
  jsonLd: JSON.stringify(result.jsonLd),
});
```

### Inject AI-generated copy (future hook)

```ts
const aiCopy = await generateCopyWithAi({
  /* ... */
});

const result = buildLandingPage(input, {
  copyOverride: {
    headline: aiCopy.headline,
    intro: aiCopy.intro,
    bodyParagraphs: aiCopy.bodyParagraphs,
  },
});

// Validators run on AI copy too — same gates.
```

## Architecture notes

- **Validators are the load-bearing layer.** Anyone can write copy (template, AI, hand-edited). The validators decide whether it ships. This keeps the gate independent of how the copy is sourced.
- **No file I/O, no AI, no cross-repo deploy.** The function returns plain data. The caller decides where to write it. Keeps the cross-repo + secrets concerns in the caller.
- **Slug builder shared with `lib/sitemap`.** The same `slugifySuburb` produces both the URL the sitemap registers AND the URL this page is mounted at. One source of truth — the two CANNOT drift.
- **JSON-LD is one graph, not multiple `<script>` tags.** Cleaner parse for crawlers + LLMs and the `@id` references resolve in a single pass.

## What this layer does NOT do

- It does NOT generate AI copy — `copyOverride` is the integration slot
- It does NOT commit anything to the disasterrecovery.com.au repo — caller's job
- It does NOT brand-voice-enforce beyond the four blocking validators — a separate `brand-voice-enforce` skill is the secondary gate
- It does NOT produce per-contractor pages — single brand, no contractor PII
