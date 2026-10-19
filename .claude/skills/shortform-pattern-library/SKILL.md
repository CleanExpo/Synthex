---
name: shortform-pattern-library
description: >-
  Measured craft benchmarks for short-form video, built by breaking down 94 Instagram reels with
  1M+ views (median 4.1M) frame by frame and comparing them blind with 41 of the same accounts'
  under-500K reels: hook timing, first-frame rules, text and caption typography, cut rate,
  length, loudness, archetypes, endings, split into table stakes vs traits that separated hits,
  with a trades/cleaning/restoration cut. Use when concepting, scripting, editing or gating any Reel, TikTok, Short or social video
  (harness nodes N3, N5, N13), when someone asks "what makes it go viral", or to refresh the
  corpus with the bundled harvester. Platform rules live in the shortform-<platform> skills.
metadata:
  author: synthex
  version: 1.0.0
  type: pattern-library
  triggers:
    [
      viral patterns,
      hook,
      retention,
      what makes a reel go viral,
      craft gate,
      pattern library,
    ]
---

# Short-form pattern library

Built 2026-10-19 from `references/corpus.json` (aggregates) and `references/corpus-reels.jsonl`
(one row per reel: 94 at 1M+ plus 41 controls, every one measured and broken down).
Method, limits and how to refresh: section 8. Published third-party evidence:
`references/published-evidence-2026-10.md`. Platform rules: `shortform-instagram`,
`shortform-tiktok`, `shortform-facebook`, `shortform-youtube-shorts`, `shortform-linkedin`.

Evidence tags (Synthex fabel standard): numbers below are **[VERIFIED]** against `corpus.json`;
production rules drawn from them are **[INFERENCE]**; anything from the web is cited.

## 1. What the 1M+ corpus measured

| Measure                          | p25   | **median** | p75   | n         | Instrument                       |
| -------------------------------- | ----- | ---------- | ----- | --------- | -------------------------------- |
| Views (profile grid, 19/10/2026) | 2.0M  | **4.1M**   | 10.6M | 94        | grid text                        |
| Length (s)                       | 21.6  | **38.8**   | 65.0  | 94        | ffprobe                          |
| First spoken word (s)            | 0.02  | **0.05**   | 0.14  | 59 voiced | whisper.cpp                      |
| Speech rate (words/s)            | 2.0   | **3.0**    | 3.6   | 59 voiced | whisper.cpp                      |
| Average shot length (s)          | 2.6   | **5.1**    | 11.5  | 94        | ffmpeg scene > 0.3 (lower bound) |
| Hard cuts in first 3 s           | 0     | **0**      | 1     | 94        | same                             |
| Loudness (LUFS, delivered)       | −14.6 | **−14.2**  | −14.1 | 92        | EBU R128                         |
| Hook-text words (when present)   | 4     | **5.5**    | 8     | 42        | vision                           |
| Hook-text cap height (% frame)   | 2.0   | **2.5**    | 4.0   | 42        | vision estimate                  |

**Trades / cleaning / restoration subset (n=38, median 3.75M views):** median length 38.6 s,
**median shot 3.3 s** (faster than the corpus), median 12.5 cuts, 34 of 38 open already moving,
19 of 38 show no face in frame 1, 33 of 38 have no captions, 35 of 38 have no CTA.

## 2. Rules, in two tiers

The same accounts' **under-500K reels** (41 reels, 28 accounts, median 268K views) were broken down
blind with the same instruments (section 9). That splits the corpus findings into habits every
reel from these accounts shares, and traits that separated the hits.

### Tier 1: table stakes (hits and misses both do these; skipping them loses, doing them does not win)

1. **Frame 0 is already moving.** 1M+ 77%, under-500K 73%. No logo, no greeting. Trim the first
   0.5 s of every take.
2. **Talk from the first frame.** First word at median 0.05 s (hits) vs 0.07 s (misses).
3. **No hard cut in the first 3 s.** Median 0 in both. Hold the opening shot; pace up afterwards
   (trade/cleaning hits average a new shot every 3.3 s).
4. **Payoff last, then stop.** Payoff at the end 59% in both. Endings abrupt or on the reveal.
5. **No CTA on screen.** 80% vs 78% have none. Put the ask in the post caption.
6. **Counters for progress, nothing decorative.** Counter/label graphics 17% in both: "DAY 54",
   "CLAIM #4", numbered step cards.
7. **Master to −14 LUFS / −1 dBTP.** Both groups deliver at −14.2 LUFS, very likely Instagram's
   own normalisation **[INFERENCE]**.
8. **Natural look.** 52 of 94 hits are ungraded natural light; handheld and tripod split evenly.

### Tier 2: what separated hits from the same accounts' misses (test these)

| Trait                           | 1M+ (n=70) | under-500K (n=41) | Rule **[INFERENCE]**                                                                                   |
| ------------------------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| A face visible in frame 1       | **71%**    | 51%               | Open on a person (expert, worker, customer reacting), not an empty scene                               |
| Short hook-text overlay present | **54%**    | 32%               | Add one: ≤8 words (median 5.5), small (cap height 2.5–4% of frame), top of frame, on screen from 0.0 s |
| Comedy / relatable skit         | **26%**    | 7%                | Make some content about the crew and the trade, not the job                                            |
| Transformation / before-after   | 9%         | 17%               | Do not rely on the before/after alone; pair it with a face and a text hook                             |
| Loop-back ending                | 10%        | 5%                | Weak signal; worth testing on 6–15 s satisfying cuts                                                   |

Each gap is roughly 2–3 standard errors on these sample sizes, and 11 traits were tested, so
read them as **hypotheses ranked for testing**, not laws. Test each with Instagram Trial Reels
(same footage, trait on vs off) before making it a hard gate.

### Typography and captions, as measured on the 1M+ reels

- Where hook text exists: median 5.5 words, cap height 2.5% of frame height (~48 px on 1920),
  at the **top** (25 of 42), white (24) on a box or with a shadow (15 each), heavy sans caps or
  bold sentence case. Only 6 of 94 highlight a keyword in yellow; the big "Hormozi caption" is a
  minority style, not the norm.
- Burned-in speech captions: 34 of 94. When used, 1–3 word chunks (23), lower-middle (19) or
  centre (11), mostly sentence case. Facebook and LinkedIn cuts still need captions for sound-off.

## 3. Archetypes that hit (counts in corpus)

| Archetype                     | All (94) | Trades/cleaning (38) | Producer note                                                                                                      |
| ----------------------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Comedy / relatable skit       | 21       | 13                   | Crew personality: "Boss: … / Us:" top captions; apprentice vs journeyman labels; trade-pay rankings drive comments |
| Story                         | 15       | 2                    | Cold open on the strongest line, context after                                                                     |
| Did-you-know / explainer      | 10       | 0                    | Expert answers a question asked by someone else (stranger, audience, stitched clip)                                |
| Transformation / before-after | 9        | 8                    | Open on the worst of it already being worked on; flash the "before" once more; end on the clean frame              |
| Tutorial / steps              | 7        | 6                    | Numbered top-of-frame step cards, no voice needed                                                                  |
| Review / demo                 | 6        | 3                    | Off-label product use travels (gap foam cooler, 7.8M)                                                              |

Trade-specific formats worth stealing the **structure** of (never the footage):

- **Live-risk single take**: fixed camera, the risky job in one shot (valve swap on a live tank,
  40.3M). Stakes come from physics, not editing.
- **Satisfying close-up loop**: 6–14 s extreme close-up of hands on material, no words, last frame
  matches first. The pitch lives in the caption ("Good waterproofing = no leaks, no call-backs").
- **Prejudice answered by work**: quoted insults one per beat, then a silent montage of finished
  work; caption asks for comments.
- **Stitched contrarian line**: another speaker's strong claim ("I will not buy a fabric couch"),
  then the expert cuts in to agree or correct. Fits restoration authority content.

## 4. Spoken hooks

40 of 94 have no spoken hook at all (music, skit or silent). Of those with one: story-open (24),
bold claim (8), contrarian (7), you-address (7), question (5). The corpus is too small to rank
these; published data suggests questions raise the ceiling (`published-evidence-2026-10.md` §1).
Rule: start mid-thought ("But let me show you…", "My next claim is…").

## 5. Length by goal

- Corpus median 38.8 s; middle half 22–65 s. Medians by niche: business explainers 113 s,
  cleaning/restoration 58 s, education 44 s, global format 27 s, **trades 15 s** (wordless
  satisfying and skit formats).
- Reach test: 20–45 s. Authority explainer: 60–120 s if every 3–5 s earns its place. Loop
  content: 6–15 s.

## 6. Craft gate (harness node N13)

Run `harness/analyze.py` on the rendered master and fail the cut if any line fails:

- [ ] Frame 0 shows the subject in motion (or a mid-sentence speaker)
- [ ] First word ≤ 0.2 s (voiced reels)
- [ ] No hard cut before 3 s unless the format is a deliberate fast montage
- [ ] Any hook text: ≤ 8 words, readable at 2.5–4% cap height, inside the platform safe zone,
      visible from 0.0 s
- [ ] Captions (if used) match the transcript word for word, 1–3 word chunks
- [ ] Payoff in the final 20%, ending abrupt or on the reveal; no outro card
- [ ] No on-screen CTA unless it is a specific share ask
- [ ] Integrated loudness −14 ± 1 LUFS, true peak ≤ −1 dBTP
- [ ] Owned, grounded footage only (`.claude/rules/real-images-only.md`)
- [ ] WARN (tier 2, not a fail): no face in frame 1, or no ≤8-word hook text; justify or add

## 7. What this library does not prove

- **Shared traits are not causes.** Tier 1 traits appear equally in misses. Tier 2 is a
  within-account comparison of 70 hits and 41 misses: suggestive, not proven.
- **Account size is the biggest predictor** of reach in published work (arXiv 2111.02452); many of
  these accounts have millions of followers. Small accounts need volume and Trial Reels.
- **Instruments have limits:** the cut detector misses matched-framing cuts and punch-ins
  (a lower bound); Whisper hallucinates speech over music, so speech stats use voiced reels only;
  `audio_read` is inferred from transcripts, not heard; type size is a visual estimate.
- **Sample:** logged-out view of each profile's latest 12 reels, 19/10/2026; stratified by niche,
  capped per account; collab posts can appear in a profile's grid (`poster` field records the real
  poster). Restoration-specific 1M+ creators were scarce: of 8 cleaning/restoration accounts
  probed in wave 2, 5 were blocked logged-out, 1 had no 1M+ reel in its latest 12 and 1 had a
  single one. Of 26 trade accounts visible logged-out, 16 had no 1M+ reel in their latest 12: a 1M+ hit
  is rare even for established trade creators, so judge client work on rates, not view counts.

## 8. Refresh the corpus

```bash
# scratch dir: npm i playwright@1.64.1 (Chromium 156 used on 19/10/2026)
# model: curl -L -o ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
#        expected SHA-1 137c40403d78fd54d454da0f9bd998f78703390c (shasum -a 1); whisper-cli from brew whisper-cpp
NODE_PATH=<scratch>/node_modules node harness/harvest.cjs grid  <data> <handle> [...]
NODE_PATH=<scratch>/node_modules node harness/harvest.cjs reels <data> <list.json>
python3 -I harness/analyze.py <data> <ggml-base.en.bin>
# vision pass: one agent per ~11 reels, schema references/breakdown-schema.md -> observed.json
python3 -I harness/build_corpus.py <data> references/corpus.json
```

Logged out, no cookies, 3–6 s jitter. Every target writes a status record; blocked pages are
`BLOCKED_*`, never silently empty. Media stays in the scratch data dir and is never committed or
re-published; the corpus keeps structure plus the first 3 s of speech only.
Refresh quarterly, or when a platform announces a ranking change.

## 9. How the hit-versus-miss comparison was built

- **Control set:** for each account that contributed a 1M+ reel, its highest-viewed reels that
  stayed **under 500K** in the same latest-12 grid (1 per account, 2 for trade/cleaning accounts):
  41 reels from 28 accounts, median 268K views. Stored in `corpus-reels.jsonl` with `stratum:
control_low` and kept out of every 1M+ aggregate.
- **Same instruments**, and the vision pass was **blind**: control observers read only frames and
  measurements, never the view count.
- **Comparison** uses only 1M+ reels from those same 28 accounts (n=70), so account size and house
  style are held roughly constant. Numbers: `corpus.json` → `aggregates.contrast_1m_vs_control`
  and `aggregates.control_low`.
- **Limits:** small n; 11 traits tested without correction; "under 500K" from big accounts is
  still a large audience, so this compares good with great, not good with bad.
