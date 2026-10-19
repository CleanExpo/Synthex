---
name: shortform-video-harness
description: >-
  Entry point and n8n-style map for producing a viral short-form or social video in Synthex
  (Reels, TikTok, Shorts, Facebook Reels, LinkedIn video, explainers, did-you-knows,
  before/afters, talking heads, faceless). Use whenever a request, spec (/spm) or goal involves
  making, planning, repurposing or measuring a social video for a Unite Group business or
  client. Loads harness.json: 19 nodes from intake to measurement, each naming the skills to
  load, the real tool or code entry point, inputs/outputs, gates, spend class, human stops,
  live/gap status and what to build where a gap exists.
metadata:
  author: synthex
  version: 1.0.0
  type: harness
  harness: harness.json
  triggers: [viral video, short-form, reel, tiktok, youtube shorts, social video, explainer video, faceless video, repurpose video]
---

# Short-form video harness

`harness.json` (this folder) is the source of truth. This file says how to use it.
Validate before trusting it: `python3 -I validate_harness.py <repo root>` exits non-zero if any
node points at a skill, file or binary that no longer exists.

## How an agent runs it

1. **Load** `harness.json`. Walk nodes in `depends_on` order. For each node, load its `skills`
   (just-in-time, one at a time) and call its `tools`.
2. **Respect the node's controls**: `gate` must pass before the next node; `spend: expensive`
   needs Gate A passed and an explicit `--live --confirm-spend`; `human_gate: true` stops for a
   person. Nothing in this harness publishes on its own.
3. **Status decides the path**: `live` = call it; `partial` = call it plus the manual step in
   `build_hint`; `stub`/`gap` = use `fallback` if present, otherwise stop that branch and report
   the `build_hint` as the blocker. Never fake a gap node's output.
4. **Carry the evidence**: every node's output carries its source (tool result, file, URL) so
   Gate B and the human reviewer can check it.

## How /spm uses it

When `/spm` plans anything that matches `triggers` in `harness.json`, it should:
- use the nodes as the **existing capability inventory** (spec §6) instead of rediscovering it;
- use the node order as the **implementation sequence** skeleton (spec §17);
- turn every `gap`/`stub`/`partial` node on the path into an explicit scope item or risk, quoting
  its `build_hint`;
- keep every `human_gate` and `spend` control as an acceptance criterion.

## The graph at a glance

```text
N0 Intake ─► N1 Research ─► N2 Topic queue ─► N3 Angle+hook ─► N4 Gate A
                                                                 │
                    ┌────────────────────────────────────────────┘
                    ▼
                 N5 Script+facts ─► N6 Shot list ─► N7 Visuals ($$, human) ─┐
                    ├─► N8 Voiceover (partial) ──────────────────────────────┤
                    └─► N9 Music/SFX (stub) ─────────────────────────────────┤
                                                                             ▼
   N10 Assemble hero (partial) ─► N11 Captions+SRT (gap) ─► N12 Loudness ─► N13 QA ─► N14 Gate B
                                                                                        │
   N18 Measure ◄─ N17 Approve+publish (human) ◄─ N16 Post copy ◄─ N15 Derive cuts ◄─────┘
```

## Gaps to close (from harness.json, 2026-10-19)

| Node | Status | Build |
|---|---|---|
| N8 Voiceover | partial | `generate_voice` studio tool over `generateSpeech` |
| N9 Music/SFX | stub | Connect the Artlist MCP or a licensed library; voice-only is the fallback |
| N10 Assemble hero | partial | `compose_hero` studio tool (Remotion SocialReel / ffmpeg) |
| N11 Captions | gap | `media_transcribe` on the media worker (whisper.cpp) → word timestamps + SRT |
| N12 Loudness | partial | `loudnorm=I=-14:TP=-1` in the worker transcode |
| N18 Measure | partial | `performance_get_video_metrics` for skip rate, watch time, sends, engaged views |

## Converge, don't add

Five end-to-end faceless pipelines exist (brand-video, faceless-video, nexus-viral,
remotion-render-pipeline, production-pipeline). Viral shorts run through **nexus-viral-run + this
harness**. Do not start a sixth.

## Related skills

- `shortform-pattern-library`: measured 1M+ benchmarks and the craft gate (N3, N5, N13).
- `shortform-instagram`, `shortform-tiktok`, `shortform-facebook`, `shortform-youtube-shorts`,
  `shortform-linkedin`: platform rules (N3, N15, N16, N17).
- `nexus-viral-run`: the runner for N4–N15.
