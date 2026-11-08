# Restoration video training pack

Built 08/11/2026 from six short-form mould remediation reels Phill shared, for training our video
system on restoration design, message and standards. It serves RestoreAssist, CARSI and Disaster
Recovery / NRPG only. Restoration content never appears in Unite Group videos (founder rule).

Client metric this moves: none yet directly; it is the standards and script foundation for
RestoreAssist trial sign-ups and CARSI enrolment films (FD-10).

## What is in the pack and who reads it

| File                             | What it is                                                                                                                                                     | Read by                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `reels/reel-1.md` to `reel-6.md` | Full breakdown per seed reel: transcript, timed frame timeline, production style, standards check, gaps, lesson                                                | Script writers, video-director, the 25-round loop                                                                                        |
| `reels.jsonl`                    | The same six reels as machine records (measured with `analyze.py --single`, observed fields in the pattern-library schema v1.1, stratum `restoration_us_seed`) | `shortform-pattern-library` when restoration patterns are compared; not merged into its corpus so its 135-reel aggregates are not skewed |
| `standards-register.md`          | Every claim a restoration video may make, with source and status                                                                                               | Every script (check K1, K2)                                                                                                              |
| `why-five-layers.md`             | The WHY chain and the definition of a Professional Restoration Provider, plus five provider tests                                                              | Every script (check K24); CARSI course framing                                                                                           |
| `test-plan-25x25x25.md`          | 25 scenarios, 25 checks, 25 rounds, and the render gate                                                                                                        | The training loop and the judge                                                                                                          |
| `channel-catalogue.md`           | 72 distinct confirmed reference links: seed creators, Australian firms, education channels                                                                     | Researchers adding the next reels                                                                                                        |

The six source videos, their frame sheets and audio are kept only in the session scratchpad.
They are third-party works and are never committed or used as image references.

## What the six reels taught us (one line each)

1. Lead with the cause, not the mould: "will it come back?" is the real question.
2. A numbered process is a ready-made script, but every number on screen must be real and complete.
3. The strongest hook is a test the homeowner can apply to their own contractor.
4. "Your house is giving you clues" works; arrogance toward the homeowner does not.
5. Show the finished result in the first second of a product demo.
6. One vivid image ("little brown lemons") plus one practical inference makes science watchable.

Common style across all six: vertical 9:16, phone-shot, one take or very few cuts (except reel 4),
real job sites, gloved hands, the work itself as the visual. Bright, natural colour. Text on screen
carries the message for silent viewing.

## US to Australian glossary (check K5, K6)

| US reel says                     | Australian video says                                        |
| -------------------------------- | ------------------------------------------------------------ |
| mold                             | mould                                                        |
| drywall, sheetrock               | plasterboard (or gyprock as the common name)                 |
| baseboard                        | skirting board                                               |
| crown molding                    | cornice                                                      |
| 2x4, 2x6                         | 90x45, 140x45 timber framing                                 |
| crawlspace                       | subfloor                                                     |
| attic                            | roof space, roof cavity                                      |
| air handler closet, HVAC         | ducted air-conditioning unit, return air                     |
| N95, P100                        | P2, P3 (AS/NZS 1715 and 1716)                                |
| inches of water column           | pascals (Pa)                                                 |
| Fahrenheit, square feet, gallons | degrees Celsius, square metres, litres                       |
| 110-120 V equipment              | 230 V equipment with Australian plugs                        |
| state mould licence              | no mould licence found in Australia; IICRC credentials (R20) |

## References we have and references missing

Have (owned, in `public/reference-library/manifest.json`, water-damage-restoration vertical):
78 CCW catalogue product subjects with images, all 230 V Australian stock, including Razorback and
XPOWER air scrubbers, Dri-Eaz LGR dehumidifiers, XPOWER and Dri-Eaz air movers, Injectidry wall and
floor drying systems, Hydro Shark moisture sensor, Phoenix containment weights, Poly-Hanger clips,
Water Claw extraction tools, HEPA filters, UV torches, MoldHold sheets.

Missing (blocks rendering; owner Phill):

- Any owned photo of an Australian house (exterior or interior) on a real job.
- A containment build (sheeting, zip door, floor protection, negative air ducting).
- A technician in PPE (P2 or P3 respirator, overalls, gloves) and a fit check.
- Opened walls, wet plasterboard, mould on framing, subfloor and roof-space conditions.
- Instruments in use: moisture meter readings, thermal camera, manometer, hygrometer.
- An asbestos test result or clearance document (with consent) to show the check.
- A post-remediation verification report.
- Margot narration recorded for restoration scripts.
- The Australian editions (AS-IICRC S500:2025 and S520:2025) and their Australian modifications. Unite Group holds the ANSI/IICRC base texts (S500:2021, S520:2024) in Google Drive, and the register now cites their clauses.

## Status and what is not done

- The register marks 25 of 34 claims VERIFIED from sources the lead session opened, including clauses read in the S520:2024 and S500:2021 texts on 08/11/2026; 9 remain UNVERIFIED (a claim no source supports, or a helper finding not yet reopened).
- Not yet independently reviewed. The TRD policy asks for an independent Claude review and a JEV triage before this is called verified training material.
- Round 1 of the 25-round plan has not been run. It is scripts only until owned job footage exists.

Doctrine applied: 3.7 references first with tools (real reels opened, measured, transcribed);
3.9 looked at the output (frame sheets read for every second); 3.12 footage-first (render gate);
3.14 no model-made text or logos; 4.2 cite every load-bearing claim (register); 4.5 Australian
English; 5.3 one canonical home (this folder); 5.7 nothing called finished with open items.

References followed: Building Performance Solutions, https://www.facebook.com/share/r/1DY9S3t73i/, 14/10/2026;
Diego Newkirk, https://www.facebook.com/share/r/19pu3LJnZ3/, 22/09/2026;
Arthur Yon, https://www.facebook.com/share/r/1FVieMbPsA/, 04/11/2026;
MoldAway, https://www.facebook.com/share/r/19fcx1F1iB/, 05/11/2026;
Brantley May, https://www.facebook.com/share/r/19yqxPPn9f/, 14/08/2026;
Building Performance Solutions, https://www.facebook.com/share/r/1KEAtpgXH8/, 01/11/2026;
AAA Mould Removal, https://www.youtube.com/watch?v=oHL30YENmuo, 13/06/2026.
