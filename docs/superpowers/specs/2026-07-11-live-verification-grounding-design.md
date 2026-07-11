# Design Spec — Live Verification of Image Grounding (prod runbook)

- **Date:** 2026-07-11
- **Status:** Draft for review
- **Type:** Verification **runbook** — no new production code.
- **Verifies:** the merged image-grounding slice
  (`docs/superpowers/specs/2026-07-11-reference-grounded-image-generation-design.md`), now live in `main`.
- **Evidence tags:** `[VERIFIED]` = checked against a file/line this session; `[UNCONFIRMED]` = assumption/risk.

---

## 1. Problem & intent

Image grounding is merged and green — but **only ever tested against MOCKED fal**. No real end-to-end run
has proven that, on a deployed environment, `generate_image` with a `referenceSet` actually (a) resolves an
owned photo, (b) hands fal a reachable reference URL, and (c) produces an image that resembles the **real**
CCW wand. This runbook proves that on production with a single cheap, non-publishing generation.

`[VERIFIED]` Grounding needs a deployed public URL: `generateImage` builds the fal `image_urls` from
`NEXT_PUBLIC_APP_URL` + the site-relative `/reference-library/...` path, and fal fetches them over the
public internet. `[VERIFIED]` MCP tools `list_reference_sets` and `generate_image` (with `referenceSet`)
exist in main (`lib/services/ai/studio-tools/index.ts`). `[VERIFIED]` MCP endpoint is
`https://synthex.social/api/mcp/mcp` (mcp-handler streamable HTTP, `basePath '/api/mcp'`).

## 2. Scope

**In scope:** one live grounded **image** generation on **production** (`synthex.social`), invoked via the
**MCP tool** path, with pasted output + a human realism check.
**Out of scope (follow-ons):** video grounding verification (async job + `/api/video/webhook/fal` + polling);
turning this into a repeatable automated smoke test; any non-prod environment.

## 3. Decisions locked

| #   | Decision      | Choice                                                                                    |
| --- | ------------- | ----------------------------------------------------------------------------------------- |
| L1  | Scope         | Image grounding only (video is a follow-on)                                               |
| L2  | Environment   | Production `synthex.social`                                                               |
| L3  | Invocation    | MCP tool via the deployed `/api/mcp/mcp` endpoint (JSON-RPC), with an MCP-client fallback |
| L4  | Pass criteria | Programmatic (`grounded:true` + FLUX model + `imageUrl`) **and** human realism eyeball    |
| L5  | Cost/safety   | ~$0.03, `riskClass: draft` — never publishes                                              |

## 4. Preconditions (assert before running)

1. `[UNCONFIRMED]` Prod is deployed at `main` ≥ the video-merge tip (`79a42677a` or later) and Vercel shows **Ready**.
2. `[UNCONFIRMED]` Prod env has `NEXT_PUBLIC_APP_URL=https://synthex.social` and `FAL_API_KEY` set (Vercel dashboard).
3. A **creative-scoped MCP bearer key**. Mint one (owner/admin only) — `[VERIFIED]` route
   `POST /api/admin/mcp-keys`, header `x-admin-api-key: <ADMIN_API_KEY>`, body
   `{ organizationId, userId, label, scopes: ["creative"] }`, returns `{ key }`:
   ```bash
   curl -s -X POST https://synthex.social/api/admin/mcp-keys \
     -H "x-admin-api-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
     -d '{"organizationId":"<ORG_ID>","userId":"<USER_ID>","label":"live-verify-grounding","scopes":["creative"]}'
   # → { "key": "smk_..." }   ← export as MCP_KEY
   ```

## 5. Steps

### Step 0 — reference photo is publicly served (the URL fal must fetch)

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://synthex.social/reference-library/carpet-cleaning/carpet-cleaning-wand-01.webp
```

**Expect:** `200 image/webp`. If not `200`, grounding cannot work (fal can't fetch the seed) — stop and fix serving.

### Step 1 — discover the reference set (`list_reference_sets`)

The MCP endpoint speaks JSON-RPC 2.0 over streamable HTTP. Send `initialize`, then `tools/call`. Include
both Accept types; the handler may reply as `text/event-stream` (parse the `data:` line) or JSON.

```bash
MCP=https://synthex.social/api/mcp/mcp
H=(-H "Authorization: Bearer $MCP_KEY" -H "Content-Type: application/json" \
   -H "Accept: application/json, text/event-stream")
# initialize (capture the mcp-session-id response header if present)
curl -sS "${H[@]}" -X POST "$MCP" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"live-verify","version":"1"}}}'
# tools/call list_reference_sets (add -H "mcp-session-id: <id>" if initialize returned one)
curl -sS "${H[@]}" -X POST "$MCP" -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_reference_sets","arguments":{}}}'
```

**Expect:** the result's `sets` includes `{ industry: "carpet-cleaning", ... }` with a `carpet-cleaning-wand`
subject `count: 18`, `rights: "owned"`. Paste the JSON.

### Step 2 — grounded generation (`generate_image`)

```bash
curl -sS "${H[@]}" -X POST "$MCP" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"generate_image","arguments":{"prompt":"professional product photo of the carpet cleaning wand on commercial office carpet, natural lighting","referenceSet":"carpet-cleaning"}}}'
```

**Paste the full JSON.** `[VERIFIED]` The MCP reply's `result.content[0].text` is a JSON string; the
`generate_image` tool wraps its payload as `{ result: <ImageGenerationResult> }`. So parse that text and
**assert on the inner `result` object** (call it `R`):

- `R.grounded === true`
- `R.refCount > 0`
- `R.metadata.model === "fal-ai/flux-2-pro"`
- `R.imageUrl` is present (a fal-hosted URL), and there is **no** `R.error`.

(Concretely: `jq -r '.result.content[0].text' | jq '.result | {grounded, refCount, model: .metadata.model, imageUrl, error}'`.)

### Step 3 — human realism check

Open `result.imageUrl`. **Expect:** it clearly resembles **the real wand** — red aluminium pole, black
T-grip, stainless glide head with the clear inspection window — not a generic/synthetic carpet tool. This is
the criterion grounding exists for; a plausible-but-generic wand = grounding didn't actually bite.

## 6. Pass / Fail

**PASS = all of:** Step 0 `200 image/webp` · Step 1 shows the owned carpet set · Step 2 `grounded:true` +
FLUX model + `imageUrl`, no error · Step 3 output visibly matches the real gear.

**FAIL diagnostics:**

- `grounded:false` → `NEXT_PUBLIC_APP_URL` unset/wrong in prod, or the prompt/industry didn't match an owned
  set (use an explicit `referenceSet`, which we did).
- `result.error` / non-2xx → `FAL_API_KEY` missing, or fal could not fetch the reference URL (re-check Step 0
  from the public internet, not just a logged-in browser).
- Image looks generic despite `grounded:true` → fal received the ref but the prompt overpowered it; re-run with
  a more product-focused prompt, or inspect the fal request. Record as a _quality_ finding, not a hard fail.
- MCP `401`/empty tool list → the key isn't `creative`-scoped (deny-by-default); re-mint with `scopes:["creative"]`.

## 7. Cost, safety, cleanup

- **Cost:** one FLUX.2 pro image ≈ **$0.03** (`[VERIFIED]` registry `costPerMegapixelUsd: 0.03`).
- **Safety:** `generate_image` is `riskClass: 'draft'` — it **never publishes**; output lands as a draft asset only.
- **Cleanup (optional):** delete the draft asset from the media library afterwards. No external/public artifact is created.

## 8. Risks & assumptions

- `[UNCONFIRMED]` Raw-curl against mcp-handler streamable HTTP may require the `initialize` handshake +
  `mcp-session-id` header and may return SSE framing. **Fallback (recommended if curl is fiddly):** point any
  MCP client at `https://synthex.social/api/mcp/mcp` with `Authorization: Bearer $MCP_KEY` (e.g. Claude Code
  via `.mcp.json` → `synthex-studio`, or the MCP Inspector) and call `list_reference_sets` then `generate_image`.
  The pass/fail assertions (§6) are identical regardless of transport.
- `[UNCONFIRMED]` Prod env vars (`NEXT_PUBLIC_APP_URL`, `FAL_API_KEY`) are set — Step 2 failure is the signal if not.
- This proves the **image** path only. Video (async) is a separate runbook.

## 9. Acceptance criteria

1. Reference photo returns `200 image/webp` from the public internet (Step 0).
2. `list_reference_sets` returns the owned `carpet-cleaning` set (Step 1).
3. `generate_image referenceSet:'carpet-cleaning'` → the inner `result` object shows `grounded:true`,
   `refCount>0`, FLUX model, an `imageUrl`, no error — **with pasted JSON** (Step 2).
4. The generated image visibly resembles the real wand (Step 3).
5. Outcome (pass or fail-with-diagnosis) recorded; if it fails, the failing precondition/step is named.

## 10. Deliverable

This document **is** the runbook — it is executed, not built. Running it requires prod env + an admin key +
willingness to spend ~$0.03, so execution is founder-gated. No code, no schema, no PR to merge (unless we later
choose to codify it as a repeatable smoke script — a separate follow-on).
