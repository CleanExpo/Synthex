# Obsidian Source Map — `/Users/phillmcgurk/2nd-brain/`

> Status: ✅ `VERIFIED` — built from a full filesystem scan on 2026-05-29.
> Method: `find`/`grep` over the vault excluding `.obsidian/`. No content invented.

## Vault identity

- **Type:** Shape Up "shaping vault" (Sketch → Grill → Pitch → Decision → Outcome flow).
- **Purpose (per its own `CLAUDE.md`):** Unite-Group Nexus product shaping, *not* an SEO research vault.
- **Also a git repo.** Agents + humans read/write the same files.
- **Total notes:** 224 markdown files (+ a few YAML/JSON in `Decisions/`).

## Folder breakdown (counts verified)

| Folder | Files | Purpose | SEO/AEO/GEO relevance |
|--------|-------|---------|----------------------|
| `Sources/` | 86 | Raw imported industry news (restoration, collision-repair, insurance, cyber). Read-only. | **Low** — domain news, no SEO strategy |
| `Outcomes/` | 129 | Daily Nexus briefs, `research-ingest/` scan logs, `synthex-content/` drafts | **Medium** — see below |
| `Decisions/` | 4 (+queues) | ADRs: `goals.yaml`, `objectives.yaml`, `risk_register.md`, `approvals_queue.md` | Governance only |
| `Pitches/` | 2 | Shape Up pitches incl. Nexus Growth OS v1 | The growth-loop architecture this system plugs into |
| `Sketches/` | 2 | Fat-marker component sketches | None |
| `Grills/` | 1 | `/grill-me` transcript | None |
| `Personas/` | 1 | `restoreassist.md` brand charter | Brand-voice input only |

## Where the SEO/AEO/GEO signal actually is

A precise word-boundary scan (not the naive substring counts) found:

- **`SEO`** — 3 genuine notes, all under `Outcomes/synthex-content/2026-05-27/` (a blog draft
  titled *"Content Operating System"*). This is the only first-party SEO strategy content in the vault.
- **`GEO`** — appears only as a `client_loops.loop_kind` **database enum value**
  (`'discovery' | 'content' | 'kpi' | 'geo' | 'support' | 'compliance'`) in
  `Pitches/03-nexus-autonomous-onboarding-and-growth-os-v1.md`. This is *geographic/loop* GEO,
  **not** Generative Engine Optimisation. Do not treat as SEO content.
- **`AEO`** — 0 notes.
- **`AEI`** — 0 genuine word-boundary hits. **`AEI` interpretation:** no source context exists in the
  vault to disambiguate it. Per the master prompt's instruction, it is left `DATA_REQUIRED`; the
  working interpretation adopted across this system is **AEO/GEO (Answer/Generative Engine
  Optimisation)** until a source defines otherwise.
- **"E-E-A-T" (104 raw hits)** — **artifact, not signal.** These are automated `research-ingest`
  scan logs that contain the literal search query string
  `"arXiv search engine optimization generative AI E-E-A-T"` (many ending in `timeout` / `HTTP 429`).
  They prove a research-ingest pipeline runs, but contain **no usable SEO findings**.

## Relevant non-SEO infrastructure discovered (load-bearing for this system)

These are the real hooks the marketing-intelligence loop should integrate with:

1. **`Outcomes/research-ingest/`** — the Nexus Discovery loop writes timestamped `*-scan.md`
   files here. This is the closest existing analogue to a research pipeline and is where future
   YouTube/SEO ingestion output should land.
2. **`Outcomes/synthex-content/`** — generated content drafts + publish packets. The refresh
   roadmap's output should land here for human approval before publishing.
3. **`Pitches/03-nexus-autonomous-onboarding-and-growth-os-v1.md`** — defines the per-client
   `client_loops` (incl. a `geo` loop), the **approval-gate matrix**, and the audit-ledger pattern.
   The marketing-intelligence loop is a *new `loop_kind`* under this existing architecture.
4. **`Decisions/approvals_queue.md` + the §6 approval matrix in pitch 03** — the canonical
   human-approval mechanism reused by [human-approval-gates.md](human-approval-gates.md).

## What is NOT in the vault (→ `DATA_REQUIRED`)

- ❌ Any YouTube channel reference or URL.
- ❌ Any Neil Patel / NP Digital reference.
- ❌ Any GSC / Semrush / Google Analytics export.
- ❌ Any keyword matrix, content matrix, or site audit document.
- ❌ Any per-site page inventory.

See [youtube-channel-source-list.md](youtube-channel-source-list.md) for how to supply the missing
channel data, and [site-page-inventory.md](site-page-inventory.md) for the page-inventory data gate.
