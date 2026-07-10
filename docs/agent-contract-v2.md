# Synthex Agent Contract v2 — scoped namespaces, riskClass, structuredContent

**Audience:** operators wiring an agent (Margot, Pi, Claude Code) or a person (Phill) to drive Synthex programmatically.
**Status:** SYN-MCP-007 (SYN-1084). Supersedes [agent-contract-v1.md](./agent-contract-v1.md) — v1's §2 auth section is STALE (it documents the retired `SYNTHEX_MCP_KEYS` env map; see §2 below for the real model).
**Scope:** internal Unite-Group tool. Read + draft only. **Zero publish/spend tools — machine-enforced** (§5).

---

## 1. Endpoint

```
POST https://synthex.social/api/mcp/mcp
```

- Streamable-HTTP MCP server (`mcp-handler@1.1.0` over `@modelcontextprotocol/sdk` 1.29.0), stateless.
- Source: `app/api/mcp/[transport]/route.ts`; tool registry: `lib/services/ai/studio-tools/` (contract types in `types.ts`).
- Every job is tagged `initiatedBy: 'mcp'` and runs the same quota/validation paths as the UI.

## 2. Authentication & key scopes (SYN-MCP-004-1)

Bearer key per caller. Resolution order (`app/api/mcp/auth.ts`):

1. **DB key registry (primary):** the presented bearer is sha-256 hashed and looked up in `mcp_api_keys` (`McpApiKey` — raw keys never stored). Revoked (`revokedAt`) and expired (`expiresAt`) keys are rejected outright and never fall through. Each key carries `scopes: string[]` — **defaults to `[]`, which grants NOTHING** (§4).
2. **Legacy env fallback (cutover only):** when the DB has no row for the hash and `SYNTHEX_MCP_LEGACY_KEYS` is set, it is parsed as the phase-1 JSON map `{ "<raw key>": { organizationId, userId, label } }`. Legacy callers get the wildcard scope `['*']` so the original 8 creative tools keep working unchanged. **The old `SYNTHEX_MCP_KEYS` var is no longer read.**

Unknown/absent bearer → `401 {"error":"unauthorized"}`.

```
Authorization: Bearer <your-caller-key>
```

## 3. The 4-plane tool contract

Every tool in the registry carries:

| Field           | Meaning                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope`         | Namespace the tool belongs to. Registration is filtered by the caller key's scopes (§4).                                                                                   |
| `riskClass`     | `read` \| `draft` \| `spend` \| `publish`. **v1 registers only `read`/`draft`** — the registry throws at load and a test fails if anything carries `spend`/`publish` (§5). |
| `costClass`     | `free` (no external spend) \| `metered` (cheap LLM/deterministic compute) \| `expensive` (real provider generation spend).                                                 |
| `outputSchema?` | Exact Zod return shape. When present the server advertises it and emits `structuredContent` (§6).                                                                          |

Tool names are underscore-namespaced (`approvals_list_pending`, not `approvals.list_pending`) — the MCP name regex disallows dots.

## 4. Per-scope `tools/list` behaviour (covered-by semantics, exact)

- `'*' ∈ scopes` → **all** tools are registered (legacy/wildcard keys).
- Otherwise a tool is registered **iff `tool.scope ∈ scopes`**.
- `scopes` empty or absent → **zero tools**. A freshly minted DB key with the default `scopes: []` sees an **empty `tools/list`** — deny-by-default; grant scopes explicitly.

The handler is built per request, so `tools/list` is always per-caller — there is no cross-key caching. A tool outside your scopes is not merely hidden: `executeStudioTool` re-checks scopes at execution (defence in depth), so calling it returns an error even if registration filtering were bypassed.

## 5. Namespaces v1 (16 tools — read + draft only)

| Namespace / scope | Tools                                                                               | riskClass | costClass     |
| ----------------- | ----------------------------------------------------------------------------------- | --------- | ------------- |
| `creative`        | `list_cards`, `get_job`, `list_jobs`, `search_media_library`                        | read      | free          |
| `creative`        | `generate_video`                                                                    | draft     | **expensive** |
| `creative`        | `generate_image`, `draft_caption`, `derive_cuts`                                    | draft     | metered       |
| `approvals`       | `approvals_list_pending`, `approvals_get`                                           | read      | free          |
| `context`         | `context_get_brand`, `context_get_client_profile`, `context_preview_layered_prompt` | read      | free          |
| `performance`     | `performance_get_outcomes`, `performance_get_scores`, `performance_cost_report`     | read      | free          |

Notes:

- **`creative`** is the original phase-1 set — names byte-identical, behaviour unchanged (see v1 §4 for per-tool argument shapes). `generate_*` spends real provider quota; treat every call as billable and back off on `budgetWarning: true`.
- **`approvals_decide` is DELIBERATELY ABSENT.** Approving/rejecting a claim stays a human-UI act. Its absence (and that of any `*_publish`/`*_spend` name, and of any `publish`/`spend` riskClass) is machine-enforced by a registry load-time guard plus `tests/unit/mcp/namespace-tools.test.ts` — not convention.
- **`approvals_*`** surfaces both axes of a claim: `approvalStatus` (human approval) and `evidenceStatus` (derived evidence verification) — the SYN-MCP-001 split.
- **`context_preview_layered_prompt`** builds (never runs) the 3-layer system prompt: Core = BrandOperatingSystem, Client = ClientProfile → BrandDNA → OrgContext, Task = your `taskType`. `systemPrompt: null` means the org has no Core/ClientProfile artifact and callers use their own default.
- **`performance_get_scores` is a HEURISTIC** — rule-based pattern matching (Flesch-Kincaid-style readability, regex engagement cues), not a model or human evaluation. Its output self-labels `method: 'heuristic'`, `scorer: 'content-scorer-heuristic-v1'`. Treat it as a linting signal, never ground truth.
- **`performance_cost_report`** reads the pipeline cost ledger for **your org only** (`clientId = organizationId` equality in the query — board-level unattributed rows are excluded by construction).

### Deferred namespaces (reserved scopes — grant nothing today)

- **`tasks_*` → SYN-MCP-007b.** TaskEnvelope records carry no `organizationId` (they live in BullMQ/Linear, not an org-scoped table), and `tasks_enqueue` would drive the autonomous-task-worker — exposing it to org keys needs an org-pinning / Linear-gated-enqueue design decision first. Note for 007b: BullMQ `jobId` dedupe holds only while the job record exists (~24h after completion / 7d after failure) — it is **not** permanent idempotency.
- **`research_*`** lands with SYN-MCP-006 wiring.

## 6. structuredContent (SYN-1084 spike, 2026-07-10)

Tools that declare an `outputSchema` are registered with it, and each call returns `structuredContent` (the typed result object) **alongside** the JSON text content — text stays for back-compat, so existing consumers parse exactly what they always did.

- The SDK **validates `structuredContent` against the declared schema at call time and throws on mismatch** — so a schema is only ever declared when a contract test proves the tool's real return conforms (`tests/unit/mcp/structured-content.test.ts`).
- v1 declares `outputSchema` on **all 8 new namespace tools**. The 8 creative tools do **not** declare one yet (their returns embed Dates and provider/registry passthroughs); schemas land per-tool once returns are normalised — never blanket-added.
- All timestamps in structured outputs are ISO-8601 strings.

## 7. Isolation & safety semantics

- Every tool's queries are org-scoped via the caller's `organizationId` — a wrong-org id returns `null` data, never an error oracle.
- Scope enforcement is layered: registration filter (§4) + execution re-check + the v1 risk invariant (§5).
- No migrations shipped with 007; the `McpApiKey.scopes` column arrived with SYN-MCP-004-1.

## 8. Verification recipe

```bash
KEY=<caller-key>; U=https://synthex.social/api/mcp/mcp
# per-scope tools/list — a creative-scoped key sees exactly the 8 legacy tools,
# a zero-scope key sees an empty list, a wildcard key sees all 16
curl -s -X POST $U -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# structuredContent — result carries both content[0].text and structuredContent
curl -s -X POST $U -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"approvals_list_pending","arguments":{}}}'
```
