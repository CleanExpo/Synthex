# Design Spec — CCW Catalogue Ingestion into the Owned Reference Library (slice 1) — v2

- **Date:** 2026-07-11 (v2 — amended after a 3-lens adversarial review: 33 findings folded, 5 critical)
- **Status:** Approved design (founder pre-approved); spec for implementation planning
- **Type:** Ingestion script + resolver enhancement + lineage plumbing + manifest schema extension.
  **No DB migration, no new MCP tool, no Zod schema change.**
- **Builds on:** the prod-verified grounding foundation (`public/reference-library/` + bundled
  `manifest.json` + `lib/services/ai/reference-library.ts` + `generate_image(referenceSet)`).
- **Evidence tags:** `[VERIFIED]` = measured/read this session; `[ASSERTED]` = founder-supplied fact;
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
same corpus is the natural follow-on once the corpus exists — §14).

## 2. Verified catalogue facts `[VERIFIED 2026-07-11]`

Measured live from `https://www.ccwonline.com.au/products.json` (public Shopify endpoint, paginated
`?limit=250&page=N`, terminates on an empty page):

| Fact                                | Value                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total products                      | **1,744** (7 pages)                                                                                                                                     |
| Structured fields per product       | `title`, `handle`, `vendor`, `product_type`, `images[] {id, position, src, width, height}`, `body_html`, `tags`                                         |
| Equipment-classified products       | **≈166** = **≈135 mapped/ingestable** + **≈30 skipped** (tile & grout 24, aircon 6) — see §5 arithmetic                                                 |
| Ingestable images at ≤4/product cap | **≈280–348**                                                                                                                                            |
| CCW own-brand vendors               | `Carpet Cleaners Warehouse` (59), `Razorback` (49), `Razorback Sandia` (16)                                                                             |
| Largest reseller vendors            | Hydroforce (264), Actichem (179), Hydramaster (111), Tramex (81), Bridgepoint (74), Sapphire Scientific (31), Phoenix Restoration (30), Dri-eaz (29), … |
| Image hosting                       | Shopify CDN (`cdn.shopify.com`), size-suffix variants (e.g. `_2048x2048`, fit-within-box, returns original when smaller)                                |

## 3. Decisions locked

| #   | Decision                   | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Rights                     | **Entire catalogue ingested as `rights:"owned"`.** `[ASSERTED]` The founder states CCW has confirmed supplier AI-training/redistribution rights (recorded 2026-07-11; `rightsAssertionRef` in §6 points at this spec §3-C1 as the durable record until a Linear/document ref replaces it). Every entry carries machine-readable **provenance** (vendor key, per-image source URL + hash, rights basis enum) so any supplier's images AND artefacts generated from them can be located, re-tagged, or removed (§8 audit contract). The agent flagged the reseller-rights risk twice; the founder holds the CCW agreements and made the call. |
| C2  | Placement                  | Map equipment into the **existing industries** (`carpet-cleaning`, `upholstery-cleaning`, `water-damage-restoration`). Non-fitting categories (tile & grout, aircon cleaning) are **skipped and reported**, never force-fitted (§5).                                                                                                                                                                                                                                                                                                                                                                                                        |
| C3  | Scope                      | **Equipment only.** Chemicals (`* CHEM *`), meters/instruments, parts (`IMP PART *`), misc types excluded in v1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| C4  | Mechanism                  | A **repeatable Node script** (`scripts/ingest-ccw-catalogue.ts`, run via `npx tsx`) with `--dry-run`, drift-aware idempotency, a runtime-enforced size guard, and first-class **removal/re-tag** modes. Run manually; output committed. No cron in v1.                                                                                                                                                                                                                                                                                                                                                                                      |
| C5  | Identity coherence         | Grounding references must depict **one subject** per generation. The resolver gains **subject-level selection** (§7), never blind cross-subject aggregation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| C6  | Lineage (new, from review) | Grounding lineage must be **queryable after the fact**: generation results carry `{subject, vendor, imagePaths}`, and the video row's persisted `inputImageUrl` (already stored) encodes the subject file — one documented query enumerates artefacts grounded on any vendor (§8).                                                                                                                                                                                                                                                                                                                                                          |

## 4. Architecture

```
ccwonline.com.au/products.json (paginated, retry w/ backoff)
        │  filter: equipment allowlist (§5) + committed denylist (§6.7)
        ▼
scripts/ingest-ccw-catalogue.ts        [pure functions in scripts/lib/ccw-ingest-core.ts]
        │  per image: download tmp → sharp decode(integrity)+webp → atomic rename
        │  per product: ALL-or-nothing; manifest written ONCE at end (tmp+rename)
        ▼
public/reference-library/<industry>/ccw-<handle>-<imageId>.webp
        +
public/reference-library/manifest.json  (subject per product; provenance + per-image lineage)
        ▼  (bundled at build — Vercel-safe per the shipped manifest-bundle fix)
lib/services/ai/reference-library.ts    (subject-aware resolution §7; vendor/rightsBasis surfaced)
        ▼
generate_image / generate_video  → results carry {grounded, referenceSet, subject, vendor}
```

## 5. Equipment allowlist — `product_type` → industry `[VERIFIED types]`

**Arithmetic (binding for AC1):** equipment-classified ≈166 = **mapped ≈135** (ingested) +
**skipped ≈30** (tile & grout ≈24, aircon ≈6). Manifest grows from 9 subjects to **≈145**.

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

**Secondary routing:** any allowlisted product whose title contains `upholstery`
(case-insensitive) re-routes to `upholstery-cleaning`. The dry-run report prints the re-routed
handle list + count N (AC3 checks exactly N new upholstery subjects). Route flips ARE handled —
the ingest reconciles them: the stale key is removed from the old industry, the old industry's
files are deleted, and the product is re-ingested under the new route
(`reconcileProduct`/`staleFilesFor` in the core module, §6.5).

**Unmapped-type rule:** any product whose type is in neither list is counted and printed
(`unmapped: {type: count}`) — silent drops forbidden. The mapping table is data at the top of the
core module, trivially extendable.

## 6. Ingestion script — `scripts/ingest-ccw-catalogue.ts` (+ `scripts/lib/ccw-ingest-core.ts`)

Pure logic (mapping, naming, rights, idempotency, merge, estimates) lives in the **core module**
with unit tests; the CLI wrapper does I/O only. `sharp` is promoted to an **explicit
devDependency** (currently only transitive via next `[VERIFIED npm ls]`; reason: script-time image
processing; zero prod-bundle impact).

1. **Fetch:** paginate `products.json?limit=250&page=N` until an empty page. Bounded retry with
   exponential backoff (3 attempts) on 429/5xx for BOTH page fetches and CDN image downloads; a page
   that still fails → exit 1, zero writes.
2. **Select:** §5 allowlist → §6.7 denylist → cap **4 images/product** by Shopify `position`
   (primary first).
3. **Download + process (per image):** fetch the `_2048x2048` CDN variant to a **temp path**;
   integrity check = sharp successfully decodes it; convert → webp q90, long edge ≤2048; **atomic
   rename** into place. Manifest `width`/`height` are **sharp's output metadata** (never the
   Shopify JSON dims, never 2048×2048 assumptions).
4. **All-or-nothing per product:** a subject is written only if EVERY selected image succeeded.
   Any image failure → the whole product is skipped and listed in the run report; run exits non-zero
   (code 2) if any product was skipped this way. Aborted runs leave only orphan files (no manifest
   entry) — reported by the orphan check (§6.6) and overwritten on the next run.
5. **Drift-aware idempotency:** each manifest image records its Shopify image `id` + source `src`.
   A product is skipped iff its subject exists AND the fresh fetch's selected image-id list equals
   the stored list AND all files exist. Any mismatch (replaced/reordered/added/removed images) →
   re-ingest the product and delete de-referenced `ccw-<handle>-*` files. `ingestedAt` is preserved
   for unchanged subjects — a stable re-run produces **zero manifest diff** (AC5). Products present
   in the manifest but gone from the catalogue are listed in a **stale report** (report-only in v1).
6. **Filenames:** `ccw-<handle>-<shopifyImageId>.webp` — stable across upstream reordering
   (position indices are merchant-editable; image ids are not). Dry-run flags selected images with
   extreme aspect ratios (>3:1 or <1:3 — likely spec charts/diagrams) for human spot-check; §11
   includes that spot-check before commit.
7. **Removal/re-tag (first-class, from review):** a committed `EXCLUDED_VENDORS` /
   `EXCLUDED_HANDLES` denylist at the top of the core module is honoured by every run — removed
   suppliers can never silently return. Modes: `--remove-vendor <vendorKey>` deletes that vendor's
   files AND manifest subjects atomically; `--retag-vendor <vendorKey> <rights>` rewrites their
   `rights` only. Removal contract: full removal = files + manifest entries + **redeploy**; git
   history retention and previously-issued immutable Vercel deployment URLs are **accepted
   limitations**, recorded here.
8. **Vendor normalisation:** `vendorKey` = trimmed, casefolded vendor string (rights assignment and
   all filters key on it); `vendorRaw` stored as received. Dry-run prints any vendorKey not seen in
   the existing manifest (new/renamed-vendor report) so a Shopify rename cannot silently fork a
   supplier's identity.
9. **`--dry-run` (mandatory first):** zero writes/downloads. Prints: products per industry / vendor
   / rightsBasis; upholstery re-route list; capped image count; size estimate (flat **≈0.25 MB/image**
   heuristic — stated as a heuristic, dims-independent); projected manifest.json size; skipped +
   unmapped + denylisted + stale + orphan + new-vendor + aspect-flag reports.
10. **Size guard (both phases):** dry-run estimate AND the real run's **cumulative actual bytes**
    are checked against **150 MB**; the real run aborts at the cap with a report of what was
    written. The git-history cost is a **one-way door** (history rewriting aside) — a reason the
    guard stays conservative; object storage is the named follow-on if the dry-run lands high.
11. **`--verify`:** re-hashes every manifest-listed file against its stored `contentHash` (sha256 of
    the processed webp) — the manifest is a self-verifying audit record.
12. **Flags:** `--force-refresh-handle <handle>` / `--force-refresh-vendor <vendorKey>` (two flags —
    the key spaces never share one positional argument).
13. **README:** the script prints a refreshed industries/subjects summary table for pasting into
    `public/reference-library/README.md` (human edit in v1).

**Manifest subject shape (per product):**

```jsonc
"ccw-razorback-aam-pro-axial-air-mover": {
  "rights": "owned",
  "label": "Razorback AAM Pro Axial Air Mover",
  "provenance": {
    "source": "ccw-shopify",
    "vendorKey": "razorback",
    "vendorRaw": "Razorback",
    "sourceUrl": "https://www.ccwonline.com.au/products/<handle>",
    "ingestedAt": "2026-07-11",
    "rightsBasis": "ccw-own-brand",          // closed enum — see below
    "rightsAssertionRef": "spec:2026-07-11-ccw-catalogue-ingest-design.md#3-C1"
  },
  "images": [
    {
      "file": "ccw-<handle>-98765.webp",
      "width": 1620, "height": 2048,          // sharp OUTPUT dims (non-square example deliberate)
      "source": "ccw-shopify",
      "imageId": 98765, "position": 1,
      "imageSrc": "https://cdn.shopify.com/.../file_2048x2048.jpg",
      "contentHash": "sha256:…"
    }
  ]
}
```

**`rightsBasis` is a closed enum** (TypeScript union in the manifest types):
`'ccw-own-brand'` (vendorKey ∈ {carpet cleaners warehouse, razorback, razorback sandia}) |
`'ccw-supplier-authorised'` (all other vendors; human wording lives in an optional `rightsNote`) |
`'first-party-photo'` (backfilled onto the 9 existing Unite-Group subjects in the same PR, so
absence-of-provenance never becomes an implicit third rights class). A unit test asserts every
written `rightsBasis` is drawn from the enum.

## 7. Resolver enhancement — subject-aware selection (`lib/services/ai/reference-library.ts`)

**Today** `resolveFromManifest` returns `owned[0]` only. With ~135 new subjects that leaves most
unreachable, and naive aggregation would hand FLUX a mixed bag of machines (identity smear — C5).

1. **`referenceSet` accepts `industry` or `industry/subject`** (split on the FIRST `/`; Shopify
   handles cannot contain `/` `[VERIFIED]`). Fail-closed on ALL malformed input: `''`, `'  '`,
   `'/'`, `'/industry'`, `'industry/'`, `'a/b/c'` → empty. **Empty-string set must remain
   fail-closed and must NOT fall through to prompt auto-detect** (preserves today's `if
(!industryKey)` behaviour). An explicit subject resolves ONLY if it passes the same
   owned-with-images filter (`ownedSubjects`) — a non-owned or image-less subject returns empty,
   never falls back to another subject.
2. **Industry-only resolution — precise scorer:** tokenise prompt AND each owned subject's
   `key`+`label` (lowercase, split on non-alphanumerics, drop tokens <3 chars, **unique** tokens);
   score = |prompt tokens ∩ subject tokens|. **Selection rule (two distinct cases):**
   - top score **> 0**, ties → **first of the TIED subjects** in manifest order (deterministic);
   - top score **= 0**, or no prompt → **first owned subject** in manifest order (today's exact
     behaviour — the regression invariant).
3. Images come from that **one** subject only; `max` unchanged (default 4).
4. `ResolvedReferences` gains `vendorKey?: string` and `rightsBasis?: string` (from the chosen
   subject's provenance; undefined for first-party subjects until backfill lands). `subject` (existing
   field) reports the chosen key.
5. **Manifest key order is load-bearing** for the fallback: the script's manifest merge
   read-modify-writes preserving existing industry/subject insertion order and **appends** new
   subjects after existing ones — never sorts, never regenerates. Regression test: after a synthetic
   ingest-merge, carpet-cleaning's first owned subject is still `carpet-cleaning-wand`.
6. **Auto-detect gate limitation `[VERIFIED industry-classifier.ts:36]`:** the coarse gate regex
   requires `water\s+damage` — `water-damaged` (hyphenated) does NOT pass, and
   flood/air-mover/dehumidifier vocabulary isn't in the gate. v1 fold: extend the gate to tolerate
   hyphenation (`water[-\s]+damage`) with a classifier test; broader vocabulary is a follow-on.
   Skills/callers targeting water-damage SHOULD pass an explicit `referenceSet`; §11's proof prompt
   uses gate-safe phrasing.
7. **Behavioural note (supersedes v1 AC4):** existing callers that pass set+prompt (both prod
   callers do `[VERIFIED image-generation.ts:449, generation-service.ts:42]`) will — intentionally —
   get best-match subjects post-ingest. The preserved invariant is: no-prompt or zero-score
   resolution returns the first owned subject, and the full pre-ingest test suite passes unchanged
   against the pre-ingest manifest.

## 8. Lineage & audit contract (new section, from review)

**Corpus-side:** every image carries `{vendorKey, imageSrc, imageId, contentHash}`; every subject
carries `{rightsBasis (enum), rightsAssertionRef, sourceUrl}`. One filter over `vendorKey` yields a
complete, disjoint partition of all `ccw-*` files (unit-tested: union of vendor-filtered file lists
== all written files, pairwise disjoint). `listReferenceSets()` surfaces `vendor?` **and**
`rightsBasis?` per subject so a prod spot-check can audit without reading the raw manifest.

**Artefact-side (C6):**

- `generateImage` results gain `referenceSubject?` and `referenceVendor?` beside the existing
  `referenceSet`/`refCount` (in-memory result; callers that persist assets SHOULD store them —
  the media-library persistence path for URL-only grounded results is a named follow-on).
- `submitGenerativeVideo` job tags gain `groundedSubject?`/`groundedVendor?`; the **persisted**
  `videoGeneration.inputImageUrl` already stores the seed file path, which embeds the subject
  handle — **documented audit query:** `SELECT id FROM video_generations WHERE input_image_url LIKE
'%/reference-library/%/ccw-<handle>-%'` unioned over a vendor's handles (from the manifest)
  enumerates every video grounded on that vendor. No schema change needed.
- **Removal runbook step (§11):** the removal drill exercises this end-to-end once.

## 9. Tests

- **Core module (fixture JSON, no network):** type→industry mapping incl. upholstery re-route;
  rightsBasis enum assignment via vendorKey normalisation (+ unknown-vendor → supplier-authorised);
  denylist filtering; drift-aware idempotency predicate (unchanged → skip; changed image ids →
  re-ingest + de-referenced file deletion list; corrupt/missing file → re-ingest); filename builder
  (handle + imageId); manifest merge preserves existing key order + appends (regression: first
  carpet subject stays `carpet-cleaning-wand`); size estimator; vendor partition
  (union==all, disjoint); stable re-run → zero manifest diff.
- **Resolver:** explicit `industry/subject` (owned → resolves; non-owned/empty → fail-closed);
  scorer picks the air-mover subject for an air-mover prompt among decoys; **non-zero tie → first
  tied subject** (test with two tied Razorback air movers); zero-score / no-prompt → first owned
  subject (regression pin); malformed set list from §7.1 incl. `''` not falling through to
  auto-detect; `vendorKey`/`rightsBasis` surfaced.
- **Classifier:** `water-damaged room` now passes the gate; unrelated prompts still don't.
- **Lineage:** image result carries `referenceSubject`/`referenceVendor`; video jobs carry
  `groundedSubject`/`groundedVendor`; `inputImageUrl` persisted (existing test extended).
- **⚠ At-risk existing tests (complete list, from review):** in
  `tests/unit/ai/reference-library.test.ts` — (1) the `water-damage-restoration` empty-set
  assertion (ingestion populates it → move to a synthetic manifest); (2) the auto-detect
  `count === 2` test (post-ingest scoring changes it → convert to synthetic manifest); (3) the
  `wand-01` first-image pin (protected by the key-order merge rule + its regression test).
- **Gate:** `npm run type-check && npm run lint && npm test`. No MCP tool added — tool-registry
  contract tests (unit + sandbox, 24) untouched.

## 10. Contract impacts checked

- `generate_image` / `generate_video`: **no Zod change** (`referenceSet` stays `z.string()`;
  `industry/subject` is resolver-internal). New result fields are additive.
- Bundled manifest: grows to **≈145 subjects**; projected JSON size printed at dry-run (est.
  300–500 KB per importing function — acceptable; confirmed at dry-run). Images stay CDN-served,
  never bundled `[VERIFIED — prod behaviour today]`.
- Git: 35–140 MB of webp enters history permanently (one-way door — §6.10 guard + object-storage
  follow-on).
- `grounded-visuals` skill (separate spec): gains `industry/subject` precision once this lands.

## 11. Verification runbook

1. `npx tsx scripts/ingest-ccw-catalogue.ts --dry-run` → **paste the report** (counts per
   industry/vendor/rightsBasis, upholstery re-routes, size + manifest estimates, skipped/unmapped/
   stale/orphan/new-vendor/aspect-flag lists).
2. Real run → `git status` shows only `public/reference-library/**`; **spot-check the aspect-flagged
   images** (drop chart-like images via `EXCLUDED_HANDLES` + re-run if needed); spot-open 3 normal
   images.
3. `--verify` passes (all hashes match). Stable re-run → zero diff.
4. Full gate green; commit; PR. **Human gate:** founder pre-approved this build (§3-C1) — the PR
   auto-merge is that approval landing; the founder's §11.6 confirmation closes the loop.
5. Post-deploy: `list_reference_sets` on prod shows the CCW subjects with vendor + rightsBasis.
6. **Proof generation (machine-checkable + human):** `generate_image` with
   `referenceSet:'water-damage-restoration'`, prompt "Razorback axial air mover drying out a room
   after water damage" (gate-safe phrasing) → assert `grounded:true` AND `referenceSubject` is the
   Razorback air-mover subject AND reference paths point at new CCW files. Founder eyeballs the
   output ("reply looks good" — verification-gate style); grounding conditions the model, it cannot
   guarantee pixel fidelity, so the visual check is the founder's call, not an automated assert.
7. **Removal drill (once, from review):** pick one reseller vendorKey → `--remove-vendor` → zero
   remaining files/manifest entries for it (`--verify` + vendor filter) → run the §8 video audit
   query → restore via git revert of the drill commit. Proves the audit contract has run at least
   once.

## 12. Acceptance criteria (all machine-checkable except AC7's visual half)

1. Dry-run reports **120–150 ingestable** products; tile&grout ≈24 + aircon ≈6 skipped; unmapped
   list printed (may be non-empty, never silent); zero denylisted at v1.
2. Every ingested subject: `rights:"owned"` + complete provenance (vendorKey/vendorRaw/sourceUrl/
   ingestedAt/enum rightsBasis/rightsAssertionRef) + per-image `{imageId, imageSrc, contentHash}`.
3. Dry-run prints the upholstery re-route list (count N); post-run upholstery-cleaning has exactly
   N new CCW subjects. water-damage-restoration gains ≥ 60 owned images; carpet-cleaning ≥ 50.
4. Resolver: explicit `industry/subject` works (owned-only, fail-closed otherwise); non-zero-tie →
   first tied subject; zero-score/no-prompt → first owned subject; full PRE-ingest test suite passes
   unchanged against the pre-ingest manifest. (Set+prompt callers intentionally get best-match
   subjects post-ingest.)
5. Stable re-run: zero manifest diff, zero downloads. `--verify` green. Vendor partition test green.
6. Removal drill (§11.7) completes: vendor fully removed, audit query runs, drill reverted.
7. Full gate green; §11.6 proof generation asserts pass + founder visual confirmation.

## 13. Failure modes (explicit, from review)

| Failure                                         | Behaviour                                                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| products.json page 429/5xx                      | retry ×3 w/ backoff → still failing: exit 1, zero writes                                                                                     |
| Single image 404 / bad decode                   | whole product skipped (all-or-nothing), listed in report, exit code 2 at end                                                                 |
| Abort mid-run                                   | orphan files only (manifest untouched — written once at end via tmp+rename); orphans reported next dry-run and overwritten next run          |
| Corrupt file on disk                            | fails `--verify` hash; drift check re-ingests (idempotency compares image ids AND file existence; hash mismatch → re-ingest)                 |
| Vendor renamed upstream                         | new-vendor report at dry-run (vendorKey not previously seen)                                                                                 |
| Size cap hit mid-run                            | abort with written-so-far report                                                                                                             |
| Route flips between runs (title/mapping change) | detected via findSubjectIndustry; old-industry files deleted, stale manifest key removed, product re-ingested (exactly one ccw-<handle> key) |

## 14. Out of scope / named follow-ons

- Chemicals, meters, parts, tile & grout (needs a `hard-floor-cleaning` industry decision), aircon.
- Auto-refresh (cron/webhook) — v1 manual; stale report is the drift signal.
- Object-storage migration if the corpus outgrows the repo.
- Media-library persistence of image grounding lineage (URL-only grounded saves).
- Broader water-damage vocabulary in the coarse classifier gate (v1 adds hyphen tolerance only).
- **LoRA fine-tune** on the owned corpus — the literal "lots of training", next after this lands.
- **Clay-render style treatment** — a _generation-time style_, not a data concern: grounded identity
  (this corpus) + a clay/claymation style token in the prompt belongs in the `grounded-visuals`
  skill as a style option. Noted so it isn't conflated with ingestion.
