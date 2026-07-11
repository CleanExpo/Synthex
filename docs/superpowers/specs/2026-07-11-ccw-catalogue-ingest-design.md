# Design Spec — CCW Catalogue Ingestion into the Owned Reference Library (slice 1)

- **Date:** 2026-07-11
- **Status:** Approved design (founder pre-approved); spec for implementation planning
- **Type:** Ingestion script + one resolver enhancement + manifest schema extension. No DB migration, no new MCP tool.
- **Builds on:** the prod-verified grounding foundation (`public/reference-library/` + bundled
  `manifest.json` + `lib/services/ai/reference-library.ts` + `generate_image(referenceSet)`).
- **Evidence tags:** `[VERIFIED]` = measured live this session; `[ASSERTED]` = founder-supplied fact;
  `[UNCONFIRMED]` = assumption/risk.

---

## 1. Problem & intent

Grounded generation is live, but the owned library is thin (18 wand + 6 upholstery studio shots +
~16 job photos). The founder wants **lots of real training data** so outputs stop reading as
synthetic. CCW (ccwonline.com.au) — the founder's partner — has a full professional catalogue of the
exact equipment these industries use. Ingesting it multiplies the real-image corpus ~10× and, for the
first time, populates **water-damage-restoration** with owned equipment imagery (Razorback air
movers, dehumidifiers, specialist drying gear).

This is **reference-corpus growth for grounding**, not model fine-tuning (a LoRA fine-tune on this
same corpus is the natural follow-on once the corpus exists — §13).

## 2. Verified catalogue facts `[VERIFIED 2026-07-11]`

Measured live from `https://www.ccwonline.com.au/products.json` (public Shopify endpoint, paginated
`?limit=250&page=N`, terminates on an empty page):

| Fact                                                | Value                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total products                                      | **1,744** (7 pages)                                                                                                                                     |
| Structured fields per product                       | `title`, `handle`, `vendor`, `product_type`, `images[] {src,width,height}`, `body_html`, `tags`                                                         |
| Equipment products (after excluding chemical types) | **≈166**                                                                                                                                                |
| Equipment images at ≤4/product cap                  | **≈348**                                                                                                                                                |
| CCW own-brand vendors                               | `Carpet Cleaners Warehouse` (59), `Razorback` (49), `Razorback Sandia` (16)                                                                             |
| Largest reseller vendors                            | Hydroforce (264), Actichem (179), Hydramaster (111), Tramex (81), Bridgepoint (74), Sapphire Scientific (31), Phoenix Restoration (30), Dri-eaz (29), … |
| Image hosting                                       | Shopify CDN (`cdn.shopify.com`), supports size-suffix variants (e.g. `_2048x2048`)                                                                      |

## 3. Decisions locked

| #   | Decision           | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Rights             | **Entire catalogue ingested as `rights:"owned"`.** `[ASSERTED]` The founder states CCW has confirmed supplier AI-training/redistribution rights (recorded 2026-07-11). Every entry still carries full **provenance** (vendor, source URL, rights basis) so any vendor's images can be located and re-tagged/removed with one filter if that assertion ever changes. The agent flagged the reseller-rights risk twice; the founder holds the CCW agreements and made the call. |
| C2  | Placement          | Map equipment into the **existing industries** (`carpet-cleaning`, `upholstery-cleaning`, `water-damage-restoration`) so prompt auto-detect keeps working. Non-fitting categories (tile & grout, aircon cleaning) are **skipped and reported**, not force-fitted (§5).                                                                                                                                                                                                        |
| C3  | Scope              | **Equipment only.** Chemicals (`* CHEM *`), meters/instruments (`* METERS & INSTR`), parts (`IMP PART *`, valves/jets), garment/misc types are excluded in v1 — bottles and boxes are weak grounding references.                                                                                                                                                                                                                                                              |
| C4  | Mechanism          | A **repeatable Node script** (`scripts/ingest-ccw-catalogue.ts`) with `--dry-run`, idempotency, and a size guard — same family as the existing `scripts/generate-ccw-*.ts`. Run manually; committed output. No cron in v1.                                                                                                                                                                                                                                                    |
| C5  | Identity coherence | Grounding references must depict **one subject** per generation — mixing 4 different machines into FLUX's reference slots smears identity. The resolver therefore gains **subject-level selection**, not blind cross-subject aggregation (§7).                                                                                                                                                                                                                                |

## 4. Architecture

```
ccwonline.com.au/products.json (paginated)
        │  fetch + filter (equipment allowlist §5)
        ▼
scripts/ingest-ccw-catalogue.ts
        │  download ≤4 imgs/product (Shopify CDN _2048x2048 variant)
        │  sharp → webp q90, ≤2048px long edge
        ▼
public/reference-library/<industry>/ccw-<handle>-NN.webp
        +
public/reference-library/manifest.json   (one subject per product, provenance block)
        ▼  (bundled at build — Vercel-safe per the shipped manifest-bundle fix)
lib/services/ai/reference-library.ts     (subject-aware resolution §7)
        ▼
generate_image / generate_video (referenceSet: 'industry' or 'industry/subject')
```

## 5. Equipment allowlist — `product_type` → industry `[VERIFIED types]`

**Primary routing (by `product_type`):**

| product_type                                                                                              | → industry                                 | ≈products |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------- |
| `DOM EQUIP TRUCKMOUNT ACCESS`, `IMP EQUIP TRUCKMOUNT ACCESS`                                              | carpet-cleaning                            | 30        |
| `DOM EQUIP ROTARYS & SCRUBBERS`, `IMP EQUIP ROTARYS AND SRUBBERS`, `IMP EQUIP ROTARYS AND SRUBBERS CHINA` | carpet-cleaning                            | 12        |
| `DOM EQUIP VACUUM CLEANERS`, `IMP EQUIP VAC CLEANERS & SPAYE`                                             | carpet-cleaning                            | 10        |
| `DOM EQUIP METH`                                                                                          | carpet-cleaning                            | 5         |
| `DOM REST AIRMOVERS`, `IMP REST AIRMOVERS`, `IMP REST AIRMOVERS CHINA`                                    | water-damage-restoration                   | 16        |
| `IMP REST DEHUMIDIFIERS`                                                                                  | water-damage-restoration                   | 2         |
| `DOM REST SPEC DRYING`, `IMP REST SPEC DRYING`                                                            | water-damage-restoration                   | 60        |
| `DOM EQUIP TILE & GROUT`, `IMP EQUIP TILE & GROUT`                                                        | **skipped** (no hard-floor industry in v1) | 24        |
| `IMP EQUIP AIRCON CLEANING`                                                                               | **skipped**                                | 6         |

**Secondary routing (by title keyword, applied after the type match):** any allowlisted product whose
title contains `upholstery` re-routes to `upholstery-cleaning` (upholstery tools live under
truckmount-access/other types — no dedicated type exists `[VERIFIED]`).

**Unmapped-type rule:** every product whose type is NOT in the allowlist or skip-list is counted and
printed in the dry-run report (`unmapped: {type: count}`) — silent drops are forbidden. The mapping
table is data at the top of the script, trivially extendable.

## 6. Ingestion script — `scripts/ingest-ccw-catalogue.ts`

- **Fetch:** paginate `products.json?limit=250&page=N` until an empty page; abort (exit 1, no writes)
  on any non-200 or malformed page.
- **Select:** apply §5. Cap **4 images/product** (Shopify orders the primary image first).
- **Download:** request the `_2048x2048` CDN variant; process with `sharp` (already a dependency) →
  webp quality 90, long edge ≤2048 — matching the existing library's format exactly.
- **Naming:** `ccw-<handle>-NN.webp` (zero-padded, per product), in the mapped industry's directory.
  Shopify `handle` is URL-safe and unique — safe as a filename/subject key.
- **Manifest write:** one **subject per product** under the mapped industry:
  ```jsonc
  "ccw-razorback-aam-pro-axial-air-mover": {
    "rights": "owned",
    "label": "Razorback AAM Pro Axial Air Mover",
    "provenance": {
      "source": "ccw-shopify",
      "vendor": "Razorback",
      "sourceUrl": "https://www.ccwonline.com.au/products/<handle>",
      "ingestedAt": "2026-07-11",
      "rightsBasis": "CCW own brand"           // or:
      // "rightsBasis": "CCW-confirmed supplier AI-training rights (founder-asserted 2026-07-11)"
    },
    "images": [ { "file": "ccw-<handle>-01.webp", "width": 2048, "height": 2048, "source": "ccw-shopify" }, … ]
  }
  ```
  `rightsBasis` is `"CCW own brand"` for vendors `Carpet Cleaners Warehouse` / `Razorback` /
  `Razorback Sandia`; the founder-asserted string for all others. **Audit contract:** one filter over
  `provenance.vendor` (or `rightsBasis`) locates every image from any supplier for re-tag/removal.
- **Idempotency:** a product is skipped when its manifest subject exists AND all its listed files
  exist on disk; `--force-refresh <handle|vendor>` re-ingests selectively. Re-runs never duplicate.
- **`--dry-run` (mandatory first run):** prints, without downloading: products per industry, per
  vendor, per rightsBasis; capped image count; **estimated total MB** (from JSON dims ≈ 0.25 MB/img);
  the skipped + unmapped type report.
- **Size guard:** hard-stop if the estimated ingest exceeds **150 MB** unless `--force-size`.
  Estimate at ≈348 images ≈ **35–90 MB** `[UNCONFIRMED until dry-run]` — under guard, but committed to
  git; if the repo grows uncomfortable, migration to object storage is the named follow-on (§13).
- **README:** the script emits a refreshed industries/subjects summary table to stdout for pasting
  into `public/reference-library/README.md` (kept a human edit in v1).

## 7. Resolver enhancement — subject-aware selection (`lib/services/ai/reference-library.ts`)

**Today** `resolveFromManifest` returns images from `owned[0]` only — with ~166 new subjects, almost
everything would be unreachable, and naive cross-subject aggregation would hand FLUX a mixed bag of
different machines (identity smear — C5). **Change:**

1. `referenceSet` accepts **`industry`** or **`industry/subject`** (split on the first `/`; both
   segments validated with `Object.hasOwn`). No Zod change — `generate_image.referenceSet` is already
   a plain string; auto-detect from prompt is unchanged.
2. Industry-only resolution picks the **single best-matching owned subject**:
   - Tokenise the prompt (lowercase, split on non-alphanumerics, drop tokens < 3 chars).
   - Score each owned subject by token overlap with its `key` + `label`.
   - Highest score wins; ties and zero-score fall back to the **first owned subject in manifest
     order** (today's behaviour — the hand-shot wand set stays first for carpet-cleaning, so every
     existing test and caller behaves identically `[VERIFIED against tests/unit/ai/reference-library.test.ts]`).
3. Images are returned from that **one** subject only, `max` unchanged (default 4).
4. `ResolvedReferences.subject` reports the chosen subject key (existing field, now meaningful).

**Examples:** prompt "Razorback air mover drying a wet carpet" + set `water-damage-restoration` →
subject `ccw-razorback-aam-pro-axial-air-mover`; explicit
`carpet-cleaning/ccw-sapphire-titanium-wand-…` → exactly that product.

## 8. Manifest type additions (additive, backward-compatible)

`ManifestSubject` gains optional `provenance?: { source: string; vendor: string; sourceUrl: string;
ingestedAt: string; rightsBasis: string }`. Existing subjects (no provenance) remain valid; the
resolver never reads provenance (it is audit metadata). `listReferenceSets()` gains `vendor?` on the
subject summary so `list_reference_sets` output shows provenance at a glance.

## 9. Tests

- **Resolver (extend `tests/unit/ai/reference-library.test.ts`, synthetic manifests):**
  `industry/subject` explicit selection; best-match scoring picks the air-mover subject for an
  air-mover prompt; zero-score falls back to first owned subject (regression pin for today's
  behaviour); `industry/unknown-subject` → empty (fail-closed); malformed set (`a/b/c`, `/`, trailing
  `/`) → empty; owned-only guard still excludes non-owned subjects under the new selection.
- **⚠ Known breaking test to update:** `reference-library.test.ts` "never returns references for a
  non-owned / unknown set" currently uses **`water-damage-restoration` against the real manifest** as
  its empty fixture — ingestion populates that industry, so the assertion must move to a synthetic
  empty-industry manifest (the synthetic rights-guard tests beside it are the pattern). Called out
  here so the plan handles it explicitly rather than discovering it at gate time.
- **Script:** unit-test the pure functions (type→industry mapping incl. upholstery re-route,
  rightsBasis assignment by vendor, idempotency predicate, dry-run size estimator) with fixture JSON;
  no network in tests.
- **Gate:** `npm run type-check && npm run lint && npm test`. No MCP tool is added — the
  tool-registry contract tests (unit + sandbox, count 24) are untouched.

## 10. Contract impacts checked

- `generate_image` / `generate_video`: no schema change (`referenceSet` stays `z.string()`); the
  `industry/subject` syntax is resolver-internal.
- Bundled manifest: grows to ~180 subjects — a few hundred KB of JSON in the function bundle,
  negligible. Images stay CDN-served (never bundled) `[VERIFIED — how prod works today]`.
- `visual-content-brief` / `grounded-visuals` skills: benefit automatically; `grounded-visuals`
  (separate spec) should mention `industry/subject` precision once this lands.

## 11. Verification runbook

1. `npx tsx scripts/ingest-ccw-catalogue.ts --dry-run` → paste the report (counts per industry /
   vendor / rightsBasis, size estimate, skipped + unmapped).
2. Real run → `git status` shows only `public/reference-library/**`; spot-open 3 images.
3. Full gate green; commit; PR (auto-merge → deploy).
4. Post-deploy: `list_reference_sets` on prod shows the CCW subjects with vendor provenance.
5. **Proof generation:** `generate_image` with `referenceSet:'water-damage-restoration'`, prompt
   "Razorback axial air mover drying a water-damaged room" → `grounded:true`, and the output shows
   the actual red Razorback air mover — the first-ever grounded water-damage generation.

## 12. Acceptance criteria

1. Dry-run report matches §2 magnitudes (≈166 equipment products; tile&grout/aircon skipped; zero
   silent unmapped).
2. Every ingested subject has `rights:"owned"` + a complete provenance block with the correct
   `rightsBasis` by vendor.
3. `water-damage-restoration` gains ≥ 70 owned images; carpet-cleaning gains ≥ 50; upholstery gains
   every title-matched tool.
4. Resolver: explicit `industry/subject` works; prompt-scored selection works; default behaviour
   for existing callers is byte-identical (first-subject fallback).
5. Re-running the script is a no-op (idempotent); `--dry-run` performs zero writes/downloads.
6. Full gate green; the §11 prod proof generation succeeds.

## 13. Out of scope / named follow-ons

- Chemicals, meters, parts, tile & grout (needs a `hard-floor-cleaning` industry decision), aircon.
- Auto-refresh (cron/webhook against Shopify) — v1 is manual re-run.
- Object-storage migration if the corpus outgrows the repo.
- **LoRA fine-tune** on the owned corpus — the literal "lots of training", next after this lands.
- **Clay-render style treatment** — a _generation-time style_, not a data concern: grounded identity
  (this corpus) + a clay/claymation style token in the prompt (FLUX handles it) belongs in the
  `grounded-visuals` skill as a style option. Noted here so it isn't conflated with ingestion.
