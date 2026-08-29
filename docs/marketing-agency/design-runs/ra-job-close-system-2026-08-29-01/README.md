# RestoreAssist — job-close system for water-damage tradies

**Run** `ra-job-close-system-2026-08-29-01` · **Status** DRAFT ·
**Locked** 2026-08-29 · **Winner** `sweep` (v3)

The second `/lock` in this repo, and the first for RestoreAssist.

## What is here

| Path                                            | What                                             |
| ----------------------------------------------- | ------------------------------------------------ |
| `manifest.json`                                 | Full run record, including the losing variations |
| `critique.json`                                 | Stage-1 self-critique — **stage 2 never ran**    |
| `sweep/board.html` · `tokens.json`              | The locked winner                                |
| `funnel/*.html`                                 | Seven funnel assets from the same tokens         |
| `copy.md`                                       | Every line of copy, with the voice check         |
| `public/marketing-agency/design-runs/<run-id>/` | The rendered PNGs                                |
| `../templates/ra/sweep.{html,tokens.json}`      | The reusable template and frozen theme           |

## Why this one won — and who decided

**This was a founder decision, not an engine recommendation being ratified.**
The founder viewed all three rendered boards on 29/08/2026 and chose `sweep`.

The engine also recommended `sweep`, but that agreement carries much less weight
than it appears to. The engine's recommendation rests on **stage-1 self-scores
only** — the builder scoring its own work. SKILL.md §9's stage-2
independent-context review **did not run** in the session that produced this
run: no in-process subagent dispatch existed, and the only other route would
have provisioned a fresh container that could not read PNGs living as
uncommitted files in the working tree. The dispatch payload is prepared verbatim
in `critique.json`.

So the lock does not convert an unconfirmed score into a confirmed one. Under
`.claude/rules/fabel-evidence-standard.md`:

- `[VERIFIED]` — the founder chose `sweep` after seeing the rendered boards.
- `[UNCONFIRMED]` — every numeric score in `critique.json`, still. No reader who
  had not seen the build has scored these boards, and locking one does not
  change that.

The stated reason for the choice is the one worth keeping: `sweep`'s signature
is a **composition** rather than a figure, so it does not depend on a claim
(`taste/PRINCIPLES.md` line 1 — and RA has exactly two approved facts). It is
also the only direction carrying RA's own declared motion signature
(`ra.ts` `motion.signature: 'sweep'`) rendered static, so a locked template
propagates coherently into video.

## The signature, and what it does at other sizes

The wet line is the tape mark a tech leaves on a wall where the water stopped.
`taste/PRINCIPLES.md` line 3 requires a signature to have a stated rule for a
much shorter or wider box **including hiding itself**, and requires every funnel
format to be rendered and looked at before the template is trusted. Both were
done; the rule is executable in `../templates/ra/sweep.html` rather than only
described.

| Format        | Canvas    | Line y | Step | Riser | Behaviour                                              |
| ------------- | --------- | ------ | ---- | ----- | ------------------------------------------------------ |
| linkedin_post | 1200×627  | 372    | 45   | 968   | the locked board                                       |
| landing-hero  | 1600×900  | 535    | 65   | 1291  | proportional, unchanged                                |
| post-2/3/4    | 1080×1440 | 1232   | 104  | 871   | portrait — dry field sized to content                  |
| story         | 1080×1920 | 1605   | 138  | 871   | portrait, plus §11's centre-1610 story safe area (155) |
| og-image      | 1200×630  | 374    | 45   | 968   | proportional                                           |
| email-header  | 1200×400  | 303    | 29   | 968   | empty dry field — line sized to content, not 59.4%     |

Three findings came out of rendering these rather than reasoning about them.

**1 — the 59.4% proportion is a landscape proportion.** Carried literally onto
1080×1440 it stranded the tape in the middle of an empty light field with the
support and CTA marooned another 400px below: two competing voids with the
message squeezed between them, which is the same degeneration PRINCIPLES line 3
records for the CARSI tally field. On a portrait box the dry field is now sized
to what it holds — the tape sits one clearance above the bottom block, the wet
field takes the rest, and the composition stays the one that was locked.

**2 — the manifest and the board disagreed about the riser.** The manifest and
`tokens.json` say the riser "stands one 56px gutter clear of the hook's longest
line rather than at a fixed column"; the board's own source comment says "80.7%
of width". The pixels settle it: the hook ends at x=802.4 and the riser is at
968, so 56px was the **constraint the column was checked against**, never the
placement. Implementing the manifest's wording alone would have moved the riser
to 858 and broken the locked artefact. The template does both, in that order —
the locked column, pushed right only if it would come within a gutter of the
hook — so the lock reproduces exactly and the collision guarantee is real at
every other measure.

**3 — the flatten rule is unreachable at 1200 wide.** The stated rule flattens
the step below a 24px depth. Because the ramp is derived from width, a 1200-wide
board carries a 98px hook, and no box short enough to flatten (H < 333) has room
for that hook plus a line — so the _hide_ rule fires first. Verified: 1200×320
and 1200×240 both hide the line and fall back to a flat navy field with the hook
reversed out. The flatten path is real but only on narrower canvases — verified
at 600×300, which renders a straight full-bleed line with no riser.

## Known weaknesses in the rendered set

- The **story** (1080×1920) carries roughly 1200px of unbroken navy between the
  hook and the line. It reads as deliberate negative space rather than an error,
  but it is the weakest board in the suite and the one to revisit first if a
  story is actually needed.
- The **email header**'s dry field is empty below the line — faithful to the
  concept, since the dry side is the side with nothing on it, and it sits above
  light email body content. It was 130px of nothing in a 400px banner; the
  content-sizing rule now also fires on a landscape box with an empty bottom
  block, which takes it to 97px. The rule matters more than this 33px: the
  orientation test alone let a landscape board keep a proportion derived from a
  filled dry field, and on a taller box — 1600×900 with no support or CTA — that
  leaves ~40% of the canvas holding nothing, which is exactly why CARSI's `ma`
  board was rejected. Only visible because §13 step 4 renders every format and
  looks at it.
- The stage-1 critique's own note stands: at LinkedIn mobile scale the 10px
  riser renders about 3px and the step reads as a soft jog rather than a taped
  mark. Nothing in this lock addressed that.

## Known gaps

- `missing-logo:ra` — `public/logos/` does not exist; `ra.ts` declares three RA
  logo paths, none present. Every board composes without a logo and identifies
  the brand with a caption-type eyebrow reading `RestoreAssist` — never `RA`
  (`ra.ts` `doNot`), never styled as a lock-up. The fix is to commission the
  asset, not to set a wordmark in type and call it the logo.
- `missing-consumer:design_runs` — see below.

## Deviations from the CARSI precedent

- The promoted board references its fonts by **relative** path
  (`../../../../../public/fonts/ra/…`); CARSI's promoted board and template use
  an absolute `file:///home/user/Synthex/…`, which only resolves inside the
  container that produced it. The template keeps CARSI's `REPO_ROOT` placeholder,
  because a template is filled from arbitrary locations and cannot use a
  relative path.
- The email header is exported at 2× (2400×800) per §11. CARSI exported it at 1×.

## What was NOT written

No `design_runs` table is applied and no Linear task was created (Linear MCP not
authorised). The index row in `docs/marketing-agency/design-runs/README.md` is
the only consumer of this manifest. Nothing was published, posted or scheduled —
the engine has no publish path, and everything here remains DRAFT.

## Claim correction — 29/08/2026, after the lock

The locked board and four funnel formats originally carried
`Free 15-day trial, including 50 inspection report credits`. **That claim has
been withdrawn from every board in this run** and replaced with
`Built for restoration work across Australia and New Zealand`.

Review on [#928](https://github.com/CleanExpo/Synthex/pull/928) flagged that the
trial claim omitted a material cost, and checking the source proved it right:
<https://restoreassist.app/pricing> states that "Report generation on every plan
— including your free trial — runs on your own Anthropic or OpenAI API key",
billed separately by the provider, and /signup states "An Anthropic or OpenAI
API key is required to operate RestoreAssist. You pay providers directly, at
cost."

A trial advertised as free while the customer must supply and pay for a
third-party API key is a material omission. The register's approved string now
carries that qualification inline, which makes it 108 characters — too long for
a support line at the 49px floor. `ra.claims.md` states the rule for exactly
this case: **drop the claim from the board, never the qualification from the
claim.** So the boards took the AU/NZ fact instead, which is self-sufficient at
board size.

The composition is unchanged — this is a copy swap inside the locked signature,
not a re-lock. The support line wraps naturally rather than on an authored
`<br>`; the authored break left "Zealand" as a widow on a third line.

The claim's final wording is the founder's, not this run's. It is marked
`review_required: founder-wording` in `ra.claims.md`.
