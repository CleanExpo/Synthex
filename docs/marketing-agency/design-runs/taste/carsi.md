# CARSI — taste log

Append-only. One line per lock or reject decision from `/lock`, each with the
**stated reason**. This is how judgement stops being a bottleneck and starts
compounding: the `synthex-design` skill reads this file at §2 and treats every
line as binding.

This is a decision log, **not** a performance loop. No outcome data exists —
nothing here says what converted, only what was chosen and why.

Format: `YYYY-MM-DD · LOCKED|REJECTED · <run-id>/<variation> · <reason>`

---

_(no decisions yet — the first `/lock` writes here)_
