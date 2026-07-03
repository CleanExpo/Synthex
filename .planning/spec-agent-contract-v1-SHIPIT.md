# SPM Spec — Synthex "SHIPIT": Agent Contract v1 (transport + Phill end-to-end; Margot/Pi provisioned)

- **Spec id:** spec-agent-contract-v1
- **Author:** SPM (Claude, Opus 4.8) — 2026-07-03
- **Repo:** CleanExpo/Synthex · branch `main` @ 154ba7e4 (canonical checkout fast-forwarded from stale `feat/brand-video-studio`)
- **Status:** scope-locked — judge gaps closed (82→target 100), ready to build
- **Command chain:** `/judge` (done — see §16) → **`/spm` (this doc)** → `/goal` (build to green) → `/session-handoff`

---

## 1. Task
Make Synthex — an **internal Unite-Group application** — drivable by three consumers: **Margot** (LLM agent, Hermes runtime), **Pi** (Pi-CEO orchestration), and **Phill** (owner), through a documented, authenticated, **capability-verified** contract. Honest boundary on what "verified" means per consumer is in §4.

## 2. Project context (verified this session, not memory)
- **Identity locked to INTERNAL TOOL.** `origin/main:CLAUDE.md` SSOT: _"internal application (Unite Group in-house tool, not a public SaaS). Billing/Stripe health, 'going public', and launch-readiness are out of scope — never raise them as blockers."_ Confirmed by the founder's framing.
- **Consequence:** the Linear "Stripe + OAuth gates remain" summary is **stale**. SYN-52 (Stripe) `Done/unverified-complete`; SYN-1054 (Meta OAuth) code-complete, only Meta-dashboard/owner actions left. **Neither is in SHIPIT scope for an internal tool** (judge Q3: defensible, cited to SSOT).

## 3. Problem
The agent-integration **backbone is already live** (prod MCP endpoint 401-gates correctly; `SYNTHEX_MCP_KEYS` set), but: only **one** caller key exists (`claude-code`), there is **no contract doc**, and no consumer other than Claude-Code has ever been proven to reach it. Consumers cannot use what they cannot discover, authenticate to, or (for Pi) consume on their actual substrate.

## 4. Desired outcome (definition of SHIPIT — honest per-consumer)
- **Transport:** published + proven reachable, with **per-caller keys** (attribution + revocation).
- **Phill:** proven **end-to-end** — `tools/list` → `generate_image` → `get_job` (poll to completed) → **non-null retrievable asset URL**. This is the capability proof, not discovery.
- **Margot:** key **provisioned**; a ready-to-apply `.mcp.json` snippet delivered for Margot's owner to wire into Hermes. Marked **owner-apply pending** (Margot runtime is off-limits; not builder-verifiable this session).
- **Pi:** documented on its **real substrate — the file-symlink/Vision Board bridge** (Pi writes research files → Synthex reads). A `pi` MCP key is provisioned for future use, but Pi-via-MCP is **explicitly phase-2** (no live Pi MCP client exists — verified).

## 5. Scope
**IN (Agent Contract v1):**
1. Provision `SYNTHEX_MCP_KEYS` (prod) with distinct callers: keep `claude-code`; add `margot`, `pi`, `phill`. **Safely** (see §11 prod-safety).
2. **Capability proof for Phill's key:** end-to-end generate→retrieve (§13). One real job, one time, deliberate quota cost (no dry-run mode exists).
3. Transport reachability proof for each new key: authenticated `tools/list` → 7 tools.
4. Write `docs/agent-contract-v1.md` — endpoint, auth, 7 tools + schemas, quota/budget semantics, `.mcp.json` template, **Margot snippet (owner-apply)**, **Pi section on the file-bridge substrate**.
5. Reconcile the Linear SYN board (exact tickets in §15 AC-4).

**OUT (Phase-2, gated — separate spec):**
- Publish/spend tools over MCP (code ships "NO publish tools (phase 1)").
- **Pi → Synthex MCP client loop** (bidirectional). Filed as a discovery ticket.
- Live Margot LLM conversation pass (exists only on stale `feat/brand-video-studio`).
- Broader Command Centre execution loop; campaign/CRM tools over MCP.

**Explicit boundary:** Margot's Hermes runtime is owned by another agent in-flight. This spec **edits no Margot/Hermes file**; it delivers a snippet for Margot's owner.

## 6. Existing capability (do not rebuild — verified on `main`)
- `app/api/mcp/[transport]/route.ts` — `mcp-handler@1.1.0`, registers `STUDIO_TOOLS`, jobs tagged `initiatedBy:'mcp'`.
- `app/api/mcp/auth.ts` — `resolveOrgFromBearer` over `SYNTHEX_MCP_KEYS` (JSON: key → {organizationId,userId,label}).
- `lib/services/ai/studio-tools/index.ts` — 7 tools: `list_cards, generate_video, generate_image, get_job, list_jobs, search_media_library, draft_caption`. Org-scoped, quota-aware, `budgetWarning` at 80% cap, no publish.
- **Prod state (verified):** endpoint 401s to unauth + bogus bearer; `SYNTHEX_MCP_KEYS` set (1 caller: `claude-code`); `OWNER_EMAILS` set. Owner gating enforced.
- **Pi substrate (verified):** file-symlink/Vision Board bridge (`app/dashboard/admin/vision-board/*`, `app/api/internal/vision-board/ai-commentary/route.ts`). No live Pi MCP client anywhere (only an archived stale rollout plan).

## 7. Specialist board (condensed)
- **Architect:** per-caller keys required (done). Prod key blob is a single point of auth failure → needs the §11 safety procedure.
- **Security:** static bearer keys Phase-1-acceptable for internal tool; Vercel-encrypted, never logged; no publish = leaked key only burns generation quota.
- **QA:** acceptance must be **capability** (end-to-end), not discovery. A leaked/broken downstream would pass `tools/list` while the tool is useless.
- **Devil's advocate:** "backbone is live, why a spec?" — unwired + undocumented + only-Claude-keyed = not shipped for the stated goal.

## 8. Judge challenge — see §16.

## 9. Proposed solution
Provision three named keys safely, prove Phill end-to-end + transport per key, publish one contract doc modelling each consumer on its **real** substrate, reconcile Linear. No platform code changes.

## 10. UX / consumer experience
- **Phill:** `.mcp.json` `phill` entry → Synthex studio tools in Claude Code; also usable via dashboard owner auth. **Proven end-to-end.**
- **Margot:** owner applies the delivered `synthex-studio` MCP block to Hermes; Margot can then generate brand media. **Owner-apply pending.**
- **Pi:** continues to feed Synthex via the file-symlink bridge (its shipped path). Bidirectional Pi→Synthex generation is phase-2.

## 11. Technical plan (with prod-safety)
1. **Back up** current `SYNTHEX_MCP_KEYS` (pull to scratchpad, inspect labels only, never print keys). Confirmed today: 1 caller `claude-code`.
2. Generate 3 keys; reuse the owner org id; distinct labels `margot`/`pi`/`phill`. Merge into the existing JSON (**never drop `claude-code`**).
3. **Validate** the merged JSON `JSON.parse`-es before upload. `vercel env rm` + `vercel env add SYNTHEX_MCP_KEYS production` (CLI). Redeploy **without build cache**.
4. **Regression:** after redeploy, assert the **existing `claude-code` key still returns 200** (not just the new keys) — proves I didn't break what worked.
5. Capability proof (Phill key) + transport proof (each key) per §13.
6. Author `docs/agent-contract-v1.md`; commit on `feat/agent-contract-v1`; push.

## 12. Security
No secrets in tracked files. Keys live only in Vercel + consumer runtimes. Doc contains the _shape_, never key values. Backup file is scratchpad-only and shredded after use.

## 13. Verification (capability, not discovery)
- **Phill end-to-end:** `tools/list`→7 tools; `generate_image`→`get_job` poll→**non-null `videoUrl`/asset URL** or `status:completed`. Record output in commit body. **One job, one time.**
- **Transport per key:** authenticated `tools/list`→7 tools for `margot`, `pi`, `phill`; `claude-code` still 200.
- **Repo gates:** `npm run type-check && npm run lint && npm test` (doc-only change → expected green).

## 14. Loop + stress
- Revoked key → 401 (delete an entry, re-test). Quota at cap → `budgetWarning:true`. Wrong-org job id → `job:null` (org isolation). Malformed merged blob caught by §11.3 parse-gate **before** upload.

## 15. Acceptance criteria (falsifiable)
1. `SYNTHEX_MCP_KEYS` prod = 4 callers (`claude-code` preserved + `margot`,`pi`,`phill`); merged JSON validated; `claude-code` still returns 200 post-redeploy. ✔/✗
2. **Capability:** Phill key completes `generate_image → get_job → non-null asset URL`. ✔/✗
3. **Transport:** authenticated `tools/list` → 7 tools for `margot`, `pi`, `phill`. ✔/✗
4. `docs/agent-contract-v1.md` committed: endpoint, auth, 7 tools+schemas, quota semantics, `.mcp.json` template, Margot owner-apply snippet, Pi file-bridge section. ✔/✗
5. Linear reconciled with **exact actions:** comment+reclassify SYN-52 & SYN-1054 as out-of-SHIPIT-scope; file (a) "Agent Contract v1 — MCP keys + contract doc" (this work), (b) "Margot owner-apply: wire Hermes → Synthex MCP" (blocked/owner), (c) "Pi → Synthex MCP client loop (discovery, phase-2)"; post project status update. ✔/✗
6. No Margot/Hermes file edited. ✔/✗

## 16. Judge challenge — score
- **First pass: 82/100, REDUCE SCOPE.** Gaps: (1) DoD proved discovery not capability; (2) title over-claimed "usable by Margot/Pi/Me"; (3) Pi mis-modelled on MCP vs its file-bridge; (4) no prod-safety for the live key blob; (5) unfalsifiable ACs + hidden real-spend "dry call."
- **Resolution (this revision):** (1)→§13 end-to-end capability proof; (2)→retitled + §4 honest per-consumer verification; (3)→§4/§6/§10 model Pi on file-bridge, MCP→phase-2 (substrate verified); (4)→§11 backup+parse-gate+existing-key regression; (5)→§15 exact tickets + one-time deliberate job cost. Claim now matches proof → meets the 100 bar for BUILD.

## 17. `/goal` command
`/goal Ship Synthex Agent Contract v1: safely add margot/pi/phill callers to SYNTHEX_MCP_KEYS (prod) preserving claude-code, prove Phill's key end-to-end (generate_image→get_job→asset URL), prove tools/list=7 for each new key, write docs/agent-contract-v1.md (endpoint/auth/7 tools/.mcp.json template/Margot owner-apply snippet/Pi file-bridge section), and reconcile the Linear SYN board per §15 AC-5. Do not touch any Margot/Hermes file. DoD = §15 all ✔.`

## 18. Implementation sequence
1. Back up + provision keys safely (§11) → regression-check claude-code.
2. Capability proof (Phill) + transport proof (each key).
3. Write contract doc → commit → push `feat/agent-contract-v1`.
4. Reconcile Linear + status update.

## 19. Session-handoff seed
Canonical `~/Synthex` on `main` @154ba7e4. MCP backbone live in prod; 1 caller (`claude-code`) pre-work. Remaining = safe key provisioning + Phill end-to-end proof + contract doc + Linear reconcile. Margot runtime off-limits (owned in-flight). Pi consumes via file-bridge, not MCP (phase-2).
