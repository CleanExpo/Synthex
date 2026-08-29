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

2026-08-29 · LOCKED · `ra-job-close-system-2026-08-29-01/sweep` · **Founder decision, 29/08/2026 — an explicit founder call on the three rendered boards, not an engine recommendation being rubber-stamped.** Stated reason: `sweep`'s signature is a composition rather than a figure, so it does not depend on a claim (PRINCIPLES.md line 1) — which matters for a brand carrying exactly two approved facts; and it is the only direction rendering `ra.ts` `motion.signature: 'sweep'` static, so the locked template propagates coherently into video. **The engine also recommended `sweep`, and that agreement is weak evidence, not confirmation:** the engine's recommendation rests on stage-1 self-scores only — the §9 stage-2 independent-context review never ran, in the design session or at lock. Every score in `critique.json` remains `[UNCONFIRMED]` by any reader who had not seen the build. Locking a variation does not change that.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **Warm earth `#8A6B4E` is a field colour, never a text colour or a text ground; accent tan `#D4A574` carries type only on the navy ground.** Measured from rendered pixels, not arithmetic: neutral-50 on `#8A6B4E` = 4.48:1 · navy on `#8A6B4E` = 2.81:1 · `#8A6B4E` on neutral-50 = 4.48:1 · neutral-500 `#78716C` on neutral-50 = 4.40:1 · tan on neutral-50 = 2.04:1 — all fail the §11 4.5:1 floor. Only navy↔neutral-50 (12.57:1) and tan-on-navy (6.17:1) pass. Four of RA's seven plausible text pairs fail, three of them by under 0.1, which is exactly the margin arithmetic intuition waves through. Use warm earth as a text-free field (a carbon strip, a wet line) and tan only as a CTA fill with navy type.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **`ra.design.md`'s type ramp cannot be scaled to a social box — it must be re-anchored.** The ramp is anchored to 1920×1080 video; scaling it to 1200 wide by width (×0.625) puts caption at 8px, roughly six times under the §11 floor. Re-anchor instead by reading §11's floor as a proportion of canvas width (hook 88/1080 = 8.15%, smallest text 44/1080 = 4.07%). At 1200 wide that is hook ≥ 98px and **every** other element ≥ 49px. The consequence binds copy, not just type: in a 627px-tall box only ~531px is usable, so a seven-word hook at 98px costs three lines and half the board. Landscape RA assets need four-to-six-word hooks.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **RestoreAssist has no logo asset and every board must compose without one.** `public/logos/` does not exist; `ra.ts` declares three RA logo paths, none present. Identify the brand with a caption-type eyebrow reading `RestoreAssist` — never `RA` (`ra.ts` doNot), never styled as a lock-up. Setting a wordmark in type and treating it as the logo is the failure mode to avoid; the fix is to commission the asset. Recorded as `missing-logo:ra` in every run manifest until it exists.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **A locked proportion is a proportion of the box it was locked in — check which axis it belongs to before carrying it.** The `sweep` line sits at 59.4% of height, locked on a 1200×627 landscape board. Carried literally onto the 1080×1440 and 1080×1920 funnel formats it stranded the tape in the middle of an empty light field with the support and CTA marooned ~400px below it — two competing voids with the message squeezed between them. Fixed by sizing the dry field to its content on any portrait box, so the tape sits one clearance above the bottom block and the wet field takes the rest. Only visible because §13 step 4 renders every funnel format and looks at it.

2026-08-29 · CONSTRAINT · `ra-job-close-system-2026-08-29-01` · **Where a run's prose and its board disagree about the signature, the pixels are the record.** `manifest.json` and `v3/tokens.json` describe the step riser as standing "one 56px gutter clear of the hook's longest line rather than at a fixed column"; the board's own source comment says "80.7% of width". Measured: the hook ends at x=802.4 and the riser is at 968, so 56px was the _constraint the column was checked against_, never the placement. Building the template from the prose alone would have moved the riser to 858 and silently broken the locked artefact. The template now applies the column first and the gutter as an override, and reproduces the lock byte-identically.
