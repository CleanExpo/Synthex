# Film harness

How Unite Group makes a film that is as good as The Relay or better, every time. Built 23/10/2026 from the
work on The Relay (eight versions, two independent reviewers, a calibrated judge and Phill's corrections).

## The order of work (Phill's rule, never skipped)

1. **Understand**: who is buying, what they feel in the first two seconds, the one idea. Write it down.
2. **Story**: three genuinely different stories; a reviewer who has not seen the drafting picks one. The logo is
   earned at the end. The chosen story names its **logline, turn and payoff** (the `story` block of the shot list).
3. **World**: setting, colour, light, camera, pacing fixed before any image is made. Businesses live inside the
   world (a phone, a laptop, a tablet, gear arriving), never as slides.
4. **Images**: hero image first, then every shot for its moment. Equipment only from owned reference photos,
   checked side by side. Stills pass the tone targets and an independent visual check before animation.
5. **Judge**: the calibrated blind judge (`group-film/qa/judge/RUBRIC-AND-CALIBRATION.md`) scores Story, Design and
   Appeal against the reference films; it must have failed the old drafts first.

## Making the film

```bash
python3 -I business-card/demos/film-harness/build.py business-card/demos/film-harness/<film>.shotlist.json
```

```bash
python3 -I business-card/demos/film-harness/gates.py business-card/demos/film-harness/<film>.shotlist.json "<root>/<out>.mp4"
```

- `build.py` runs the clip fixes (`tools/`: screen tracking, bolt removal, lamp off), the phone screens, the 4K
  chain, the payoff, the approved logo card, licensed music placed so its lift lands on the payoff, Margot's lines
  with gentle ducking, and writes a 4K master, a phone copy and a timeline file.
- Generated clips are upscaled to 4K with Higgsfield Topaz (5 credits a clip) before prep, so faces and texture
  are real 4K, not stretched 1080p.
- `gates.py` must exit 0 before the film goes to Phill. It checks resolution, duration, loudness, that the only
  words in the mix are the script, that the music is licensed and wordless, flash frames, chain flicker, the
  story block, and the signed checklist. A gate that cannot run fails.
- Then the independent motion review and the blind judge. Scores go in `scoreboard.json`.

## Better every time

`scoreboard.json` holds every judged version. A new film goes to Phill only when it scores at least the best
house film so far on every dimension, or it is labelled a preview with the gap stated. Every correction Phill
makes is added to `lessons.md` and, where it can be measured, to `gates.py` in the same session.

## Python

The tools need OpenCV: `FILM_PY` (default `/Volumes/Mini Mini 2T Storage/media/card-demos/.venv/bin/python`,
made with `uv venv` and `uv pip install opencv-python-headless numpy`). Speech-to-text uses ElevenLabs through
`business-card/demos/build.py` `env()`; the key is never printed.
