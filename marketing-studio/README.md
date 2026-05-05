# marketing-studio

Substrate for the Marketing Skills Package. Templates, frameworks, scripts, and the per-job artifact tree. Skills are globally installed at `~/.claude/skills/marketing-*` and consume this substrate.

## Layout

```
marketing-studio/
├── templates/
│   ├── campaign-brief.md
│   ├── launch-runbook.md
│   ├── email-sequence.md
│   └── landing-spec.md
├── frameworks/
│   ├── jtbd-canvas.md
│   ├── positioning-canvas.md
│   └── icp-canvas.md
├── scripts/
│   └── utm-builder.ts
├── .research/
│   ├── campaigns/{jobId}/    — campaign-plan.md/.json + positioning.md
│   ├── icp/{slug}-{date}.md  — per-brand ICP research
│   ├── seo/{cluster}.md/.json
│   └── wave-plans/{jobId}.json
└── outputs/{jobId}/          — fallback when calling project has no .marketing/ dir
```

## Brand voice — single source of truth

The marketing pack reads brand voice / forbidden words / audience / tagline from the **shared** `@unite-group/brand-config` workspace package:

```
Synthex/packages/brand-config/src/brands/{slug}.ts
```

Both the marketing and remotion packs use the same brand data. To add or refine a brand, edit the brand-config source files directly or use the Remotion pack's `remotion-brand-research` + `remotion-brand-codify` skills — the change automatically applies to marketing.

## Calling the package from any project

From a Claude Code session in your project (e.g. `/Users/phill-mac/Synthex`):

> Use the Marketing Skills Package — full launch campaign for Synthex on LinkedIn, target ML platform teams, 30-day window.

Output lands in `<calling-project>/.marketing/`. Override with explicit `outputDir` if needed.

## UTM helper

```bash
cd /Users/phill-mac/Synthex/marketing-studio
npx tsx scripts/utm-builder.ts \
  --base=https://synthex.com/launch \
  --brand=synthex \
  --channel=linkedin \
  --medium=social-organic \
  --jobId=synthex-launch-2026-04-28 \
  --content=lp-1
# → https://synthex.com/launch?utm_source=synthex-linkedin&utm_medium=social-organic&utm_campaign=synthex-launch-2026-04-28&utm_content=lp-1
```

## Per-project keys

Each calling project supplies its own keys via its own `.env` / `.env.local`:

| Key | Used by | Behaviour if missing |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | copywriter, positioning, icp-research | Returns scaffolds, no fabricated copy |
| `PERPLEXITY_API_KEY` | icp-research, seo-researcher, positioning | Returns seed-only docs with "needs primary research" placeholders |
| `RESEND_API_KEY` / `MAILCHIMP_API_KEY` | (optional) actual email send | Skill produces drafts only |
| `LINEAR_API_KEY` | launch-runbook, campaign-planner ticket creation | Emits markdown checklists only |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | launch-runbook war-room | Skip pin |
| `GOOGLE_ANALYTICS_PROPERTY_ID` / `POSTHOG_API_KEY` | analytics-attribution | Spec emitted tool-agnostic |

No keys are required to scaffold — every skill degrades gracefully and emits the structural artifact even without LLM / API access.
