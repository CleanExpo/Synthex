---
phase: nexus-viral-productionise
workstream: WS1
plan: WS1
type: execute
baseline: origin/main @ f3fd9cf3
model: opus
title: nexus-viral-run - human-triggered orchestrator skill + thin driver
sequence_note: Lands AFTER WS3 (gates real) per spec section 8(5) defer-orchestrator
---

<objective>
Compose the 1->8 pipeline as a human-triggered agent session: brief -> Gate A ->
copy -> generate_video -> poll -> Gate B -> derive_cuts -> report. No daemon, no
publish primitives. Spec section 9 WS1, section 3 (WS1 gap), overnight rule: code
the live generate path, do NOT run it.
</objective>

<context>
@lib/services/ai/studio-tools/index.ts   # STUDIO_TOOLS / ALL_MCP_TOOLS + executeStudioTool: generate_video (line 206), get_job (line 245), derive_cuts (line 153, sets publishState queued_human_gated). Driver calls these via the MCP tool layer.
@lib/video/gates/index.ts                 # (WS3a) runBriefGrill = Gate A, runBroadcastGrill = Gate B
@lib/video/gates/assert-gate-passed.ts    # (WS3b) enforcer the driver honours between stages
@scripts/video-smoke-test.ts              # existing script harness pattern to model the driver
@.claude/skills/senior-copywriter/SKILL.md  # [UNCONFIRMED] spec names 'nexus-copywriter' agent - it does NOT exist. senior-copywriter DOES. WS1 either invokes senior-copywriter or authors a thin nexus-copywriter skill; do NOT reference a non-existent agent.

Constraint: human-triggered only; NO publish primitives (phase-1 boundary). Live generate_video is a documented STOP (draft-first-spend). jest.worktree mocked tools for the driver unit test.
</context>

<tasks>

<task type="auto">
  <name>Task 1: nexus-viral-run skill definition</name>
  <files>.claude/skills/nexus-viral-run/SKILL.md</files>
  <action>
Author the skill (SCREAMING-KEBAB naming for refs): stage sequence Stage1 brief (org data) -> Gate A (runBriefGrill, assertGatePassed 'brief') -> copy (senior-copywriter, or a thin nexus-copywriter authored here - resolve the [UNCONFIRMED] explicitly) -> generate_video (draft tier defaults 9:16/6s/1 variant) -> poll get_job -> Gate B (runBroadcastGrill, assertGatePassed 'broadcast') -> derive_cuts -> report. Document that the run is HUMAN-TRIGGERED and STOPS before any live generate spend; no publish step exists in this skill.
  </action>
  <verify>Skill file exists; every stage maps to a real tool/function cited above; explicit STOP at live generate; no publish primitive referenced.</verify>
  <done>Skill documents the 1->8 sequence over real tools with a live-spend STOP and no publish.</done>
</task>

<task type="auto">
  <name>Task 2: thin driver scripts/nexus-viral-run.ts</name>
  <files>scripts/nexus-viral-run.ts</files>
  <action>
Thin orchestration driver following scripts/video-smoke-test.ts: sequential stage calls with a gate check between each (call runBriefGrill then assertGatePassed before generate; runBroadcastGrill then assertGatePassed before derive_cuts). generate_video/get_job/derive_cuts go through executeStudioTool. A gate FAIL aborts the run and prints the blockedReasons - never proceeds to spend. Accept an injected tool executor + provider so a unit run is fully mocked (no MCP, no fal). Emit a structured report (stages, gate verdicts, job ids, cut refs). Guard the live generate call behind an explicit --live flag that defaults OFF; without it the driver dry-runs.
  </action>
  <verify>npx jest --config jest.worktree.cjs nexus-viral-run with mocked executor/provider: happy path threads all stages; Gate A FAIL aborts before generate_video is called; Gate B FAIL aborts before derive_cuts. No network. --live defaults off.</verify>
  <done>Driver composes stages, honours gates before spend, is fully mockable, and never publishes.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>GATE: live 1->8 draft-tier proof run (paid, human-watching)</name>
  <files>(none - live spend)</files>
  <action>
BLOCKING. The single live 1->8 run at draft tier (~$1.69 + renders, spec section 13) against prod is Phill's, executed WITH a human watching, via --live. The overnight agent MUST NOT run generate_video live. Record the run payloads to out/live-*.json.
  </action>
  <verify>Human confirms: one live draft run completed, both gates enforced live, cuts landed as queued_human_gated (inert, unpublished).</verify>
  <done>Human ack recorded; live proof owned by founder. Not automatable.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs nexus-viral-run - paste Tests: line
- [ ] Grep: driver contains NO publish_queue write / no seedPublishQueue / no pending transition
- [ ] --live flag defaults off; gate-fail-before-spend proven
</verification>

<success_criteria>

- A human triggers a full 1->8 run in one action (skill + driver).
- Gates enforced deterministically between stages before any spend (WS3b honoured).
- Phase-1 boundary preserved: no publish primitive; live generate is a human gate.
- section 15(7): gauntlet green.
  </success_criteria>

<output>
Write WS1-SUMMARY.md. Record the nexus-copywriter [UNCONFIRMED] resolution + the live-run human gate as OPEN.
</output>
