# The Invisible Line — 90-Second Anthem (Production Spec)

**Date:** 2026-06-11
**Status:** PRODUCED FILM RENDERED 2026-06-12 → `out/invisible-line-FINAL.mp4` (1920×1080 h264+aac, 67.7s, 32MB). Full cinematic cut: per-act fal-generated photographic backgrounds with Ken Burns motion + legibility/grade overlays, kinetic typography, 7-segment ElevenLabs VO in sync, and an ElevenLabs 68s music bed mixed at 0.24 under the narration. Composition `InvisibleLineAnthem` (cinematic upgrade commit 4300b0b9). Visually verified frame-by-frame: Act I floodwater, Act III PPE+thermal "we measure", Act IV HEPA/containment HUD, Act V tablet data panel, Act VI warm sanctuary, three-logo outro — all reading well, text legible, thermal-blue→warm grade cohesive.

**Assets** (committed for reproducibility): `public/invisible-line/` — 6 stills (flux schnell via fal), 7 VO mp3s + 1 music.mp3 (ElevenLabs). Render recipe: see [[remotion-local-render]].

**Known polish notes (for Phill's eye):** Act V data panel has empty space below the readouts at mid-act (chain-of-custody rows animate in later); outro CTA sits lower-third, separate from the centred logo lockup — both intentional but tunable. Still pending for a true broadcast master: real logo SVGs (currently typographic), optional licensed/live footage for the human/equipment beats, music-to-act-beat fine sync.
**Campaign:** RestoreAssist / NRPG / DisasterRecovery.com.au — hero anthem
**One-line:** Insurance companies pay the bill, but only environmental scientists restore your home.

---

## Creative vision (locked)

- **Aesthetic:** Cinematic realism. Volumetric lighting (visible dust/spores in light shafts). Stark contrast between chaotic "rip-and-replace" builder model and the clean, precise world of the True Professional Restorer.
- **Tone:** Authoritative, clinical, uncompromising, deeply empathetic to the property owner. A public-health announcement, not a sales pitch.
- **Antagonist:** "Insurance Council Hype" — the margin-squeezing TPA model treating environmental health hazards with sledgehammers, bleach, and guesswork.
- **Protagonist:** The independent, certified Restoration Professional — backed by open-source NRPG standards, armed with ReStoreAssist data, united under DisasterRecovery.com.au.
- **Music/sound:** Low rhythmic heartbeat bass → chaos cuts to focused silence → soaring precise orchestral/electronic + crisp tech sound (moisture-meter beep, containment-wall zip).
- **VO:** Grounded, knowledgeable Australian/Kiwi voice; the quiet confidence of a forensic scientist.

---

## Master script (locked — 6 acts)

| Time | Act / Visual | Audio / VO |
|---|---|---|
| 0:00–0:15 | **I — The Invisible Threat.** Extreme slow-mo macro: black Category-3 floodwater wicking up microscopic pores of pristine plasterboard. Charred timber-frame skeleton post-bushfire, soot webs suspended in air. Dim hallway, silent red/blue police flash through window (trauma). | Heavy slow heartbeat; echoing water drip; muffled sirens fading. VO: *"When the storm passes. When the fires are put out. When the sirens finally fade… the trauma is visible. But the true disaster… is what you can't see."* |
| 0:15–0:30 | **II — The Flawed System.** TPA assessor in cheap hi-vis hurries through flooded living room, ticks a tablet box, taps his watch. Builder swings a sledgehammer into a wet wall, no respirator, dust/debris explode. Camera pushes into the wall cavity → macro/CGI black mould (Stachybotrys) blooming in damp timber. | Jarring, rushed: sledgehammer impacts, frantic typing, ticking clock. VO: *"For too long, recovery has been dictated by a compromised system. Lowest-quote administrators and demolition crews treating complex indoor environments with sledgehammers and guesswork. Masking odours. Painting over dampness. Covering up what they don't understand."* |
| 0:30–0:50 | **III — The Paradigm Shift.** Black. A True Professional steps in — immaculate Level C PPE (Tyvek, full-face PAPR). Raises a thermal imaging camera; screen glows cold blue revealing a hidden moisture track behind a perfectly painted wall. | Chaos stops instantly. Deep resonant bass drop. Reassuring hum of HEPA scrubbers powering up. VO: *"It's time to draw the line. Enter the True Professional. We don't guess. We measure."* |
| 0:50–1:10 | **IV — The Methods (real science).** Fast precise rhythmic cuts: **Water** — non-destructive moisture meter mapping hardwood. **Mould** — heavy ZipWall containment seals room; HEPA-500 negative-air machine exhausts outside. **Biohazard** — ATP swab on a sanitised trauma scene, luminometer flashing green "0 RLU." **Fire** — dry-chem sponge lifting acidic soot without driving it into grain. | VO: *"We apply the rigorous global science of psychrometry, targeted structural drying, and strict bio-remediation. Governed by the open-source National Restoration Practice Guidelines (NRPG). No insurance council hype. No hidden agendas."* |
| 1:10–1:20 | **V — The Proof (ReStoreAssist).** Close-up iPad: ReStoreAssist syncing live — Vapor Pressure Differentials, Grains Per Pound, 3D structural scans, timestamped Chain-of-Custody logs locking in. | Gentle digital validation ping. VO: *"And we prove it. Every atmospheric reading, every thermal scan, every clearance certificate… captured by ReStoreAssist. Immutable, transparent, undeniable evidence."* |
| 1:20–1:30 | **VI — The Sanctuary.** Containment comes down. Warm sunlight floods a pristine home, air visibly pure. Restorer (now clean polo) hands a digital Clearance Certificate to a relieved family; turns back to an organised, unmarked response vehicle. | VO: *"Because true restoration isn't a construction site. It is the uncompromising protection of the Indoor Environment."* |
| 1:30 | **Outro.** Fade to deep charcoal. Three logos illuminate: DisasterRecovery.com.au (centre), NRPG – The Standard (left), ReStoreAssist – The Proof (right). | VO: *"Demand the science. Find your professional today at Disaster Recovery dot com dot au."* Music resolves on a strong chord. |

---

## Production approach — honest tool-fit (the part that needs a decision)

This is a production-grade 90-second hybrid film. It is **not** a single-tool generation. Each beat maps to one of three pipelines; mixing them in an edit is what makes it cinematic and bulletproof.

### A. Synthex generative engine (fal: Wan/Hailuo/Kling/Veo) — atmospheric & CGI B-ROLL only
Best for short (5–10s) abstract/macro/texture shots an editor cuts between, where exact realism of branded equipment or people is NOT required:
- Act I: floodwater wicking up plasterboard pores; soot webs suspended in light shafts; volumetric dust.
- Act II: macro/CGI mould spores blooming in a wall cavity.
- Act III: the cold-blue thermal-cam reveal as a stylised effect plate.
- Texture/transition plates throughout.

**Hard constraints (must be honest about these):** the engine makes 5–10s clips, cannot sustain a 90s narrative, cannot reliably render readable app UIs, exact equipment models, or consistent human characters/PPE across shots. It produces *ingredients*, not the finished film. **And it cannot produce even these clips until the fal model-schema fix is done** (current blocker: wrong model IDs + duration enum — see the engine plan).

### B. Remotion (already live in Synthex) — graphics, typography, UI, outro
Fully in our control, on-brand, deterministic — the engine's opposite strength:
- Act V: the ReStoreAssist iPad data-sync animation (VPD, GPP, 3D scan, Chain-of-Custody) — render from real schema, not guesswork.
- Act VI outro: the three-logo illumination, the kinetic typography, timing-card overlays, lower-thirds, the Clearance Certificate graphic.
- Any on-screen numbers ("0 RLU", moisture readings) as precise overlays.

### C. Live shoot / licensed stock — the human truth
Needs a real DP (macro-videography specialist, as the brief itself notes) or licensed footage:
- The True Professional in Level C PPE; the TPA assessor and sledgehammer builder (antagonist).
- Brand-accurate equipment in action: HEPA-500 negative-air machine, ZipWall, penetrating pin-probe meter, ATP luminometer, dry-chem sponge.
- The Act VI family handoff and the sunlit sanctuary.

### Realistic sequence to delivery
1. Fix the fal engine schema (blocks B-roll generation).
2. Generate the B-roll shot library (engine) — atmospheric/CGI plates.
3. Build the Remotion graphic layer (UI sync, outro, typography, overlays).
4. Commission the live shoot / source stock for human + equipment beats.
5. Assemble + grade in an edit; lay VO + sound design.

---

## Standards compliance (director's bible — keep it bulletproof)
Visual methodology must adhere to IICRC S500/S520/S540 + ABRA:
1. **Water — destroy the "dry to the touch" myth:** show penetrating pin-probe meter in structural hardwood + ReStoreAssist computing specific humidity/vapor pressure. Drying is a mathematical formula, not a feeling.
2. **Mould — remediation vs bleach:** feature source containment (poly zip-walls) + established negative air pressure. Mould is an airborne respiratory hazard, not a stain.
3. **Biohazard — bio-verification:** ATP luminometer numerical readout validates Category-3/trauma cleanup. Elevates restorer from cleaner to environmental clinician.

## Platform integration
- **NRPG (the standard):** open-source guidelines (GitHub) destroy closed-door insurance pricing matrices — peer-reviewed, transparent.
- **ReStoreAssist (the proof):** geo-located, timestamped, unmanipulated field data (psychrometry, EMC) no desk adjuster can dispute.
- **DisasterRecovery.com.au (the gateway):** the centralised hub where owners bypass volume-driven vendor queues and find the elite.
