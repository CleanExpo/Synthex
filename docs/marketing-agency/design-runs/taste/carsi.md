# CARSI — taste log

Append-only. One line per lock or reject decision from `/lock`, each with the
**stated reason**. This is how judgement stops being a bottleneck and starts
compounding: the `synthex-design` skill reads this file at §2 and treats every
line as binding.

This is a decision log, **not** a performance loop. No outcome data exists —
nothing here says what converted, only what was chosen and why.

Format: `YYYY-MM-DD · LOCKED|REJECTED · <run-id>/<variation> · <reason>`

---

2026-08-29 · LOCKED · `carsi-iicrc-cec-courses-2026-08-29-01/calibration-field` · Chosen over the engine's own recommendation. `course-record`'s signature was the CEC-hours numeral as a graphic; with `facts_approved` empty it rendered `[NEEDS APPROVAL]` and the direction lost its hero element. `calibration-field`'s idea is compositional rather than factual, so it survives an empty claims register. **Rule for future CARSI runs: when claims are unsubstantiated, prefer a direction whose signature is a composition over one whose signature is a figure.**

2026-08-29 · REJECTED · `carsi-iicrc-cec-courses-2026-08-29-01/course-record` · Strongest contrast in the set (11.75:1) and the most patient hook, but the design depends on a number the brand cannot print. Revisit only if a printable figure is ever substantiated.

2026-08-29 · REJECTED · `carsi-iicrc-cec-courses-2026-08-29-01/ma` · Most on-voice, and the only board using blue exactly as `carsi.design.md` documents it. Rejected because the lower 45% of the canvas reads as unfinished rather than as intentional negative space — _ma_ needs a weighted element holding the void open, and there was none.
