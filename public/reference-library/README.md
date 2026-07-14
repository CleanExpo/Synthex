# Reference Image Library — Real Industry Training/Grounding Data

**Purpose:** first-party, real photographs of professional equipment and job sites,
used to **ground AI image generation on reality** instead of letting the model invent
artificial/synthetic-looking gear.

These are _reference-conditioning_ inputs — at generation time the matching photos are
fed to a reference-capable image model so the output resembles the **actual** tools and
work, not a hallucinated approximation. (This is grounding, not model retraining.)

> Machine-readable index: [`manifest.json`](./manifest.json) — the generation pipeline
> should read this to pick reference images by industry/subject.

## Industries

| Industry                              | Subject                                                                              | Images | Source                  | IICRC       |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ----------------------- | ----------- |
| Professional Carpet Cleaning          | Floor extraction wand (studio)                                                       | 18     | Owned equipment         | S100 / S700 |
| Professional Carpet Cleaning          | Hot-water extraction in action                                                       | 4      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | Rotary / orbital / CRB machines                                                      | 4      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | Truck-mount unit & hose run                                                          | 2      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | Pre-spray / solution application                                                     | 3      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | Carpet grooming                                                                      | 1      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | Cleaned carpet result                                                                | 2      | Owned job photos        | S100 / S700 |
| Professional Carpet Cleaning          | CCW catalogue equipment (55 products)                                                | 122    | CCW Shopify (licensed)  | S100 / S700 |
| Professional Upholstery Cleaning      | Clear-head hand tool                                                                 | 6      | Owned equipment         | S300        |
| Professional Upholstery Cleaning      | CCW catalogue tools (2 products)                                                     | 2      | CCW Shopify (licensed)  | S300        |
| Professional Water Damage Restoration | CCW catalogue equipment (78 products — air movers, dehumidifiers, specialist drying) | 139    | CCW Shopify (licensed)  | S500 / S520 |
| Professional Water Damage Restoration | Job-site photos                                                                      | 0      | _awaiting owned photos_ | S500 / S520 |

**Totals: 143 subjects, 310 images** (9 first-party subject groups + 135 CCW catalogue products,
ingested 2026-07-11 by `scripts/ingest-ccw-catalogue.ts` — every CCW subject carries full
provenance: vendor, source URL, per-image sha256, rights basis. See the manifest.)

### `carpet-cleaning/`

Full-length professional carpet cleaning wand — red aluminium pole, black T-grip trigger,
VPRO-style dual-jet valve, stainless glide head with clear inspection window. Multiple
angles + valve/head detail, on commercial cut-pile carpet.
`carpet-cleaning-wand-01.webp` … `carpet-cleaning-wand-18.webp`

Plus **first-party job-site photos** (Unite Group's own carpet-cleaning jobs, owner's iCloud
album) grounding the real work, not just studio equipment — grouped by subject:

- `carpet-cleaning-extraction-01..04.webp` — wand mid hot-water-extraction on residential carpet.
- `carpet-cleaning-rotary-01..04.webp` — rotary / orbital / counter-rotating-brush agitation machines.
- `carpet-cleaning-truckmount-01..02.webp` — truck-mount plant: hose connection + exterior hose run.
- `carpet-cleaning-solution-01..03.webp` — pre-spray / cleaning-solution application (torso/hands only).
- `carpet-cleaning-grooming-01.webp` — carpet groomer finishing the pile.
- `carpet-cleaning-result-01..02.webp` — freshly cleaned carpet results.

### `upholstery-cleaning/`

Professional upholstery / hand extraction tool — black handle, stainless barrel, brass
quick-connect valve block, transparent acrylic spray-suction head. Multiple angles.
`upholstery-hand-tool-01.webp` … `upholstery-hand-tool-06.webp`

### `water-damage-restoration/`

Empty — see the folder's own note. The two candidate images supplied were screenshots of
a **third party's** social-media reel and were excluded (copyright/attribution risk).
Drop your **own** job-site photos here to ground this vertical.

## How to add more

1. Put web-format images (`.webp` preferred, max ~2048px) in the matching industry folder.
2. Name them `<industry>-<subject>-NN.webp` (zero-padded, sequential).
3. Add the entry to [`manifest.json`](./manifest.json) under the right `industry → subject`.
4. Use **owned** photos, or images you have explicit rights to. No third-party social
   screenshots — they carry copyright risk and teach the model someone else's brand/work.

## Recommended reference-capable models (mid-2026)

Wiring these as reference inputs is a separate follow-up step (not yet built):

- **FLUX.2 Pro** — best for brand/product consistency (holds metal/glass/colour).
- **Nano Banana Pro** (Google Gemini) — elite identity consistency; same provider family
  Synthex already calls (`gemini-2.5-flash-image` → upgrade path).
- **GPT Image 2** (OpenAI) — strongest when machinery/text must be "understood".

_Last updated: 2026-07-11._
