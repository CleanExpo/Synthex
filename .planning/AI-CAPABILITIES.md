# AI Capabilities Reference — Synthex

## Claude 4.6 Models (Active)

| Alias                      | Model ID                    | Context | Best For                            |
| -------------------------- | --------------------------- | ------- | ----------------------------------- |
| fast / free                | `claude-haiku-4-5-20251001` | 200K    | Quick edits, variations, hooks      |
| balanced / creative / code | `claude-sonnet-4-6`         | 1M      | General content, standard campaigns |
| premium                    | `claude-opus-4-6`           | 1M      | Flagship campaigns, deep strategy   |

**Configured in:** `lib/ai/providers/anthropic-provider.ts`

---

## Extended Thinking

Extended thinking gives Claude space to reason step-by-step before producing output. Budget = tokens consumed by the thinking process.

### When to enable

| Scenario                     | Budget | Constant                    |
| ---------------------------- | ------ | --------------------------- |
| Disabled                     | 0      | `THINKING_BUDGETS.quick`    |
| Standard content (Sonnet)    | 500    | `THINKING_BUDGETS.standard` |
| Premium multi-step campaigns | 4,000  | `THINKING_BUDGETS.deep`     |
| Opus flagship campaigns      | 16,000 | `THINKING_BUDGETS.opus`     |

**Configured in:** `lib/ai/constants.ts`

### SDK usage

```typescript
import { THINKING_BUDGETS } from '@/lib/ai/constants';

await provider.complete({
  model: 'claude-sonnet-4-6',
  messages: [...],
  thinking: THINKING_BUDGETS.deep,
  cache: true, // cache system prompt block
});
```

### Interleaved thinking (multi-step)

Enable for campaigns with 5+ posts. Pass beta header on the Anthropic provider:

```typescript
// In anthropic-provider.ts — pass via betaHeaders when interleaved thinking needed
betaHeaders: ['interleaved-thinking-2025-05-14'];
```

---

## Prompt Caching

Caching is GA (no beta header required). Set `cache: true` on any `AICompletionRequest` to mark the system prompt block with `cache_control: { type: 'ephemeral' }`.

Best for: repeat calls within the same campaign where the system prompt is stable.

**Configured in:** `lib/ai/providers/anthropic-provider.ts`

---

## Obsidian Second Brain

Obsidian becomes the **persistent second brain** for each client.

### Vault structure

```
Clients/{orgId}/
  business-dna.md        — Brand profile (auto-synced from Business DNA extraction)
  context.md             — Running AI context (curated or auto-built)
  insights.md            — Auto-research insights, dated entries
  performance/{YYYY-MM}.md — Monthly campaign performance snapshots
  campaigns/             — One note per campaign (future)
```

### Integration points

| What                         | Where                                   | Function                                |
| ---------------------------- | --------------------------------------- | --------------------------------------- |
| Build context for generation | `lib/obsidian/client-knowledge-base.ts` | `buildContextForGeneration(orgId)`      |
| Mirror research insights     | `lib/auto-research/orchestrator.ts`     | `updateClientInsights(orgId, insights)` |
| Sync brand DNA               | `lib/obsidian/business-dna-vault.ts`    | `syncBusinessDNA(orgId, dna)`           |
| Record campaign metrics      | `lib/obsidian/client-knowledge-base.ts` | `recordCampaignPerformance(orgId, ...)` |

### Enable/disable

```bash
# .env.local (development only — dev machine must be running Obsidian)
OBSIDIAN_ENABLED=true
OBSIDIAN_API_KEY=<from plugin settings>
OBSIDIAN_BASE_URL=http://localhost:27124
OBSIDIAN_VAULT_PATH=D:\ObsidianVault\Synthex

# Production (Vercel) — leave OBSIDIAN_ENABLED unset → all calls are no-ops
```

---

## MCP Servers (Development)

| Server     | Purpose                              | Config key                                   |
| ---------- | ------------------------------------ | -------------------------------------------- |
| `linear`   | Issue tracking, project management   | `enabledMcpjsonServers: ["linear"]`          |
| `obsidian` | Vault read/write during dev sessions | `mcpServers.obsidian` in settings.local.json |

### Obsidian MCP server setup

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uvx",
      "args": ["mcp-obsidian", "--vault", "D:\\ObsidianVault\\Synthex"],
      "env": { "OBSIDIAN_API_KEY": "<from plugin>" }
    }
  }
}
```

Requires: `pip install uv` or `winget install astral-sh.uv` — then `uvx mcp-obsidian` auto-installs.

### MCP channels (multi-agent)

Claude Code supports `--channels <name>` for isolated MCP communication between agents. Use when dispatching parallel subagents that must not share tool state. See `CONSTITUTION.md → Agent Execution Rules`.

---

## Web Search Enrichment

Enabled via `WEB_SEARCH_ENABLED=true` in env.

- **When:** Weekly deep auto-research runs only (not daily — cost control)
- **What:** Cross-references Apify scraped insights with live web search
- **Where:** `lib/auto-research/orchestrator.ts → webSearchEnrichment()`
- **Fallback:** If web search is disabled or unavailable, Apify data is used as-is

---

## Decision Matrix

| Task                     | Provider                  | Thinking         | Cache |
| ------------------------ | ------------------------- | ---------------- | ----- |
| Quick post variation     | OpenRouter / Haiku        | off              | no    |
| Standard social post     | OpenRouter / Sonnet       | off              | no    |
| Premium campaign (BYOK)  | Anthropic direct / Sonnet | `standard` (500) | yes   |
| Multi-step campaign (5+) | Anthropic direct / Sonnet | `deep` (4000)    | yes   |
| Flagship brand strategy  | Anthropic direct / Opus   | `opus` (16000)   | yes   |
| Image prompt refinement  | Anthropic direct / Sonnet | `standard` (500) | no    |
| Auto-research analysis   | OpenRouter / Sonnet       | off              | no    |
