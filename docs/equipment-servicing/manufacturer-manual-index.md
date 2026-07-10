# Equipment Servicing — Manufacturer Manual Index (Internal)

> **Internal technician servicing reference only.** This file is a set of **pointers** to
> the manufacturers' own manual portals. It contains **no** manufacturer diagrams, manual
> text, or downloaded files.
>
> **Copyright:** All linked manuals, wiring diagrams, exploded parts diagrams and parts
> lists are © Legend Brands (Dri-Eaz) and © Therma-Stor / Phoenix Restoration Equipment.
> They are provided by the makers for owners/technicians to service their own units.
>
> **Usage boundary (agreed 2026-07-11):**
> - ✅ Open/reference these for servicing and technician training on units we own.
> - ❌ Do **not** copy the diagrams into the AI image/video **training set**
>   (`public/reference-library/`).
> - ❌ Do **not** reproduce the diagrams in published/marketing content.
> - For AI grounding and pull-apart videos, use our **own teardown photos/footage** of our
>   own units instead (clean rights + better quality). See "Own-teardown path" below.

---

## Official portals (authoritative — always check here for the latest revision)

| Maker | Portal | Notes |
| --- | --- | --- |
| Dri-Eaz (Legend Brands) | https://www.legendbrands.com/document-search | Search by model. Returns owner's manual, parts list, wiring diagram, quick-start per unit. |
| Phoenix (Therma-Stor) — current | https://usephoenix.com/resources/product-manuals/ | Current line-up manuals. |
| Phoenix (Therma-Stor) — discontinued/archived | https://usephoenix.com/resources/discontinued-product-manuals/ | Older units + archived-by-serial-number manuals. |

Each manual typically contains: specifications, **wiring/block diagram**, **service parts
list**, and service/troubleshooting steps. Dri-Eaz additionally exposes **exploded assembly
diagrams** per sub-assembly via the model's document page.

---

## Dri-Eaz (Legend Brands)

Search each model at the Legend Brands portal above.

**Refrigerant / LGR dehumidifiers**
- LGR 7000XLi · LGR 6500XLi · LGR 6000Li · LGR 5000Li · LGR 3500i · LGR 2800
- DrizAir 1200 · DrizAir 2400 · Revolution
- _(Each model page: Owner's Manual · Parts List · Wiring Diagram · exploded sub-assembly diagrams.)_

**Desiccant dehumidifiers**
- DriTec 150 · DriTec 325 · DriTec 4000i · DriTec Pro 150 / 150C

**Air movers**
- Velo · Velo Pro · Vortex · Ace · Air 400 HE _(confirm exact model names against the portal — Dri-Eaz air-mover naming varies by revision)_

**AFD / air scrubbers (HEPA)**
- DefendAir HEPA 500 · DefendAir HEPA 700

> Model list is indicative (compiled from the portal's document index). The portal is the
> source of truth — filter by the serial/model on the actual unit before ordering parts.

---

## Phoenix (Therma-Stor)

Sourced from the Phoenix portals (verified 2026-07-11).

**Refrigerant / LGR dehumidifiers (current)**
- DryMAX XL Pro · DryMAX BLE · DryMAX XL · R250 · 250 MAX

**Refrigerant / LGR dehumidifiers (discontinued/archived — by serial number)**
- DryMAX (LGR) · DryMAX BLE R410-A · R125 · R150 · R175 · R200 · 200 · 200 MAX · 200 HT
  · 270 HTx · 300 · 300 MAX · Arctic Max

**Desiccant dehumidifiers**
- D385 (current) · D850 · 4800 Electric Desiccant · 4800 Propane Desiccant · 1200 · 1800 DX
  _(D850 / 4800 / 1200 / 1800 under discontinued/archived)_

**Air movers**
- Focus II Axial (current) · AirMAX Radial (current) · AirMAX BLE Radial (current)
- Archived: FOCUS Axial · AAM Axial · Axial Air Mover · Stackable CAM / CAM Pro (centrifugal)

**AFD / air scrubbers (HEPA System)**
- Guardian R HEPA System (current) · Guardian HEPA · Guardian HEPA Portable · Mini-Guardian (archived)

> Archived manuals are indexed **by serial number** on the discontinued-products page — match
> the SN sticker on the unit (e.g. `TS-705`) to pull the right revision.

---

## Own-teardown path (for the AI grounding set + pull-apart videos)

To ground AI generation and produce servicing/pull-apart videos **without** using
manufacturer copyright, capture our own units. Suggested per-unit shot list:

1. Full unit — front, rear, both sides, top (clean, even light).
2. Covers off — each housing panel removed, laid beside the unit.
3. Core components in place — compressor, coils, blower/impeller, control board, pump,
   float switch, sensors (refrigerant units); desiccant wheel + reactivation heater
   (desiccant units); motor + impeller + capacitor (air movers); blower + HEPA/carbon
   filter stack (AFDs).
4. Each major part removed and shot alone on a plain background.
5. A short teardown video per unit (steady, well-lit) for the pull-apart training content.

Store these under `public/reference-library/<industry>/water-damage-restoration/…` (owned
imagery), and register them in `public/reference-library/manifest.json`. That keeps the
generation set 100% rights-clean.

_Last updated: 2026-07-11 · Phoenix lists verified from usephoenix.com portals; Dri-Eaz
model list indicative pending portal confirmation per model._
