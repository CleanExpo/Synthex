# Cross-brand design principles

Append-only. Rules learned from runs that apply to **every** brand, not just the
one that produced them. The `synthex-design` skill reads this file at §2 before
the per-brand taste log, and treats every line as binding.

This is the general layer. `taste/<brand>.md` is the specific layer, and where
the two conflict **the brand's own log wins** — it is a judgement about that
brand, this file is a generalisation from others.

A line earns its place here only when it would have changed a decision on a
brand other than the one it came from. One line per rule, each naming the run
that produced it and the reason. Rules can be superseded by a later line; they
are never edited or deleted, so the reasoning stays legible.

Format: `YYYY-MM-DD · <rule> · <why> · <source run-id>`

---

2026-08-29 · **When a brand's claims are unsubstantiated, prefer a direction whose signature is a composition over one whose signature is a figure.** · A direction built on a number dies when the claim gate blanks it: `course-record`'s hero was the CEC-hours numeral set large, and with `facts_approved` empty it rendered `[NEEDS APPROVAL]`, leaving a void where the whole idea had been. A compositional signature survives an empty claims register intact. This applies to every brand today — `facts_approved` is empty for all of them, so any figure-led direction is currently a design betting on approval it does not have. · `carsi-iicrc-cec-courses-2026-08-29-01`

2026-08-29 · **Judge the rendered pixels, not the direction's description.** · The engine recommended `course-record` on the strength of its concept while the rendered board did not deliver that concept — the numeral was missing and a 300px void sat where it should have been. §8 says read the PNGs back; the failure mode is reading them and then still scoring the idea. If the manifest's `why` would still be true had the render failed, it is describing the direction rather than the board. · `carsi-iicrc-cec-courses-2026-08-29-01`

2026-08-29 · **A signature that assumes one canvas size is not yet a template.** · A locked board is only half a deliverable; the funnel suite spans 1200×400 to 1080×1920, and a fixed grid degenerates at the extremes — nine rows of tally marks became a 2px smudge. Before a template is trusted, every funnel format must be rendered and looked at, and the signature needs a stated rule for a much shorter or wider box, including hiding itself. · `carsi-iicrc-cec-courses-2026-08-29-01`

2026-08-29 · **Measure every text/ground pair from rendered pixels before assigning a colour to type; treat a brand's mid-tone secondary as a field colour until measurement says otherwise.** · RestoreAssist's warm earth `#8A6B4E` fails against BOTH its neighbours — neutral-50 on it 4.48:1, navy on it 2.81:1 — and four of the brand's seven plausible text pairs fail the §11 floor, three of them by **less than 0.1**. That is precisely the margin arithmetic intuition waves through, and a mid-tone secondary sits between two grounds so it reads as the obvious accent for type. Every portfolio brand has one, so this is not an RA quirk: CARSI's own locked pair passes at 4.88:1, a margin of 0.38, which would also have been unsafe to assume. The generalisation from RA is the method, not the hex — the hex stays in `taste/ra.md`. This extends the run-before-it line 2 sets: pixels beat the description for contrast as well as for composition. · `ra-job-close-system-2026-08-29-01`
