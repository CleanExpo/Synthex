# site-generator — multi-tenant AI-website core

Phase 3 of the AI-Websites product line
([spec](../../docs/superpowers/specs/2026-07-10-ai-websites-design.md)). Turns a
normalised **BusinessProfile** + **brand tokens** into a deterministic, on-brand,
schema-marked, validator-gated site section for **any** portfolio brand.

Generalises the DR-only [`lib/landing-page`](../landing-page/README.md) primitive.
That module is intentionally single-brand (the L7 carve-out); this one is
multi-tenant and BrandConfig-driven. It reuses the same gating philosophy — the
validators, not the copy, are the product.

## API

```ts
import { generateSite } from '@/lib/site-generator';

const result = generateSite({ brand, profile }, opts?);
// → { slug, canonicalUrl, copy, html, jsonLd, validations, ok }
```

`generateSite` is a **pure function** — no I/O, no network, no AI. The caller:

1. inspects `validations` and rejects the page if `ok === false`;
2. writes `html` + `JSON.stringify(jsonLd)` into a Next.js page;
3. embeds the agent widget alongside it.

## Separation of concerns

- **BrandConfig** (`SiteBrand`) → design + voice (name, logo, `forbiddenWords`).
- **BusinessProfile** → the business's facts (name, contact, geo, services,
  reviews, FAQs) — the normalised shape a Google Business Profile fetch produces.

## Validation gates (block ⇒ caller must reject)

| Rule                         | Why                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `aid-rule`                   | Copy never frames AI as the actor — the operator acts, AI is the tool.             |
| `category-claim`             | ACL §18 superlatives ("best", "leading") need `verificationGateState: 'verified'`. |
| `schema-content-match`       | Visible copy must mention the hero service the JSON-LD declares.                   |
| `brand-voice-forbidden-word` | Copy must not contain the brand's forbidden words.                                 |
| `forbidden-substring`        | Caller-supplied defence-in-depth (e.g. scraped third-party data).                  |

Unlike the DR module, a business's own phone/address are **allowed** in copy — a
generic business site is expected to show them.

## Out of scope (later slices)

Live Google Business Profile fetch, LLM copy generation (plugs in via
`GenerateSiteOptions.copyOverride`), and cross-repo deploy — all compose on top of
this cred-free core.
