# Lessons from The Relay (23/10/2026)

Every line is something Phill or an independent reviewer caught. Each one is now a check: automatic in
`gates.py` where a machine can measure it, a signed checklist item in the shot list where it needs eyes.

| #   | What went wrong                                                                         | Check now                                                                                                                   |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Films were website tours, dark and static                                               | Five-step order (README); footage at least 75% of runtime; brightness targets on stills                                     |
| 2   | Generated moisture meter looked nothing like the real tool                              | `equipment_matches_reference`: every tool checked side by side with its owned photo; no reference, no tool in shot          |
| 3   | "Storeapp io": a spoken watermark in the music (Artlist library preview)                | `music` gate: licensed source only, speech-to-text on the music file finds no words; `speech` gate on the final mix         |
| 4   | Contractor holding a phone in the driver's seat                                         | `legal_and_safety`: no phone use in a vehicle unless parked and half out the door                                           |
| 5   | Mirroring a shot made a left-hand-drive ute parked against traffic                      | Never mirror vehicles; parked on the left facing the direction of travel                                                    |
| 6   | Lights on in a flooded house; homeowner in floodwater                                   | Power off after a flood; PPE matched to the hazard; founder decides on dramatic exceptions                                  |
| 7   | Frozen lightning bolt held in the door glass                                            | Frame-by-frame check of every generated shot at 6 fps or more (`faces_and_hands_frame_checked`)                             |
| 8   | Website text cut off at the phone's edges; price and "not your insurer" lines on screen | Phone tool keeps the page at true width; `no_text_cut_off`; no prices or audience-hostile lines on held frames              |
| 9   | Pale outline and white gaps round gloves on a tracked tablet                            | Screen tracker v4 (outward from the cleanest frame, glove matte without closing); judge caps Design at 6 for hand artefacts |
| 10  | One-frame dark flash as each chain link lit                                             | Chain built as one overlay stream; `chain-flicker` gate                                                                     |
| 11  | "Disaster" broken over two lines; small text looked 720p                                | Chain drawn natively at 4K, one line per name; `resolution` gate (3840x2160 masters)                                        |
| 12  | Music dropped out under the logo, then slammed back                                     | Score runs to the end and fades; ducking 8-10 dB, not 20                                                                    |
| 13  | Trade-show cutaway broke the story's place and time                                     | Every business appears inside the story's world (TradeHall became the gear arriving)                                        |
| 14  | No turn in the middle; two leads                                                        | `story` gate: shot list must name the logline, turn and payoff                                                              |
| 15  | Judge could not hear the film                                                           | Script is in the shot list and the speech gate proves the mix says only that                                                |
