# Synthex Agent Contract v1

**Audience:** operators wiring an agent (Margot, Pi, Claude Code) or a person (Phill) to drive Synthex programmatically.
**Status:** transport LIVE in prod and verified 2026-07-03. Image generation blocked on a missing prod secret (see §7).
**Scope:** internal Unite-Group tool. Read + generate media. **No publish/spend tools in v1** (by design).

---

## 1. Endpoint

```
POST https://synthex.social/api/mcp/mcp
```

- Streamable-HTTP MCP server (`mcp-handler@1.1.0`), stateless — no `mcp-session-id` required.
- Source: `app/api/mcp/[transport]/route.ts`; tool layer: `lib/services/ai/studio-tools/index.ts`.
- Every job is tagged `initiatedBy: 'mcp'` and runs the **same quota/validation paths as the UI**.

## 2. Authentication

Static bearer key, one per caller. Server resolves the key → `{ organizationId, userId, label }` from the `SYNTHEX_MCP_KEYS` prod env (JSON map). Unknown/absent bearer → `401 {"error":"unauthorized"}`.

```
Authorization: Bearer <your-caller-key>
```

Provisioned callers (labels): `claude-code` (live), `margot`, `pi`, `phill` (staged — pending the prod secret apply). All map to the Unite-Group owner org; the `label` is for attribution + per-caller revocation.

## 3. `.mcp.json` client template

```json
{
  "mcpServers": {
    "synthex-studio": {
      "type": "http",
      "url": "https://synthex.social/api/mcp/mcp",
      "headers": { "Authorization": "Bearer ${SYNTHEX_MCP_KEY}" }
    }
  }
}
```

Put the key in the consumer's secret store as `SYNTHEX_MCP_KEY`; never commit it.

## 4. Tools (7) — read + generate, no publish

| Tool | Kind | Purpose |
|---|---|---|
| `list_cards` | read | Method cards, modifier chips, org brand card, model tiers + costs, current quota. Call first to discover capabilities. |
| `generate_video` | generate (async) | Submit a generative video job. Returns job ids immediately — poll `get_job`. Defaults: draft tier, 9:16, 6s, 1 variant. Premium tier must be explicit. Response carries `budgetWarning` at ≥80% of a cap — self-throttle when true. |
| `generate_image` | generate (sync) | Generate an image (Stability → DALL·E → Gemini fallback). **Blocked in prod until an image-provider key is set — §7.** |
| `get_job` | read | Fetch one video job by id (status, `videoUrl` when rendered, error when failed). Org-scoped. |
| `list_jobs` | read | Recent generative video jobs for the org; optional `batchGroupId`. |
| `search_media_library` | read | Search the media library (e.g. find an image asset for I2V input). |
| `draft_caption` | generate (sync) | Draft a platform caption for a rendered video via cheap-LLM routing. Does **not** publish. |

Input schemas are Zod on the server; call `list_cards` for live capability/quota, and rely on each tool's `description` (surfaced over MCP) for argument shape. Key ones:

- `generate_video`: method-card driven; tier `draft|premium`, aspect, duration, variants.
- `generate_image`: `{ prompt, style?, aspectRatio? }`.
- `get_job`: `{ id }`. `list_jobs`: `{ limit?, batchGroupId? }`. `search_media_library`: `{ search, type?, limit? }`. `draft_caption`: `{ jobId, platform }`.

## 5. Quota, budget & isolation semantics

- All reads/writes are **org-scoped** — a caller only ever sees its org's jobs/assets. A wrong-org job id returns `job: null`.
- `list_cards.quota` and `generate_video.budgetWarning` expose spend state; when `budgetWarning: true`, back off.
- Generation spends real provider quota. There is no dry-run mode — treat every `generate_*` call as billable.

## 6. Per-consumer wiring

- **Phill (owner):** use the `phill` key in a local `.mcp.json`, or the dashboard via `OWNER_EMAILS` auth. Transport + read tools verified live.
- **Margot (Hermes runtime — owned by another agent in-flight):** hand the `synthex-studio` block above to Margot's owner to add to the Hermes MCP config with Margot's key as `SYNTHEX_MCP_KEY`. **Do not edit Hermes/Margot files from Synthex.** Status: key staged, owner-apply pending.
- **Pi (Pi-CEO):** Pi's shipped Synthex touchpoint is the **file-symlink / Vision Board bridge** (Pi writes research files → Synthex reads them at `app/dashboard/admin/vision-board/*` via `app/api/internal/vision-board/ai-commentary/route.ts`). Pi does **not** run an MCP client today. A `pi` bearer key is provisioned for future use; **Pi-via-MCP is phase-2** (discovery ticket filed).

## 7. Production readiness (verified 2026-07-03)

| Capability | State | Evidence |
|---|---|---|
| Transport + auth | ✅ live | `initialize` → HTTP 200; bogus/no bearer → 401 |
| `tools/list` | ✅ 7 tools | verified with owner key |
| Read tools | ✅ | org-scoped, functional |
| `generate_video` | ✅ credentialed | `FAL_API_KEY` set in prod (not live-tested to avoid cost) |
| `generate_image` | ❌ **blocked** | returns `{"success":false,"provider":"stability","error":"All image generation providers failed"}` — no image-provider key set in prod |
| margot/pi/phill keys | ⏳ staged | validated merge; pending prod secret apply |

**Two owner actions to reach full green:**
1. Apply the staged `SYNTHEX_MCP_KEYS` (adds margot/pi/phill callers), then redeploy prod.
2. Set **one** image-provider key in prod (`STABILITY_API_KEY` **or** `OPENAI_API_KEY` **or** `GEMINI_API_KEY`), then redeploy. Fallback order is stability → dalle → gemini (`lib/services/ai/image-generation.ts:415-417`).

## 8. Verification recipe

```bash
KEY=<caller-key>; U=https://synthex.social/api/mcp/mcp
# transport
curl -s -X POST $U -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# capability (once an image key is set)
curl -s -X POST $U -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate_image","arguments":{"prompt":"test tile"}}}'
```
