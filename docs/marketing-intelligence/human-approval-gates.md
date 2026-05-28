# Human Approval Gates

> Status: ✅ `VERIFIED` design — reuses the **existing** Nexus pitch-03 §6 approval matrix and
> `Decisions/approvals_queue.md` mechanism. The system *prepares*; humans *approve*. Nothing in this
> system publishes a live site change autonomously.

## The one rule

> **No live website change publishes without a human approval, logged in the approvals queue.**

`approval_mode` (from `inputs.schema.json`) controls autonomy, but even `auto_low_risk` never publishes
content to a live site — it only auto-prepares drafts and auto-runs read-only/internal work.

## Gate matrix (marketing-intelligence specific)

| Action | Default | Approver | Why |
|--------|---------|----------|-----|
| Read-only ingest / crawl / score | Auto | — | Reversible, no external effect |
| Backlog (re)prioritisation | Auto | — | Internal only |
| Draft prepared to `Outcomes/synthex-content/` | Auto | — | Not live; awaits gate |
| **Publish content to a live site** | **Approval** | Phill / content owner | First external surface; brand + accuracy |
| **Publish YMYL claim** (RestoreAssist/DR/CARSI) | **Approval** | Phill (+ legal if requested) | Liability + E-E-A-T (R-YMYL-01) |
| **AEO/GEO schema test** | **Approval** | Phill | Schema-must-match-content (R-AEO-02); set kill threshold |
| **Bulk page generation** (>3 pages) | **Approval** | Phill | Thin-content classifier risk (R-SEO-01) |
| **Any external link acquisition campaign** | **Approval** | Phill | SpamBrain risk; only earned links (R-SEO-04) |
| **Change to scoring `Weights`** | **Approval** | Phill | Self-improvement charter — no self-deregulation |
| **Publish anything with a `DATA_REQUIRED` justification** | **Blocked** | — | Cannot act on placeholder data (R-DATA-01) |

## What every approval request carries

Reusing the `approvals` row shape from pitch-03:

```
action          e.g. content:publish_to_client_site
why_now         the verified claim + signal driving it
reversibility   reversible | low | medium | high | irreversible
risk_if_yes     e.g. brand-voice drift
risk_if_no      e.g. continued position decline
payload         the prepared draft + diff
validation      the signal + window + kill threshold
rollback_note   how to undo (git/CMS version)
```

## Brand + voice gate (before the approval queue)

Client-facing copy passes the existing `brand-voice-enforce` / `brand-consistency-checker` skills first
(the Brand Resonance gate in pitch-03). A draft that fails brand scoring never reaches the human queue —
it is rewritten or rejected automatically.

## Audit

Every gate decision writes a `nexus_audit` row (append-only) per pitch-03 §7 — actor, action, policy
level, approval id, result. No silent publishes.
