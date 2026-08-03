# Synthex Social Pipeline — v0

Seven prompts, restructured as a pipeline. Each node has a bounded job, an input it reads
explicitly, and an output shape the next node consumes without a human in between.

Companion to `synthex-prompt-library.md` (image and motion archetypes). This file covers
strategy and copy.

## Why not a prompt pack

The original set is a chain wearing seven hats. Strategy produces the positioning that
pillars need; pillars produce the themes the calendar needs; the calendar produces the
slots that post copy needs. Stored as seven independent prompts, every one re-asks for
context the previous step already generated, and the user pastes their business
description seven times.

Three changes were made:

- **Grounding moved to a stored object.** `BRAND_CONTEXT` is written once per client and
  read by every node. No node asks the user to describe the business.
- **Output contracts added.** Free text between nodes means a human parses every handoff.
- **Role-play preambles removed.** "Act as a top-tier community manager who handles
  accounts for major brands" narrows the exploration space without adding capability.
  Describe the job and the constraints; the model does not need a costume.

Hooks and captions delegate to `nexus-copywriter` rather than being reimplemented here.

---

## Node 0 — BRAND_CONTEXT (stored, not generated)

Written once per client, versioned, read by every downstream node. This is the grounding
record. It is not a prompt.

```
BRAND_CONTEXT {
  client:         string            // CARSI, NRPG, Disaster Recovery, RestoreAssist…
  offer:          string            // what is actually sold
  audience:       string            // who buys, in their own words
  audience_pain:  string[]          // problems they'd name unprompted
  proof:          string[]          // credentials, case outcomes, accreditations
  voice:          string            // register, forbidden phrasing, AU/UK spelling
  platforms:      string[]          // where this client actually posts
  constraints:    string[]          // regulatory, insurance, professional-body limits
}
```

*Note: `constraints` is not optional for the Unite-Group brands. Restoration and training
content sits close to insurance and accreditation claims. A pillar that implies a coverage
outcome or an accreditation the client does not hold is a liability, not a miss.*

---

## Node 1 — Strategy

**reads:** `BRAND_CONTEXT`
**outputs:** `STRATEGY`

> Build a social strategy for the brand described in the attached context. Establish
> positioning against `{{COMPETITORS}}`, the specific audience segments worth addressing,
> what this brand can credibly say that others cannot, and the growth opportunities
> visible in that gap. Work only from the supplied context and the competitor material —
> do not assume industry facts not present in either.

```
STRATEGY {
  positioning:     string
  segments:        [{ name, motivation, objection }]
  differentiators: string[]     // each traceable to BRAND_CONTEXT.proof
  opportunities:   [{ description, rationale, platform }]
}
```

*The traceability rule on `differentiators` is what stops the model inventing strengths.
Anything not grounded in stated proof gets dropped at validation.*

---

## Node 2 — Content pillars

**reads:** `STRATEGY`, `BRAND_CONTEXT`
**outputs:** `PILLARS`

> Define five content pillars for this brand. Each pillar must map to a stated audience
> segment and a stated differentiator. For each, give the pillar's promise to the reader,
> what it deliberately excludes, and eight post concepts spanning educate, demonstrate,
> and challenge.

```
PILLARS [{
  name:        string
  promise:     string
  excludes:    string          // what this pillar is NOT, to stop drift
  segment_ref: string
  concepts:    [{ concept, intent: educate|demonstrate|challenge }]
}]
```

*`excludes` is the field that keeps pillars distinct after fifty posts. Without it they
converge and you get five names for one pillar.*

---

## Node 3 — Calendar

**reads:** `PILLARS`, `BRAND_CONTEXT.platforms`
**outputs:** `CALENDAR`

> Produce a 30-day calendar drawing on the supplied pillars. Distribute across pillars
> without repeating a concept. Assign each slot a format appropriate to its platform and
> a single objective. Cluster related posts so the month reads as a sequence rather than
> thirty unrelated items.

```
CALENDAR [{
  day:       1-30
  pillar_ref: string
  concept_ref: string
  platform:  string
  format:    carousel|reel|short|thread|single|story
  objective: visibility|engagement|lead|authority
}]
```

*One objective per slot. A post asked to do two things does neither, and the copy node
downstream has no way to resolve the conflict.*

---

## Node 4 — Post copy *(fan out, one per slot)*

**reads:** one `CALENDAR` slot, its `PILLARS` entry, `BRAND_CONTEXT`
**outputs:** `POST`
**delegates:** hook and CTA to `nexus-copywriter`

> Write the post for this slot. Open with a hook that earns the second line. Deliver the
> concept's value in plain language at the reading level of the stated audience. Close
> with a call to action matching the slot's objective — visibility asks for a share,
> engagement asks a question the reader has an answer to, lead asks for a next step.
> Respect the voice and constraints in the context.

```
POST {
  hook:      string
  body:      string
  cta:       string
  format_notes: string        // carousel slide breaks, thread splits
}
```

*This node and the original prompt 5 were the same job with a format parameter. Merged.
`format: reel|short` routes to the script shape below; everything else produces prose.*

**Script variant** — when `format` is `reel` or `short`:

```
POST {
  hook:       string          // spoken, first 2 seconds
  beats:      [{ line, visual }]
  cta:        string
  runtime_s:  number
}
```

---

## Node 5 — Engagement layer

**reads:** `PILLARS`
**outputs:** `ENGAGEMENT`

> For each pillar, produce conversation starters, comment prompts, and community tactics
> that fit that pillar's promise. Prompts must be answerable by someone who has not read
> anything else from this brand.

```
ENGAGEMENT [{
  pillar_ref: string
  starters:   string[]
  prompts:    string[]
  tactics:    [{ tactic, cadence }]
}]
```

*The answerable-cold rule is the difference between a comment prompt and a question only
an existing follower can answer.*

---

## Node 6 — Performance review ⚠ ANCHOR REQUIRED

**reads:** real platform analytics + published `POST` records
**outputs:** `REVIEW`
**status:** DO NOT SHIP until the analytics input is wired

> Analyse the attached performance data against the posts that produced it. Identify which
> pillars, formats, and objectives outperformed, and which underperformed. Attribute each
> conclusion to specific rows in the data. Where the data is insufficient to support a
> conclusion, say so rather than inferring.

```
REVIEW {
  findings:   [{ claim, evidence_rows: string[], confidence }]
  changes:    [{ change, rationale, expected_effect }]
  insufficient: string[]     // questions the data cannot answer
}
```

**This is the node that must not run on vibes.** Asked to "review my recent posts and
identify what works best" without attached metrics, the model will produce a fluent,
confident, entirely invented analysis — and it will be indistinguishable in tone from a
real one. That is the single highest-risk output in this pipeline, because it is the one a
client would act on.

`evidence_rows` is the anchor. Every finding must point at data the model did not author.
A finding with an empty `evidence_rows` is dropped, not softened.

Until platform analytics are connected, this node stays disabled. A missing performance
review is a visible gap; a fabricated one is not.

---

## The shape

```
BRAND_CONTEXT ──> STRATEGY ──> PILLARS ──┬──> CALENDAR ──> [fan out] POST × 30
                                          │
                                          └──> ENGAGEMENT

published POSTs + real analytics ──> REVIEW ──> (feeds next STRATEGY)
```

Node 3's fan-out is the only real parallelism — thirty posts have no dependency on each
other and should not run in a line. `ENGAGEMENT` and `CALENDAR` are independent of each
other and both read `PILLARS`, so they run at once.

The `REVIEW → STRATEGY` edge is what makes it a system rather than a one-shot. It is also
the edge that stays broken until node 6 has its anchor.

---

## Gaps in v0

1. **No analytics connector.** Node 6 is specified and disabled. This is the highest-value
   thing to build next — without it the loop does not close.

2. **No approval gate.** Verified in this repo at `main` (`4fec22aa2`):
   `lib/marketing-agency/full-campaign-generator.ts:644-649` emits

   ```ts
   approval: {
     status: 'approved',
     humanApproved: true,
     approvedBy: 'Codex execution agent',
     approvedAt: input.generatedAt,
   },
   ```

   `humanApproved` is a hardcoded literal and `approvedBy` names a machine as the human.
   The adjacent `evaluation` block (`:650-660`) is likewise nine hardcoded scores —
   `evidenceQuality: 86`, `accuracy: 86`, `approvalReadiness: 82` — none measured.

   This matters because the gate is real: `campaign-authority-manifest.ts:265` and `:304`
   both refuse on `manifest.approval?.humanApproved !== true`. The generator does not
   bypass the gate; it hands it a pre-satisfied token. `authority-approval.ts:37` does the
   same on its own path.

   Wiring this pipeline into autonomous runs before that is fixed would produce
   client-facing copy that self-certifies as reviewed. Treat it as a blocker, not a note.

3. **No claim validation against `constraints`.** A node that checks generated copy against
   the client's regulatory and accreditation limits before it reaches a human. For the
   restoration brands this should arrive before volume does.

4. **No per-platform voice variance.** One `voice` field currently serves every platform.
