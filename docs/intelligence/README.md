# Synthex intelligence: where the research lives

Research that Synthex agents should draw on before designing or building: what Synthex is today, the agencies and platforms it is measured against, how other systems automate, the current model docs, and market signals. It was compiled on 22/10/2026 and is kept outside this repo so the repo does not carry it twice.

## Where it is

| Who | Where |
|---|---|
| Agents with the `second-brain` MCP server | Tools `unite_group_search`, `unite_group_find_similar`, `unite_group_stats` (registered for Claude Code at user scope on the Mac Mini, 22/10/2026) |
| Agents with file access on the Mac Mini | `/Users/phill-mac/2nd Brain/Wiki/synthex-intelligence/` (read `index.md` first) |
| Anyone with GitHub access | `CleanExpo/brain-1`, folder `Wiki/synthex-intelligence/` |
| Humans in Obsidian | `Wiki/synthex-intelligence` (a link to the same folder) |

## The pages

| Page | What it answers |
|---|---|
| `synthex-intel-00-hub` | Start here: the five quadrants and what to do about them |
| `synthex-intel-01-synthex-as-built` | What Synthex does today, from the code: capabilities, fleet, integrations, gaps, unfinished branches |
| `synthex-intel-02-agency-groups` | WPP, Publicis, Omnicom, Dentsu, Havas, Accenture Song, Monks and Stagwell reverse-engineered; what an autonomous agency can and cannot do better |
| `synthex-intel-03-ai-marketing-platforms` | AI marketing platforms by category, and build, buy or call for each marketing function |
| `synthex-intel-04-automation-stacks` | n8n, Replit, Higgsfield, the "Atlas" products and agent frameworks; ten patterns to adopt and the anti-patterns |
| `synthex-intel-05-llm-vendor-docs-2026-10` | Current model IDs, prices, shutdowns and API changes from vendor docs, with a model-routing table |
| `synthex-intel-06-trends-and-signals` | AI marketing trends, Australian rules, what is overhyped, and a 34-source tracking list |
| `synthex-intel-07-advantages-and-proposals` | Eleven ranked proposals for Synthex |

## How to use it without bloating context

- Search for the section you need and read only that section. Do not load whole pages into a prompt.
- Dated facts (model IDs, prices, shutdown dates) are true as of each page's `updated:` date. Open the linked vendor page before relying on one.
- Write results and lessons to the vault's `Outcomes/`, not into these pages.

## Known gaps in reach (22/10/2026)

- Fleet runs use `--bare` with a pinned MCP allow-list, so fleet agents see `second-brain` only once that allow-list names it. That list is a protected fleet file.
- Margot's corpus does not hold these pages yet: the Gemini key with access to its store is not in the live environment.

## Specs built on this research

`docs/superpowers/specs/2026-10-22-missing-pieces-goals.md` lists the specs and their goals.
