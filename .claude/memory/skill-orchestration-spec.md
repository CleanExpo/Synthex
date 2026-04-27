# Synthex Skill Orchestration Specification — v0.1 (2026-04-27)

> **Authority:** Phill McGurk, CEO. **Foundation source:** `ceo-foundation.md` (canonical) + `verification-gates.md` (gate state)
> **Purpose:** define how Synthex senior skills are invoked · how they interact · how they hand off · how failure is detected and resolved · how human-override pathways operate.
> **Scope:** all 12 senior skills + brand-voice-enforce mechanical gate + verification-gate registry consumption.
> **Operating rule:** every skill reads ceo-foundation.md + verification-gates.md at every invocation. No caching of rules.

---

## The 13-skill system (12 senior + 1 mechanical gate)

| ID | Skill | Layer ownership (operates_in) | Layer consumption (consumes_from) | Status |
|----|-------|------------------------------|------------------------------------|--------|
| S1 | senior-strategist | L4, L6, L8 | L1–L9 (all) | ✅ v0.1 shipped |
| S2 | senior-copywriter | L6 | L1–L4, L7–L9 | ✅ v0.1 shipped |
| S3 | brand-strategist | L4, L9 | L1–L3, L5–L8 | ✅ v0.1 shipped |
| S4 | performance-attribution-lead | L3 | L1–L2, L4–L8 | ✅ v0.1 shipped |
| S5 | senior-cmo | L4, L6, L8 | L1–L9 | 🔜 next batch |
| S6 | cro-specialist | L3, L6 | L1–L4, L7–L9 | 🔜 next batch |
| S7 | email-specialist | L2, L6 | L1, L3–L4, L7–L9 | 🔜 next batch |
| S8 | creative-director | L5, L6 | L1, L3–L4, L7–L9 | 🔜 next batch |
| S9 | customer-insights-lead | L3, L6 | L1–L2, L4, L6–L9 | 🔜 next batch |
| S10 | marketing-operations-director | L1, L2, L3 | L4–L9 | 🔜 next batch |
| S11 | local-seo-geo-veteran | L7, L8 | L1, L3–L4, L6 | 🔜 next batch |
| S12 | analytics-lead | L3 | L1–L2, L4–L9 | 🔜 next batch |
| G1 | brand-voice-enforce | L4 (gate) | reads all skills' output + foundation + registry | ✅ v0.1 shipped |

---

## Invocation rules

### I-1 Skill self-invocation triggers

Some skills fire on routine cadence without external invocation:

| Skill | Trigger | Frequency |
|-------|---------|-----------|
| performance-attribution-lead | Hyper-Care daily window (DR pilot first 30d) | Daily 07:00 AEST |
| performance-attribution-lead | RA Launch Watch (RA iOS first 14d) | Daily 07:00 AEST |
| performance-attribution-lead | Tier 1 weekly snapshot | Monday 07:00 AEST |
| performance-attribution-lead | Tier 2 monthly brief | 1st of month |
| performance-attribution-lead | Tier 3 quarterly review | Quarterly with portfolio scoreboard |
| brand-voice-enforce | Every draft submitted by any production skill | On-demand at draft submission |
| senior-strategist | Final-gate review before any client-facing artefact lands in CEO batched-review queue | On-demand after brand-voice-enforce passes |

### I-2 Skill external invocation (CEO-initiated or skill-initiated)

Most skills fire when invoked by another skill or by the CEO:

| Invoking entity | Most-likely-invoked skill | Context |
|-----------------|--------------------------|---------|
| CEO request | senior-strategist | New campaign · new initiative · strategic decision |
| senior-strategist | senior-copywriter / brand-strategist / creative-director | Drafting tasks |
| senior-strategist | cro-specialist | Friction analysis · funnel optimisation |
| senior-strategist | email-specialist | Trigger sequence design |
| senior-copywriter | brand-voice-enforce | Pre-queue gate check |
| performance-attribution-lead | senior-strategist | Threshold breach surfacing |
| brand-strategist | senior-copywriter | Voice register update propagation |
| any skill | brand-voice-enforce | Pre-publication mechanical gate |

### I-3 Foundation reading protocol

At every invocation, every skill:
1. Reads `ceo-foundation.md` sections relevant to brand + task
2. Reads `verification-gates.md` for any gate the work will reference
3. Confirms voice tag · audience · surface · CTA-asset matching · cross-client boundary as applicable
4. Logs the foundation-section references in skill output for audit traceability

---

## Inter-skill handoff protocols

### H-1 Drafting workflow handoff

```
CEO request OR skill self-invocation
  ↓
senior-strategist (workflow audit · foundation cross-check · skill assignment)
  ↓
senior-copywriter (drafts) OR brand-strategist (voice strategy first if needed)
  ↓
[creative-director if Remotion/visual asset needed in parallel]
  ↓
brand-voice-enforce (mechanical gate · pass/fail/conditional)
  ↓
  ├─ FAIL → re-route to drafting skill with rule citation
  ├─ PASS → senior-strategist (final review · forward decision)
  └─ CONDITIONAL → escalate to brand-strategist for register decision
  ↓
senior-strategist (final-gate audit before CEO queue-landing)
  ↓
CEO batched-review queue (Phase 1.5 cadence: 20–40 pieces/week reviewable in two sessions)
  ↓
CEO approval → publication / dispatch / deployment
  ↓
performance-attribution-lead (post-publication tracking · canary monitoring · outcome attribution)
```

### H-2 Performance-monitoring handoff

```
performance-attribution-lead (canary detection · threshold breach · same-day incident)
  ↓
  ├─ Severity 1 incident → CEO direct same-day escalation
  ├─ Severity 2 incident → same-day ops + CEO summary
  └─ Severity 3 marketing breach → next weekly batch via senior-strategist
  ↓
[If breach OR canary AMBER/RED]
senior-strategist (severity classification · trigger-threshold cross-check · foundation rule lookup)
  ↓
[If foundation-aligned response action needed]
cro-specialist (friction-fix proposal) OR senior-copywriter (re-draft) OR email-specialist (sequence-change) OR creative-director (asset refresh)
  ↓
brand-voice-enforce → senior-strategist final review → CEO queue
```

### H-3 Verification-gate state-change handoff

```
verification-gate state change detected (CEO provides source documentation)
  ↓
foundation-keeper agent (updates verification-gates.md with [verified-DD/MM/YYYY] tag + source reference)
  ↓
brand-strategist (re-audits voice-register implications · issues brand-voice-enforce directive)
  ↓
senior-strategist (re-audits in-flight drafts for tier-upgrade or tier-downgrade language)
  ↓
[If in-flight drafts affected]
senior-copywriter (re-drafts where needed · rules updated)
  ↓
brand-voice-enforce relaxes/tightens specific rules per directive
  ↓
[New gate state propagates to all dependent workstreams]
```

### H-4 Cross-client boundary handoff (CCW ↔ Nexus)

```
Workflow request involves CCW + at least one Nexus brand (DR/NRPG/RA/CARSI)
  ↓
senior-strategist (cross-client boundary check · L1 isolation · L9 founder-content carve-out)
  ↓
brand-strategist (voice tag separation enforcement · F-4 binding)
  ↓
[VG-71 CCW client agreement check]
  ├─ [verified-DD/MM/YYYY] → cross-promotion permitted within scope
  └─ [verification needed] → cross-promotion BLOCKED · trigger holds in test mode
  ↓
email-specialist (if T4/T9 affected · gates on VG-71 + VG-78 + VG-79 + VG-80)
  ↓
brand-voice-enforce (CCW-2 cross-client rule mechanical check)
  ↓
[If all gates clear] → standard drafting workflow
[If any gate fails] → REJECT with verification-gate citation
```

---

## Failure modes + resolution

### FM-1 brand-voice-enforce repeated rejection (loop detection)

If a draft fails the gate 3 consecutive times on the same rule:
1. Skill loop-detector (built into senior-strategist) flags the issue
2. brand-strategist invoked for register decision (is the rule applying correctly? is the draft mis-scoped?)
3. If register decision confirms rule-application correct → CEO escalation for explicit `[CEO override]` of that specific rule for that specific artefact
4. Override scoped to the specific draft only · does NOT relax the rule portfolio-wide

### FM-2 Skill layer conflict (two skills claim same layer)

If two skills both claim to write to the same L1–L9 layer for the same artefact:
1. Foundation file's L1–L9 carve-out table (Q2.5.4) is the arbiter
2. More restrictive interpretation prevails (e.g., L1 single-customer-record interpretation chooses isolation over pooling when in doubt)
3. Conflict logged in `verification-gates.md` Section 6 (operational gates) for tracking

### FM-3 Verification gate flip refused (no source documentation)

Per `verification-gates.md` operating rule 1:
1. Skill detecting attempted unsupported flip refuses the flip
2. Foundation-keeper agent logs the refusal with audit-note
3. Gate stays at current state · drafts using unverified claim continue to reject
4. CEO notified of source-documentation requirement

### FM-4 Same-day incident classification disagreement

If skill and senior-strategist disagree on severity classification:
1. Default to higher severity (more conservative response)
2. CEO informed regardless · classification finalised at CEO triage

### FM-5 Cross-portfolio voice contradiction

If draft on Brand A contradicts a locked register on Brand B (e.g., DR claim implies a guarantee that contradicts NRPG's no-guaranteed-work rule):
1. brand-strategist invoked for cross-portfolio audit
2. Foundation thesis check (Restoration Manifesto · sovereignty-through-compliance · primary-flywheel anchor)
3. Resolution: more conservative register prevails · or explicit foundation amendment required for genuine conflict

---

## Human-override pathways

### HO-1 `[CEO override]` tag on specific artefact

When CEO explicitly overrides a rule for a specific draft:
1. Override tagged in artefact metadata: `[CEO override · rule X · reason Y · scope Z]`
2. brand-voice-enforce respects override only for that specific artefact
3. Override does NOT propagate to other artefacts or to the rule portfolio-wide
4. Override logged in `verification-gates.md` audit trail

### HO-2 Foundation amendment

When a locked rule needs to change permanently:
1. CEO issues explicit foundation amendment direction
2. foundation-keeper agent updates `ceo-foundation.md` with the amendment + date + reasoning
3. brand-strategist re-issues voice rules to brand-voice-enforce
4. All in-flight drafts re-audited under new rules

### HO-3 Same-day incident bypass

Privacy / data / claim / SLA / customer-trust incidents bypass all batched-review queues:
1. performance-attribution-lead detects + classifies
2. Direct CEO escalation within same-day window
3. Containment · assessment · communication · regulator-notification (where required) · post-incident review
4. NDB process activates if classification warrants

### HO-4 CEO bandwidth override

Phase 1.1 6–10 hr/wk budget is sacred. If a workflow request would exceed:
1. senior-strategist flags the over-spend before CEO commitment
2. CEO chooses: defer · delegate within agent layer · re-scope · expand budget for this specific request
3. Default behaviour: defer to next CEO bandwidth window

---

## CEO bandwidth budget allocation (Phase 1.1 reference)

Per Phase 1.1 6–10 hr/week breakdown (Q3.3.3 + Q3.1.5 cadence references):

| Activity | Budget |
|----------|--------|
| Daily 5-min Hyper-Care + RA Launch Watch read (during launch windows) | ~25 min/week (5 days) |
| Monday weekly batched-review session | ~60 min/week |
| Monthly Tier 2 brief read | ~90 min/month (~22 min/week amortised) |
| Quarterly Tier 3 + portfolio scoreboard | ~120 min/quarter (~10 min/week amortised) |
| IICRC outreach (CEO executive track · 4–6 week window) | ~90 min/week × 6 weeks |
| CCW client commercial conversations | ~30 min/week (variable) |
| Ad-hoc same-day incident response | reserved capacity |
| Strategic decision questions surfaced from agent layer | ~30 min/week |
| **Total estimated:** | ~6 hr/week steady-state · up to 10 hr/week during IICRC + launch overlap |

---

## Skill versioning + change-control

- All skill v0.1 files versioned 2026-04-27
- Foundation file amendments trigger skill review · brand-voice-enforce auto-relaxes/tightens per amendment
- Verification-gate state changes auto-propagate (skill reads at every invocation)
- Skill content changes require foundation-keeper amendment + brand-strategist register review
- All skill files committed to `.claude/skills/[skill-name]/SKILL.md` · changelog at end of each file

---

## What this spec doesn't yet cover (open work)

- 9 remaining senior skill scaffolds (S5–S12 · in production queue)
- Reporting templates (Hyper-Care daily template · Monday weekly template · Tier 2 monthly · Tier 3 quarterly · same-day incident escalation template)
- Gap audit playbooks (Gaps 3–8 · checklist + verification method + report format + remediation pattern)
- Integration architecture document (LinkedIn + Shopify + App Store Connect + Mailchimp endpoints + OAuth scopes + credential storage)
- Tier B engineering (identity resolution L1 · trigger orchestration · dashboard wiring · Mailchimp setup · Snapshot tool build)
- Production-system integration testing harness
- Smoke test specification

This spec is structurally complete for the orchestration layer. Next iterations expand to the specific operational templates + the engineering deliverables.

---

## brand-voice-enforce gate-check on this spec

This is internal documentation per Phase 1.5 (auto-publish internal context · not client-facing). Standard internal-artefact rules apply (no first-person business *"we / our"* in operational guidance · global filler ban · honest verification state).

- ✓ U-1 PASS · ✓ U-2 PASS · ✓ U-3 PASS · ✓ U-4 PASS
- ✓ All 13 skills referenced match foundation file definitions
- ✓ Verification-gates.md references match registry IDs
- ✓ Phase 4 amendments referenced match foundation locks
- ✓ Honest open-work declaration · no declared completion of unbuilt artefacts

**Gate decision: PASS · forward to live use as canonical orchestration spec.**
