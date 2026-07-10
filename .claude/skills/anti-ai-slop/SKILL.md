---
name: anti-ai-slop
description: >-
  Removes AI-slop from any writing before it ships — the tells that make text
  read as machine-generated: filler openers, hedge-everything qualifiers,
  rule-of-three padding, "it's not just X, it's Y" antithesis, em-dash abuse,
  empty transitions, and self-congratulatory adjectives. Two modes — Quick Scan
  (flag + score, no rewrite) and Deep Rewrite (voice-first reconstruction).
  Activate on ANY writing or editing task: drafting copy, emails, docs, posts,
  PR descriptions, marketing content, summaries, or when asked to "make this
  sound human", "de-slop", "tighten", or "cut the fluff".
metadata:
  author: synthex
  version: '1.0'
  scope: user-level
  type: writing-quality-gate
---

# anti-ai-slop

A quality gate for prose. It catches the mechanical tells of AI-generated text and forces writing back toward a specific human voice: concrete, load-bearing, and unafraid to make a plain claim.

Applies to all writing tasks by default. Do not wait to be asked — if you are producing prose a human will read, run the gate.

## Two modes

**Quick Scan** (default for short text, review requests, "does this read as AI?")

- Read the draft, flag every hit against the banned-phrases table and structural rules below.
- Return a slop score (0–100, lower is cleaner) and a bulleted list of specific hits with line references.
- Do NOT rewrite. The author decides.

**Deep Rewrite** (for "fix this", "make it human", "de-slop", or new drafts)

- Run the voice-first workflow below, producing a clean draft.
- Show the slop score before and after.
- Preserve the author's meaning and facts exactly — cut ornament, never substance.

Pick Deep Rewrite when the task is to produce or repair text; Quick Scan when the task is to assess it.

## Banned phrases and patterns

| Category               | Banned                                                                                                                                                                                 | Use instead                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Filler openers         | "In today's fast-paced world", "In the ever-evolving landscape of", "When it comes to", "It's important to note that", "It's worth noting that"                                        | Delete. Start at the first real claim. |
| Empty transitions      | "Moreover", "Furthermore", "Additionally", "That said", "With that in mind", "At the end of the day"                                                                                   | A period. Or nothing.                  |
| Hedge stacking         | "may potentially", "could possibly", "generally tends to", "in many cases can"                                                                                                         | State it, or state the condition once. |
| Self-praise adjectives | "seamless", "robust", "cutting-edge", "world-class", "game-changing", "powerful", "comprehensive", "innovative", "elevate", "unlock", "leverage", "delve", "navigate the complexities" | Say what it does. Show, don't assert.  |
| Antithesis cliché      | "It's not just X, it's Y", "It's not about X — it's about Y"                                                                                                                           | Make one claim. Drop the fake pivot.   |
| Rule-of-three padding  | reflexive triads: "fast, reliable, and scalable"                                                                                                                                       | Keep the one that carries weight.      |
| Closing boilerplate    | "In conclusion", "Ultimately", "At its core", "The bottom line is"                                                                                                                     | End on the last real sentence.         |
| Corporate verbs        | "utilize", "facilitate", "streamline", "spearhead"                                                                                                                                     | use, help, simplify, lead              |
| Vague intensifiers     | "very", "really", "truly", "incredibly", "actually"                                                                                                                                    | Cut. If it matters, quantify it.       |

## Structural pattern rules

1. **No listicle reflex.** Prose is not always three bullets. Use a paragraph when the ideas connect; use a list only when items are genuinely parallel and unordered.
2. **Em-dash budget.** At most one em-dash per paragraph. AI over-uses them as an all-purpose joint. Prefer a full stop or a comma.
3. **Vary sentence length.** If three consecutive sentences are within ~5 words of each other, break the rhythm. Slop is metronomic.
4. **One idea per sentence, one claim per paragraph.** Padding hides behind subordinate clauses.
5. **Concrete over abstract.** Replace "solutions", "capabilities", "offerings" with the actual thing.
6. **No hedged conclusions.** If the draft argues a point, land it. "It depends" is only allowed when you then say on what.
7. **Cut the meta.** Delete sentences that describe the text itself ("This section will explore…", "Let's dive into…").
8. **Active voice by default.** Passive only when the actor is genuinely unknown or irrelevant.

## Quality gate thresholds

Compute a slop score: start at 0, add per hit —

- Banned phrase: +4
- Structural rule violation: +6
- Antithesis cliché or closing boilerplate: +8

Thresholds:

- **0–10 — Ship.** Clean.
- **11–25 — Revise.** Fix the flagged hits; usually surface-level.
- **26+ — Rewrite.** Escalate Quick Scan to Deep Rewrite; the draft is structurally slop.

Never pass text scoring 26+ off as final in Deep Rewrite mode.

## Voice-first drafting workflow (Deep Rewrite)

1. **Say it out loud first.** Draft the point as you would say it to one specific person across a table. That sentence is the spine.
2. **Lead with the claim.** Put the load-bearing sentence first. Cut every word before it.
3. **Support with the concrete.** One real example, number, or mechanism beats three adjectives.
4. **Read for rhythm.** Vary sentence length. Read it aloud; if you stumble or drone, cut.
5. **Run the gate.** Score against the table and structural rules. Fix every hit above threshold.
6. **Delete 10%.** After it reads clean, cut another tenth. The strongest version is shorter than you think.

## What this skill will not do

- It will not flatten a deliberate, distinctive voice into grey neutrality. The target is human and specific, not sanded-down.
- It will not change facts, claims, or the author's argument. It cuts ornament, not substance.
- It will not ban a word the context genuinely earns — the tables are defaults, not absolutes. Flag, judge, then decide.
