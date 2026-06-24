# Synthex Productivity Source Registry

Status: active planning source map
Created: 24/06/2026
Scope: Synthex productivity intelligence, marketing intelligence, YouTube transcript research, and Obsidian/wiki inputs.

## Purpose

Synthex agents previously treated YouTube intelligence as `DATA_REQUIRED` because the scan only looked at `/Users/phillmcgurk/2nd-brain/`. The latest YouTube transcript notes are present in the imported Unite-Group brain, so future agents must search both roots before declaring research missing.

This registry prevents false-negative source discovery and keeps raw transcript material out of the Synthex repo.

## Source roots

| Root                                                                     | Status                                      | Use                                                                       | Rule                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/Users/phillmcgurk/2nd-brain/`                                          | Canonical operating brain                   | Current Nexus/Unite-Group Sources, Sketches, Pitches, Decisions, Outcomes | Search first for canonical decisions and current operating context                                               |
| `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Sources/Completed/` | Imported YouTube/transcript research source | Recently loaded YouTube notes and completed transcript imports            | Search before marking YouTube research `DATA_REQUIRED`; reference in place, do not copy raw transcripts          |
| `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Wiki/`              | Existing product wiki                       | Synthex wiki pages, prior Board directives, historical decisions          | Use for cross-links and historical context; verify live repo state before treating as current production truth   |
| `/Users/phillmcgurk/Synthex/docs/marketing-intelligence/`                | Synthex marketing-intelligence outputs      | Prior source maps, scoring models, claim ledgers, human approval gates    | Treat older "zero YouTube sources" statements as point-in-time, superseded by this registry for source discovery |

## Required source-discovery sequence

Before any future Synthex research or productivity plan claims a source is missing:

1. Search `/Users/phillmcgurk/2nd-brain/`.
2. Search `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Sources/Completed/`.
3. Search `/Users/phillmcgurk/Unite-Group/docs/brain/2nd Brain/Wiki/` for prior decisions.
4. Search the Synthex repo for current implementation/docs.
5. Only then mark a data point `DATA_REQUIRED`.

## Source confidence labels

| Label                    | Meaning                                                                    | Allowed action                               |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------- |
| `VERIFIED`               | Current repo/source file was inspected and supports the claim              | May influence planning and implementation    |
| `OPINION_SOURCE`         | YouTube/influencer/operator claim; useful but not independently verified   | May seed hypotheses; must not auto-execute   |
| `HYPOTHESIS_FOR_TESTING` | Plausible tactic from research but not proven by Synthex/first-party data  | May enter backlog behind validation gate     |
| `DATA_REQUIRED`          | Required primary data is still absent after both source roots are searched | Block execution; add a data-gathering task   |
| `STALE_POINT_IN_TIME`    | Previously true scan/report that may have been superseded                  | Use only with date and recheck before acting |

## High-value imported notes to consider

- `Stop Vibe Coding, Start Agentic Engineering – Micky.md`
- `Build Agents That Run for Hours (Without Losing the Plot) — Ash Prabaker & Andrew Wilson, Anthropic.md`
- `handoff is my new favourite skill.md`
- `How to Use /goal to Build a Self-Improving OS.md`
- `The Old SEO System Is Collapsing. Here's What Replaces It..md`
- `Real Strategies to Create Quality Content at Scale With AI.md`
- `This AI Tool Maps Any Codebase Before You Touch It (Understand-Anything).md`
- `I stopped using /grill-me for coding. Here’s what I use instead.md`
- `8 Critical Questions To Stop Your AI Agents From Lying To You.md`

## No-copy rule

Raw transcripts remain in the brain/wiki source roots. Synthex stores summaries, claims, ledgers, source references, and implementation plans only.
