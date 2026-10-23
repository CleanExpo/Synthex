---
name: film-harness
description: >-
  Make a distinctive client film (and its card styles) from the client's own website,
  without AI slop: capture brand DNA, write a single-minded brief, render the same film
  in several named styles, have a blind critic score each, let a human pick, then render
  and publish. Use for Living Card films and variants, business demo films, or when
  asked for "different styles", "variants", "make it less generic", "concepts" or
  "a film for <business>". Orchestrates existing pieces in business-card/demos/cinematic.
---

# Film harness

Why this exists: Phill (23/10/2026) found our films "still a little bit of AI slop". The AI
builders (Lovable, v0, Anthropic's own harness) beat generic output with the harness around the
model: standing brand context, a plan approved before spending, hard constraints and ban lists,
several divergent options, and a separate sceptical critic that looks at the rendered pixels.
Research: 2nd Brain `Wiki/creative-harness/` pages ch-01 (builder patterns), ch-02 (style
catalogue), ch-04 (anti-slop method and rubric), ch-05 (this harness).

Hard rules that bind every stage:

- Real images only (`.claude/rules/real-images-only.md`): the client's own site, owned photos,
  owned product cut-outs. No stock, no invented people, no model-rendered words.
- Every claim on screen or in narration traces to the client's own site (`tours.json` words).
- Margot narrates (Australian, ElevenLabs voice in `demos/build.py`). Australian English.
- Bright, never dark. One pixel word per headline at most.

## Stages

Each stage writes a file; never skip ahead. Stop and ask a human only at stage 7.

1. **Brand DNA.** `node business-card/demos/cinematic/slices.mjs <media> <id>` captures every screen
   the film uses and splits it into real pieces (`full.png`, `pieces.png`, `plate.png`,
   `pieces.json`). Read fonts and colours from the live site into the plan's `brand` block
   (`films.json`). This is the client's design system; nothing overrides it.
2. **Brief.** One evidence pack and one single-minded message (ch-04 §3): the customer's moment, the one
   sentence the film must leave behind, the one or two distinctive assets. Script lines live in
   `tours.json` (narration) and `films.json` (scene plan: steps, kit, photo beats).
3. **Concepts.** Pick five styles from `business-card/demos/cinematic/styles/` that differ on at
   least three of: paper and pattern, how pieces arrive, stage and camera, tiles, the pixel word.
   Use the fit table in ch-02 §6 (trade: kit-bench, training: riso-print or swiss-grid, software:
   screen-through or hex-blueprint, networks: iso-board, local family trades: paper-collage).
4. **Style.** A style is data, never code: `styles/<id>.json` sets palette, type, motion, scenes,
   sound, bans and references. A new look is a new JSON file plus, only if needed, one new arrival
   mode in `style.tsx`. Never fork the composition per client.
5. **Render the board.** `python3 -I business-card/demos/cinematic/prepare.py <media> <id>` (narration and
   timings), then `python3 -I business-card/demos/cinematic/variants.py <media> <id> <style...>`
   renders three stills per style (first screen, steps, logo) and `variants/board.jpg`.
6. **Critic.** Dispatch the `film-critic` agent once per style with only: the stills' absolute
   paths, the brand kit (name, colours, fonts), the single message, and the other concept names.
   Collect the JSON into `variants/critic.json` keyed by style id. A style with verdict `reject`
   is dropped; `revise` gets its one fix, then one re-render and one re-score at most.
7. **Human pick.** Show `board.jpg` with the critic's means and one line per style (what it
   signals). The human picks one style for the film and, for Living Card Signature, five for the
   card variants. Record the pick and the reasons in `films.json` (`style`) and in a feedback log
   so picks become taste memory.
8. **Render.** Set `style` in `films.json`, re-run `prepare.py`, render with
   `npx remotion render business-card/demos/cinematic/index.tsx Film ...` (see the header of
   `index.tsx`), then `metadata.py` levels the sound to about -14 LUFS and writes the search-ready
   YouTube details, captions and the site's VideoObject.
9. **Publish.** `demos/upload.py` uploads only to the business's own channel
   (`tours.json` `youtubeChannelId` / `youtubeChannelOf`). The altered-or-synthetic box, video
   language and location are ticked in YouTube Studio by a person.

## Pricing tie-in

Living Card (A$249 / US$249) ships the client's film in one house style with three card styles.
Living Card Signature (A$449 / US$449) runs stages 3 to 7 for five styles and ships five card
variants, each with a 30 to 45 s cut-down; generative openers are capped at about 250 credits.
See `business-card/product-sketch.md` and the wiki page ch-03.

## Done means

The board exists, every style has a critic score, a human picked, and the final film passes the
contract's film checks. A render that looks fine is not done until the critic and the human have
seen it.
