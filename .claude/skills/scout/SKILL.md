# Scout — AI Provider & Model Monitor

## Purpose

Scout monitors the AI provider ecosystem for Synthex. It detects approaching model retirements, alerts on model errors, and recommends fallback models to keep the platform running without interruption.

## When This Skill Applies

**Auto-trigger when:**
- An AI model call fails with a `model_not_found`, `deprecated`, or `invalid_model` error
- A model retirement date in `.claude/provider-registry.json` is within 14 days
- Asked to check if any models are nearing end-of-life
- Building any feature that hardcodes a model name (should use registry instead)

---

## Registry Location

```
.claude/provider-registry.json
```

Always read this file fresh — do not rely on cached knowledge of model names.

---

## Registry Structure

```json
{
  "version": "1.0.0",
  "lastUpdated": "YYYY-MM-DD",
  "models": {
    "<provider>": {
      "fast":     "<model-id>",
      "balanced": "<model-id>",
      "advanced": "<model-id>",
      "notes":    "<usage notes>",
      "retirements": {
        "<model-id>": "<YYYY-MM-DD retirement date>"
      }
    }
  },
  "scoutRules": {
    "triggerOnModelError": true,
    "maxAgeDays": 7,
    "alertOnRetirement": true,
    "retirementWindowDays": 14,
    "registryPath": ".claude/provider-registry.json"
  },
  "tierAccess": {
    "free":         ["openrouter"],
    "professional": ["openrouter", "anthropic", "openai"],
    "business":     ["openrouter", "anthropic", "openai", "google"],
    "custom":       ["openrouter", "anthropic", "openai", "google"]
  }
}
```

---

## Retirement Check Protocol

### Step 1 — Read Registry
```bash
cat .claude/provider-registry.json
```

### Step 2 — Identify Retirements
For each provider, check the `retirements` object.
Compare each date to today's date (format: `YYYY-MM-DD`).

### Step 3 — Classify by Urgency

| Days Until Retirement | Severity | Action |
|-----------------------|----------|--------|
| ≤ 7 days              | 🔴 Critical | Block deployment; update immediately |
| 8–14 days             | 🟡 Warning  | Flag in PR review; schedule update |
| 15–30 days            | 🔵 Info     | Note for awareness; plan migration |
| > 30 days             | ✅ OK       | No action required |

### Step 4 — Suggest Replacement

When a model is retiring, suggest the same-tier replacement from the **same provider first**, then cross-provider alternatives.

**Replacement lookup order:**
1. Same provider, same tier (e.g., `google.advanced` → check for updated `gemini-*-pro`)
2. Same tier, different provider (e.g., `openrouter.advanced` as OpenRouter passthrough)
3. One tier down from same provider (degrade gracefully)

---

## Model Error Response Protocol

When an AI call returns a model-related error (`model_not_found`, `deprecated_model`, `invalid_model`):

```
1. READ .claude/provider-registry.json
2. FIND the failing model-id in the registry
3. IDENTIFY which tier it is (fast / balanced / advanced)
4. SUGGEST the same-tier model from the same provider
5. If unavailable: suggest openrouter equivalent (openrouter supports all providers)
6. UPDATE the registry if a permanent replacement is confirmed
7. UPDATE lib/ai/providers/<provider>-provider.ts model presets
```

---

## Code Locations for Model Updates

When a model needs updating, check these files:

| File | What to update |
|------|----------------|
| `.claude/provider-registry.json` | Registry source of truth |
| `lib/ai/providers/openrouter-provider.ts` | OpenRouter model presets |
| `lib/ai/providers/anthropic-provider.ts` | Anthropic model presets |
| `lib/ai/providers/google-provider.ts` | Google model presets |
| `lib/ai/providers/base-provider.ts` | `ModelPresets` interface (if tiers change) |

**Never hardcode model IDs in feature code** — always use `ai.models.fast`, `ai.models.balanced`, or `ai.models.premium` via the `getAIProvider()` abstraction.

---

## BYOK Considerations

Users may supply their own API keys (BYOK). When a system model retires:
- The BYOK path is unaffected (users control their own model selections)
- Only the platform-level `getAIProvider()` singleton needs updating
- Alert Phill to check if the BYOK validation endpoint (`/api/onboarding/validate-key`) still accepts the old model ID as a test target

---

## Running the Automated Retirement Check

```bash
bash .claude/skills/scout/run.sh
```

Outputs a colour-coded retirement report. Run this:
- Before any deployment (`npm run release:check`)
- At the start of any session touching AI code
- Whenever a model error is observed in production logs

---

## Registry Update Procedure

When updating a model after retirement:

```bash
# 1. Update .claude/provider-registry.json
#    - Change the model-id for the affected tier
#    - Remove the retirement entry (or mark date as past)
#    - Update lastUpdated to today

# 2. Update the provider file
#    e.g. lib/ai/providers/google-provider.ts
#    Change readonly models.advanced = 'new-model-id'

# 3. Test the change
npm run type-check

# 4. Commit with the issue identifier
git add .claude/provider-registry.json lib/ai/providers/<provider>-provider.ts
git commit -m "fix(ai): update <provider> <tier> model post-retirement"
```

---

## Current Registry State (as at last update)

Refer to `.claude/provider-registry.json` for live state.

**Known upcoming retirements:**
- `google.gemini-3-pro-preview` → retiring **2026-03-09** (within 14-day window as of 2026-03-01)
  - Suggested replacement: `gemini-2.5-pro-preview-05-06` (already in `google.balanced`)
  - Update target: `lib/ai/providers/google-provider.ts` line for `advanced` preset

---

## Integration with Release Check

Add to pre-release workflow (`npm run release:check`):

```bash
bash .claude/skills/scout/run.sh || echo "⚠️  Scout: model retirement warnings found — review before deploying"
```

Scout exits with code 0 (OK) or 1 (warnings found).
