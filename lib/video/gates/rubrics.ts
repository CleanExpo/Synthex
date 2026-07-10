/**
 * Gate rubric constants — nexus-viral productionise WS3a (SYN-1075).
 *
 * `broadcast-grill-viral.md` (this directory) did NOT exist anywhere on
 * `origin/main` prior to this workstream — the handoff spec named it as if
 * it already existed, but it was only prose living in session-local judge
 * agent instructions. This file is the authoritative, versioned rubric text
 * that `runBriefGrill` / `runBroadcastGrill` (./index.ts) actually load. The
 * sibling `.md` file mirrors this text for human review — keep both in sync
 * and bump {@link RUBRIC_VERSION} whenever either changes.
 */

/** Bump this whenever BRIEF_RUBRIC or BROADCAST_RUBRIC text changes. */
export const RUBRIC_VERSION = 'broadcast-grill-viral@1';

export const BRIEF_RUBRIC = `Brief Grill (Gate A — pre-generation). Grade the creative brief
(method card + modifier chips + copy bundle) BEFORE any paid video generation.

1. Hook clarity — the first beat states a concrete, specific claim or question, not
   generic scene-setting. Vague openers ("in today's video…") fail.
2. Shot-grammar compliance — every shot resolves to a defined viral-method-card shot
   type. An undefined/ambiguous shot type is a failure, not a warning.
3. Safe-zone respect — any on-screen text/caption plan keeps clear of the 9:16 unsafe
   margins (VIRAL_SAFE_ZONE). A caption plan that ignores the safe zone fails.
4. Platform fit — the brief declares a target platform/aspect and the shot list is
   achievable in the requested duration.
5. Brand/claims safety — no unverifiable superlative claims, no competitor
   disparagement, no medical/financial claims without a disclaimer. Any hit is a hard
   failure.`;

export const BROADCAST_RUBRIC = `Broadcast Grill (Gate B — post-generation, pre-derive/release).
Grade the rendered artefact's transcript/caption/copy bundle AFTER generation, before
any social cut is derived or queued for release.

1. Hook delivery — the actual opening beat matches (or improves on) the brief's hook;
   a hook diluted or cut in generation fails.
2. Pacing — no single shot exceeds its viral-method-card's max hold time. A
   static/held shot beyond spec is a failure.
3. Caption accuracy — burned-in/derived captions match the actual voiceover/transcript
   (no hallucinated claims absent from the source). A mismatch is a hard failure.
4. Safe-zone respect (post-render) — re-check the rendered crop/caption plan against
   VIRAL_SAFE_ZONE; a subject or caption outside the safe zone fails, even if the
   brief passed Gate A.
5. Platform/legal safety — no disallowed content (hate, harassment, deceptive/
   manipulated media disclosure gaps, unlicensed music claims). Any hit is a hard
   failure with no partial credit.
6. Fail-closed on ambiguity — if a check cannot be confidently resolved from the
   supplied transcript/candidate data, count it as a FAILURE, never a pass-by-default.`;

/**
 * Both gates share the same strict verdict contract.
 * See GateVerdictSchema (./types.ts) for the Zod-enforced shape.
 */
export const VERDICT_CONTRACT_INSTRUCTIONS = `Respond with ONLY strict JSON, no prose, no
markdown code fences, matching exactly:
{"pass": boolean, "score": number (0-100), "failures": string[], "warnings": string[], "rubric_version": string}

"pass" is true only when "failures" is empty. rubric_version must be exactly "${RUBRIC_VERSION}".`;
