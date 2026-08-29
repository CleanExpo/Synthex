# RestoreAssist — taste log

Append-only. One line per lock or reject decision from `/lock`, each with the
**stated reason**. This is how judgement stops being a bottleneck and starts
compounding: the `synthex-design` skill reads this file at §2 and treats every
line as binding.

This is a decision log, **not** a performance loop. No outcome data exists —
nothing here says what converted, only what was chosen and why.

Format: `YYYY-MM-DD · LOCKED|REJECTED · <run-id>/<variation> · <reason>`

A `CONSTRAINT` line records something measured about the brand that binds every
future run regardless of which variation is chosen. It is not a founder
decision and never substitutes for one.

---

**No lock decision has been taken for RestoreAssist yet.** The first run,
`ra-job-close-system-2026-08-29-01`, is DRAFT. Its engine recommendation is
`sweep`, resting on stage-1 self-scores only — the §9 stage-2 independent-context
review could not run in that session, so the recommendation is `[UNCONFIRMED]`
by any reader who had not seen the build. Lock lines will be appended here when
`/lock` runs.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **Warm earth `#8A6B4E` is a field colour, never a text colour or a text ground; accent tan `#D4A574` carries type only on the navy ground.** Measured from rendered pixels, not arithmetic: neutral-50 on `#8A6B4E` = 4.48:1 · navy on `#8A6B4E` = 2.81:1 · `#8A6B4E` on neutral-50 = 4.48:1 · neutral-500 `#78716C` on neutral-50 = 4.40:1 · tan on neutral-50 = 2.04:1 — all fail the §11 4.5:1 floor. Only navy↔neutral-50 (12.57:1) and tan-on-navy (6.17:1) pass. Four of RA's seven plausible text pairs fail, three of them by under 0.1, which is exactly the margin arithmetic intuition waves through. Use warm earth as a text-free field (a carbon strip, a wet line) and tan only as a CTA fill with navy type.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **`ra.design.md`'s type ramp cannot be scaled to a social box — it must be re-anchored.** The ramp is anchored to 1920×1080 video; scaling it to 1200 wide by width (×0.625) puts caption at 8px, roughly six times under the §11 floor. Re-anchor instead by reading §11's floor as a proportion of canvas width (hook 88/1080 = 8.15%, smallest text 44/1080 = 4.07%). At 1200 wide that is hook ≥ 98px and **every** other element ≥ 49px. The consequence binds copy, not just type: in a 627px-tall box only ~531px is usable, so a seven-word hook at 98px costs three lines and half the board. Landscape RA assets need four-to-six-word hooks.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **RestoreAssist has no logo asset and every board must compose without one.** `public/logos/` does not exist; `ra.ts` declares three RA logo paths, none present. Identify the brand with a caption-type eyebrow reading `RestoreAssist` — never `RA` (`ra.ts` doNot), never styled as a lock-up. Setting a wordmark in type and treating it as the logo is the failure mode to avoid; the fix is to commission the asset. Recorded as `missing-logo:ra` in every run manifest until it exists.
