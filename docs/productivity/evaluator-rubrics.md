# Synthex Evaluator Rubrics

Status: active planning rubric
Created: 24/06/2026

Principle: the generator does not mark its own work done. Evaluators grade against explicit criteria and return evidence-only verdicts.

## Verdict format

Every evaluator returns:

```text
VERDICT: PASS | REQUEST_CHANGES | BLOCKED
SCOPE_CHECK: in-scope | scope-creep-found
EVIDENCE: exact files/commands/lines inspected
FAILURES: bullet list or none
REQUIRED_FIXES: bullet list or none
RISK: low | medium | high
```

## 1. Security / authz evaluator

Use for API routes, auth, permissions, org scoping, webhooks, DB writes, and any external effect.

Pass criteria:

- Supabase-only auth preserved.
- User/org scoping is explicit.
- Mutations validate input.
- No secrets printed, stored, or committed.
- External URLs and webhooks fail closed.
- No new autonomous publish/deploy/DB side effect.
- Tests cover forbidden cross-tenant or unauthorised path where applicable.

Auto-fail:

- Cross-tenant read/write path.
- Public unauthenticated endpoint that can reach private resources.
- `.env*` read/write in repo changes.
- New provider/vendor without explicit approval.

## 2. PM completeness evaluator

Use for specs, roadmaps, Work Packets, and planning docs.

Pass criteria:

- Goal and why-now are clear.
- Owner, dependencies, due date/appetite, entry/exit criteria exist.
- WIP and CEO queue impact are stated.
- Blocked state is one of `ready`, `blocked-data`, `blocked-approval`, `blocked-security`.
- Priority uses impact, confidence, risk, and effort.
- No-gos are explicit.

Auto-fail:

- Broad theme without atomic next action.
- No owner or no exit criteria.
- `DATA_REQUIRED` item treated as executable.

## 3. Evidence quality evaluator

Use for research synthesis, source maps, wiki notes, and marketing intelligence.

Pass criteria:

- Each material claim has source path/URL.
- YouTube/influencer content is labelled `OPINION_SOURCE` unless verified elsewhere.
- Point-in-time scans are dated.
- Raw transcript/private data is referenced, not copied unnecessarily.
- Missing data is labelled `DATA_REQUIRED` after both source roots are searched.

Auto-fail:

- Fabricated metrics.
- “No source found” claim without searching both registered roots.
- Opinion used as verified fact.

## 4. Content originality / usefulness evaluator

Use for authority packets, social posts, campaign copy, and AI-citation content.

Pass criteria:

- Includes proof, opinion, experience, and trust inputs.
- Starts from a real customer/operator/sales situation.
- Makes one clear viewpoint or decision-useful claim.
- Has clear attribution and quotable sentences.
- Avoids generic trend summaries and thin AI filler.
- Public publish state remains gated.

Auto-fail:

- Generic content anyone could say.
- Unsupported YMYL or legal/financial claim.
- Publish-ready label without approval evidence.

## 5. UX / product evaluator

Use for dashboard, command-centre, approval, and status surfaces.

Pass criteria:

- User can see current state, next action, and blocker.
- Empty/loading/error/success states are honest.
- “Unknown” is shown when phase/progress is unknown.
- Approval gates are visible before side effects.
- No fake progress bars or fake health.

Auto-fail:

- Misleading “green” state without backing data.
- Button implies public publish when only queue approval exists.
- Raw JSON is dumped where a human decision surface is needed.

## 6. Ops / release readiness evaluator

Use before commit, push, PR, merge, deploy, or scheduled automation.

Pass criteria:

- Worktree scope is clean and staged files are exact.
- Full available local gate is green.
- PR/check status is current, not stale.
- Rollback and stop rule are known.
- Production-impacting action has explicit approval.

Auto-fail:

- P0/P1 ShipIt issue is open and the change increases blast radius.
- Tests/checks not actually run.
- Push/merge/deploy claimed without tool evidence.
