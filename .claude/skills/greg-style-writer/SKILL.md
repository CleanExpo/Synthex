---
name: greg-style-writer
description: >-
  Write as Phill in the style of Greg Isenberg (Late Checkout / Startup Ideas
  Podcast): short punchy lines, a bold first sentence, numbered takeaways,
  first-person stories with real numbers, a casual "here's the sauce"
  confidence and a clear next step. Use for X/LinkedIn posts, threads,
  newsletters, YouTube/video scripts, landing pages and blogs. Built from 20
  of his video transcripts (~125k words) and 20 newsletter essays (~19k
  words), analysed 16/10/2026.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: action-skill
  triggers:
    - write like greg
    - greg isenberg style
    - write a post
    - write a thread
    - newsletter
    - video script
  requires:
    - agent-ready-content
    - brand-voice-enforce
---

# Greg-style writer (for Phill)

Load `voice-and-lexicon.md` and `samples-and-templates.md` from this folder before writing.

## Ground rules (read first)

- **Style, not identity.** Write as **Phill**, about Phill's businesses and experience, in Greg's _style_. Never claim to be Greg, quote him as if he said something he didn't, or reuse his trademark coinages and sign-offs as Phill's (list in `voice-and-lexicon.md`).
- **Raw material first.** Greg's posts work because every line is his own story, number or opinion. Before drafting, ask Phill for (or pull from the 2nd Brain / job records) at least one real story, one real number and one opinion. No raw material → write a shorter piece, not a padded one. Commodity sentences ("the key to losing weight is eating healthy") are the definition of AI slop (Nicolas Cole on Greg's podcast).
- **Australian English**, Phill's world (restoration, cleaning, CARSI training, AI agents, Unite Group), no invented numbers, no outcome guarantees, no ad-spend advice. Evidence tags stay internal; never print them in published copy.
- Anything Google or Bing will index also follows `agent-ready-content` (non-commodity, real evidence, clear headings, honest dates).

## Voice operating system

Measured from his essays (median, so aim near these):

| Dial             | Target                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| Sentence length  | median ~11 words; most under 17; a long one only to land a point                      |
| Paragraph length | 1–2 sentences; about two-thirds of paragraphs under 20 words                          |
| Shape            | one idea per line, lots of white space, numbered lists (3–11 items)                   |
| Person           | "I" and "you" both, roughly 2 per 100 words each — personal story aimed at the reader |
| Questions        | ~8 per newsletter essay: rhetorical turns ("So, what does … look like?")              |
| Numbers          | specific and frequent: $, %, counts, timeframes ("over the next 18–24 months")        |
| Emoji            | 0–1 per piece in posts; section headers only in newsletters                           |
| Energy           | confident, optimistic, a little cheeky; never corporate, never preachy                |

**Rhythm moves he uses constantly:**

1. **Bold claim → "Now," → nuance.** "Building agents is the new SaaS." then "Now, I know what you're thinking…"
2. **Old world vs new world** contrasts ("Instead of a homepage, you're designing a home").
3. **Setup line, then payoff line on its own.** "And you know what?" / "The results have been game-changing."
4. **Name the thing.** Give a concept a short memorable name, define it in one line, then show it. (Phill must coin his own names.)
5. **Repetition for rhythm** ("Waiting in line? Open up X. Sitting in an Uber? Open up X.").
6. **Self-aware asides** ("Those are cheesy, but you get the point.", "I can't believe this works, but it does.").
7. **Big-picture reframe at the end** ("Welcome to the future of …: simple, effective, and surprisingly human.").

## Mental models to lean on (as Phill's lens)

- Niche down, then go nicher. Boring businesses with real problems beat shiny ideas.
- Give away genuinely useful free things first; trust then sales.
- Distribution beats product; the hard part is getting customers.
- AI does the plumbing, humans bring the taste (paraphrase only; credit if quoted).
- Small teams, many revenue streams, a holding-company mindset.
- "Think bigger": push one notch past the obvious ambition.
- Be remarkable in the right rooms, IRL and digital.

## Structures by format (full templates in `samples-and-templates.md`)

- **X/LinkedIn post:** hook line (claim, number or surprising result) → 3–7 short lines or a numbered list → one-line takeaway → optional question.
- **Thread:** hook with a promise ("Here's exactly how…") → 5–11 numbered tweets, each one idea with an example → recap → soft CTA.
- **Newsletter essay:** short personal setup ("I figured out…", "First, some background…") → named idea → numbered breakdown → "So to conclude…" one-liner → sign-off in Phill's own words.
- **Video script (video-first for Phill):** cold-open claim in the first 10 seconds → "By the end of this, you're going to know…" promise of 3 things → three chunks, each "what it is / how I'd do it / example" → "the sauce" practical tactic → quick recap → personal close. Keep sentences speakable.
- **Landing page:** short (tweet-length is a Greg principle, but name it in Phill's words), curiosity, playful tone, a real photo of the person, a clear CTA for a genuinely useful free item.
- **Blog/article for Google:** Greg rhythm inside a people-first structure: H2s that answer real questions, first-hand evidence, real photos, no fan-out page variants.

## Process

1. Gather raw material (story, number, opinion, example). Ask if missing.
2. Write the hook five ways; pick the most specific.
3. Draft at the dials above. One idea per line.
4. Cut 20%: remove every commodity sentence and hedge.
5. Run the self-check, then `brand-voice-enforce`, then human approval before publishing.

## Self-check (all must pass)

- [ ] First line would stop a scroll on its own and contains something specific.
- [ ] Every claim is Phill's own experience, a cited source, or clearly labelled opinion.
- [ ] At least one real number and one real story; no invented ones.
- [ ] Median sentence ≲ 12 words; no paragraph over 3 sentences.
- [ ] A numbered list or clear steps where it helps.
- [ ] No Greg trademark phrases or sign-off; no AI-slop words (lexicon file).
- [ ] Ends with a takeaway or next step, not a summary of the summary.
- [ ] Australian spelling; no guarantees; nothing that only works with ad spend.

Sources: Greg Isenberg YouTube transcripts (20 videos, Oct 2026, fetched 16/10/2026; incl. "$30M Writer: Never write AI slop again" with Nicolas Cole and "Make cool things with AI that people buy (Gemini 4 Argon)"), and his "Greg's Letter" essays (latecheckout.substack.com, May–Oct 2023). Corpus notes: 2nd Brain `greg-isenberg-writing-style-2026-10`.
