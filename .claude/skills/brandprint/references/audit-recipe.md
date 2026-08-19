# Brand Audit Recipe — "Brand Systems Analyst"

Run this BEFORE building any brand-config entry. The audit is what stops the
brandprint being "a little bit off": it separates what the assets actually
prove from what you guessed.

## Inputs

Collect the client's assets into one folder (or confirm access to them):

- Logo files, every variant (full, icon, inverted, mono)
- Font files (`.woff2`/`.otf`/`.ttf`) or named licensed fonts
- Brand guidelines (PDF or doc) if they exist
- Existing collateral: PowerPoints, Word documents, invoices, letterheads —
  these carry the client's real layout structure, pull it out of them
- Their live website URL and/or codebase, if any

## The audit prompt

Act as a **brand systems analyst**. Audit the brand assets in `<folder>` and
produce a brand specification precise enough that another AI could apply this
brand without ever seeing the original assets.

## Extraction — if the client has a website or codebase

Real tokens beat eyeballed ones. Before manual extraction:

- **Codebase available:** run `/impeccable document` (or `extract`) against it
  — pulls committed colours, fonts, spacing, and components from the code.
  Everything it finds in real tokens is `[VERIFIED]`.
- **Live site only:** inspect computed styles for the palette and font stack;
  values read from the live site are `[VERIFIED]`, but note the source since
  live sites can drift from guidelines.

## Output contract

The audit document must contain, in order:

### 1. Asset inventory

Every file found: filename, what it is, format, and variant coverage (e.g.
"logo: full-colour + white, NO icon-only variant found").

### 2. Colour palette

Each colour: hex value, role (primary / secondary / accent / neutral /
semantic), where it was found, and **safe pairings** (which foreground goes
on which background — from guidelines if stated, contrast-checked if not).

### 3. Typography

Font families with weights, the hierarchy (display / heading / body / mono),
file coverage (which weights have actual font files), and licensed-fallback
rules if files are missing.

### 4. Logo rules

Variants, clear-space / safe-area requirements, minimum sizes, forbidden
treatments (stretching, recolouring, effects).

### 5. Layout structure

Grid, margins, and document structure pulled from existing collateral
(decks and documents reveal how the brand actually composes a page).

### 6. Voice

Tone words, forbidden words/phrases, cadence — from guidelines or inferred
from existing copy.

## Evidence tags — mandatory on every value

| Tag          | Meaning                                                     | Action                         |
| ------------ | ----------------------------------------------------------- | ------------------------------ |
| `[VERIFIED]` | Stated in guidelines or extracted from an actual file/token | Usable as-is                   |
| `[INFERRED]` | Deduced (e.g. sampled from a JPEG, guessed pairing)         | Must be confirmed before build |
| `[MISSING]`  | The brand needs it but no asset defines it                  | Must be asked                  |

An untagged value is a defect (`.claude/rules/fabel-evidence-standard.md`).
JPEG/PNG colour sampling is always `[INFERRED]` — compression shifts hex
values.

### 7. Questions for the founder/client

End with a numbered list covering every `[INFERRED]` and `[MISSING]` item.
**The build recipe must not run until every question is answered and the
audit corrected.** Building on unconfirmed values produces outputs that are
subtly wrong everywhere, which is worse than obviously wrong once.

## Handoff

Save the corrected audit as the brand specification, then proceed to
[build-recipe.md](build-recipe.md).
