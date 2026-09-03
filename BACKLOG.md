# BACKLOG.md — the single queue (take the top unblocked item; add discoveries at the bottom)

Owner key: F = founder-only · A = agents · A→F = agents prepare, founder approves/sends

Established by the Synthex First Ship Directive (2026-09-03): _"Ideas go to `BACKLOG.md` in one
line."_ Rule 1 — the campaign pulls the feature. Nothing here is worked until a campaign in
flight is blocked without it. Mirrors the shape of `CARSI/BACKLOG.md`.

| #   | Item                                                                                                                                                                                                                     | Owner | Gate       | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | ------ |
| 1   | Quality gate has never fired — no test under `tests/`, both runs 95/100; needs a bad fixture before it counts as a gate (rule 6)                                                                                         | A     | Campaign 1 | open   |
| 2   | No founder-readable review packet format exists — `publishing-handoff.md` is 15 internal slugs                                                                                                                           | A     | Campaign 1 | open   |
| 3   | `publish_authority: founder_only` is directive language with zero implementation in any tree                                                                                                                             | A     | Campaign 1 | open   |
| 4   | Done-contract verifiers absent: `scripts/verify/golden-path-live.ts`, `studio-client-config.mjs` — block g1/g4/g5/g6/g8                                                                                                  | A     | —          | open   |
| 5   | Studio HeyGen/ElevenLabs per-business IDs are placeholders in production (g8) — any render calls a non-existent avatar                                                                                                   | A→F   | —          | open   |
| 6   | `docs/marketing-agency/IMPLEMENTATION-STATUS.md` falsified — claims Node v26.0.0, actual v24.14.1 vs `"node":"22.x"`; stale since 2026-05-16                                                                             | A     | —          | open   |
| 7   | `components/RichTextEditor.tsx` + its `@tiptap/*` runtime deps are dead code — imported nowhere, in no bundle                                                                                                            | A     | —          | open   |
| 8   | Golden-path Done contract `w_23150fa80a59` parked — publishing machinery, deferred under rule 2                                                                                                                          | A     | —          | parked |
| 9   | Local `main` in the shared checkout is 13 days stale — `53113c31e` (21 Aug) vs `origin/main` `c8b6647cb` (3 Sep)                                                                                                         | A     | —          | open   |
| 10  | Two launchd agents failing: `com.hermes.empire.cron-tick` exit 126 (not executable), `ai.hermes.gateway-dr` exit 78                                                                                                      | A     | —          | open   |
| 11  | 20+ orphaned `plaud-mcp` node processes accumulated since 21 Aug                                                                                                                                                         | A     | —          | open   |
| 12  | `senior-harness` in `~/.claude/skills` is a symlink to the **retired canonical** lineage on Storage Unit, not `main`; `senior-harness-control` is a newer real dir. No harness hook is registered — enforcement unproven | A→F   | —          | open   |
| 13  | 33 scratch worktrees on Storage Unit at stale HEADs, 5 locked — candidates for `git worktree prune` after owner check                                                                                                    | A     | —          | open   |
| 14  | RestoreAssist First Revenue Directive cites `~/RestoreAssist/RESTOREASSIST_FIRST_REVENUE_DIRECTIVE.md`, which does not exist — Linear holds the only live copy                                                           | F     | —          | open   |
