# SPM Spec — Synthex "SHIPIT": Agent Contract v1 (Margot · Pi · Phill)

- **Spec id:** spec-agent-contract-v1
- **Author:** SPM (Claude, Opus 4.8) — 2026-07-03
- **Repo:** CleanExpo/Synthex · branch `main` @ 154ba7e4 (canonical checkout fast-forwarded from stale `feat/brand-video-studio`)
- **Status:** scope-locked — ready to plan
- **Command chain:** `/judge` (should we) → **`/spm` (this doc)** → `/goal` (build to green) → `/session-handoff`

---

## 1. Task

Make Synthex — an **internal Unite-Group application** — genuinely usable by three consumers: **Margot** (LLM agent, Hermes runtime), **Pi** (Pi-CEO orchestration), and **Phill** (owner). "SHIPIT ready" = each consumer can drive Synthex through a documented, authenticated, verified contract.

## 2. Project context (verified this session, not memory)

- **Identity is locked to INTERNAL TOOL.** `origin/main:CLAUDE.md` SSOT: _"internal application (Unite Group in-house tool, not a public SaaS). Billing/Stripe health, 'going public', and launch-readiness are out of scope — never raise them as blockers."_ Confirmed by the founder's own framing.
- **Consequence:** the Linear project summary "Stripe + OAuth gates remain" is **stale**. SYN-52 (Stripe) is `Done/unverified-complete`; SYN-1054 (Meta OAuth) is code-complete with only Meta-dashboard/owner actions left. **Neither is in SHIPIT scope for an internal tool.**

## 3. Problem

The agent-integration **backbone is already live**, but the **last mile is not wired**, and there is **no contract doc**. Consumers cannot use what they cannot discover or authenticate to.

## 4. Desired outcome (definition of SHIPIT)

A consumer holding a valid bearer key can call `https://synthex.social/api/mcp/mcp`, receive the 7 studio tools, generate/inspect media jobs org-scoped, and there is a single doc that tells Margot's owner, Pi, and Phill exactly how. Verified by a live authenticated `tools/list` returning 7 tools.

## 5. Scope

**IN (Agent Contract v1):**

1. Verify `SYNTHEX_MCP_KEYS` (prod) contains distinct caller entries for `margot`, `pi`, `phill` (label + org + user each). Provision any missing.
2. Live authenticated smoke test: `tools/list` → 7 tools; one `generate_image` dry call per caller org.
3. Write `docs/agent-contract-v1.md` — endpoint, auth, the 7 tools + schemas, quota/budget semantics, `.mcp.json` client template, and a ready-to-apply Margot/Pi config snippet.
4. Reconcile the Linear SYN board to this reality (close stale gates, file the real remaining tickets).

**OUT (Phase-2, gated — separate spec):**

- Publish/spend tools over MCP (code deliberately ships "NO publish tools (phase 1)").
- Live Margot LLM conversation pass (exists only on stale `feat/brand-video-studio`, not `main`).
- Broader Command Centre execution loop; campaign/CRM tools over MCP.

**Explicit boundary:** Margot's Hermes runtime is owned by another agent in-flight. This spec **does not edit any Margot/Hermes file**; it delivers a config snippet for Margot's owner to apply.

## 6. Existing capability (do not rebuild — all verified on `main`)

- `app/api/mcp/[transport]/route.ts` — `mcp-handler@1.1.0`, registers `STUDIO_TOOLS`, jobs tagged `initiatedBy:'mcp'`.
- `app/api/mcp/auth.ts` — `resolveOrgFromBearer` over `SYNTHEX_MCP_KEYS` (JSON: key → {organizationId,userId,label}).
- `lib/services/ai/studio-tools/index.ts` — 7 tools: `list_cards, generate_video, generate_image, get_job, list_jobs, search_media_library, draft_caption`. Org-scoped, quota-aware, `budgetWarning` at 80% cap, no publish.
- **Prod state:** endpoint returns 401 to unauthenticated + bogus-bearer; `SYNTHEX_MCP_KEYS` set (Vercel, Prod+Preview, 22d); `OWNER_EMAILS` set (15h). Owner gating enforced across admin/auth.

## 7. Specialist board (condensed)

- **Architect:** contract is sound; the only risk is key hygiene (one shared key vs per-caller keys). Require per-caller keys for attribution + revocation.
- **Security:** static bearer keys are Phase-1 acceptable for an internal tool; keys are Vercel-encrypted, never logged. Rotate on any suspected leak. No publish tools = no spend blast-radius from a leaked key (only generation quota).
- **QA:** acceptance must be a _live authenticated_ call, not a code read. Bogus-bearer 401 already proven.
- **Devil's advocate:** "the backbone is live, so why a spec?" — because unwired + undocumented = not shipped for the stated goal; and because the identity/stale-gate confusion would otherwise send work at the wrong target (Stripe/launch).

## 8. Judge challenge — see §16.

## 9. Proposed solution

Provision three named keys, prove them live, and publish one contract doc. No platform code changes.

## 10. UX / consumer experience

- **Phill:** `.mcp.json` entry → Synthex studio tools available in Claude Code / dashboard already works via owner auth.
- **Margot:** owner applies the provided `synthex-studio` MCP block to Hermes config; Margot can then generate brand media on request.
- **Pi:** Pi-CEO routine adds the same `.mcp.json` block (or calls the endpoint directly with its bearer key).

## 11. Technical plan

1. Read current `SYNTHEX_MCP_KEYS` (controlled): `vercel env pull` to a tmp file, inspect labels only, never print keys.
2. If `margot`/`pi`/`phill` entries missing, generate keys, resolve each org/user id from Synthex DB (owner org), merge JSON, `vercel env add SYNTHEX_MCP_KEYS production` (CLI, per env-over-UI rule). Redeploy without build cache (env change).
3. Smoke: authenticated `tools/list` per key → assert 7 tools; `generate_image` returns a result object.
4. Author `docs/agent-contract-v1.md` + commit.

## 12. Security

No secrets in tracked files. Keys live only in Vercel + the consumer runtimes. Doc contains the _shape_, never key values. Owner-only endpoints unchanged.

## 13. Verification

- `curl -H "Authorization: Bearer <margot-key>" -X POST .../api/mcp/mcp -d '{tools/list}'` → 7 tools.
- Repeat per caller. Record outputs in the commit body.
- `npm run type-check && npm run lint && npm test` clean (doc-only + no code change → expected green).

## 14. Loop + stress

- Revoked/rotated key → 401 (delete an entry, re-test). Quota at cap → `budgetWarning:true` surfaced. Wrong-org job id → `job:null` (org isolation holds).

## 15. Acceptance criteria

1. `SYNTHEX_MCP_KEYS` prod has 3 distinct labelled callers: margot, pi, phill. ✔/✗
2. Live authenticated `tools/list` returns the 7 studio tools for each caller. ✔/✗
3. `docs/agent-contract-v1.md` committed with endpoint, auth, tools, `.mcp.json` template, Margot/Pi snippet. ✔/✗
4. Linear SYN board reconciled: stale gates closed, real remaining tickets filed, project status update posted. ✔/✗
5. No Margot/Hermes file edited by this work. ✔/✗

## 16. Judge challenge — score

See inline judge in the session (target: real 100/100 before `/goal`).

## 17. `/goal` command

`/goal Provision and verify Synthex Agent Contract v1: ensure SYNTHEX_MCP_KEYS (prod) has distinct margot/pi/phill callers, prove a live authenticated tools/list (7 tools) per caller, write docs/agent-contract-v1.md with the .mcp.json template + Margot/Pi snippet, and reconcile the Linear SYN board. Do not touch any Margot/Hermes file. Definition of done = §15 acceptance criteria all ✔.`

## 18. Implementation sequence

1. Verify prod key contents (labels only) → provision gaps.
2. Live smoke per caller.
3. Write contract doc + commit + push (branch `feat/agent-contract-v1`).
4. Reconcile Linear + status update.

## 19. Session-handoff seed

Canonical checkout `~/Synthex` now on `main` @154ba7e4. MCP backbone live in prod. Remaining = key verification + contract doc + Linear reconcile. Margot runtime is off-limits (owned in-flight).
