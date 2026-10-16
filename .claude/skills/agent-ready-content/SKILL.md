---
name: agent-ready-content
description: >-
  How to write anything Google, Bing or AI agents will read (scripts, blogs,
  articles, listicles, service pages, schema) and how to build pages agents can
  read and act on. Combines the voice-skill writing method (teach the model the
  brand's real voice) with Google's AI-search and agent-friendly-site guidance.
  Use before generating or reviewing web content or building a site page.
  IDE-only: not product-invocable.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: action-skill
  triggers:
    - write for google
    - ai search content
    - aeo
    - geo
    - agent friendly
    - llms.txt
    - voice skill
  requires:
    - ree-content-teardown
    - brand-voice-enforce
---

# Agent-ready content

Sources (re-opened 16/10/2026): Google, "Optimizing your website for generative AI features on Google Search" (updated 10/07/2026); web.dev, "Build agent-friendly websites" (updated 01/04/2026); `docs/ree/sources/platform-changes-2025-2026.md`. Background: Greg Isenberg's Gemini 4 Argon video (Google-sponsored), 2nd Brain page `argon-writing-and-agent-ready-web-2026-10`.

## The rule

There is no special "AI style" or "Gemini/Argon style" that Google rewards. Google: "You don't need to write in a specific way just for generative AI search." AI Overviews and AI Mode are built on core Search ranking (retrieval plus query fan-out), so AEO/GEO is SEO. Write **non-commodity, people-first** content in the brand's **own voice**, grounded in **real job evidence**.

## 1. Build the brand's voice skill first

Any frontier model writes well only after it has learned the voice. For each brand (and Phill personally):

1. Collect real writing and speech: site copy, emails, posts, video transcripts, quotes, job notes.
2. Ask the model (with parallel subagents if available) to research it and produce a package:
   - `SKILL.md` — voice operating system: sentence rhythm rules, mental models, structures, what the brand never says;
   - `voice-and-lexicon.md` — signature vocabulary and coined phrases, Australian spelling;
   - `samples-and-templates.md` — verbatim samples and reusable structures.
3. Test it: give a topic, compare the essay with real writing, correct it, and fold corrections back into the package.
4. Every generation loads the package; output still passes `brand-voice-enforce` and human review.

## 2. Write non-commodity content

- **Start from evidence we own:** real job photos (`.claude/rules/real-images-only.md`), measurements, the technician's own explanation, the outcome. Google's contrast: "7 Tips for First-Time Homebuyers" is commodity; "Why We Waived the Inspection & Saved Money: A Look Inside the Sewer Line" is not.
- One strong page per real service or location. **Never** a page per query or fan-out variation: that is scaled content abuse.
- Organise for people: clear headings, short paragraphs, high-quality images and video with a watch page per video.
- AI assistance is fine; mass output without added value is not. Name the real expert; never invent authors, credentials or reviews.
- Listicles: only where each item carries first-hand detail.
- Scripts: hook with the real problem, show the proof on camera, say the answer plainly; publish the transcript on the watch page.

## 3. Things to skip (Google says they don't help in Google Search)

- `llms.txt` and other special AI files or Markdown mirrors (harmless; keep only if another engine uses them).
- "Chunking" pages into tiny pieces; rewriting for AI; chasing long-tail variants.
- Inauthentic mentions; special AI schema. Structured data only where it matches visible content (it is not required for AI features). FAQ rich results are no longer shown.

## 4. Make every site agent-ready

Agents read a page through screenshots, the HTML/DOM and the **accessibility tree**.

- Semantic HTML: `<button>`, `<a>`, `<label for>`. A custom control needs `role`, `tabindex` **and** keyboard activation (Enter, plus Space for buttons); focusable is not operable.
- No transparent overlays over controls; `cursor: pointer` on actions; interactive targets larger than 8 square pixels.
- Stable layouts: the same action in the same place on every page; no shifting layouts on money pages.
- Core content server-rendered and crawlable; Googlebot reads only the first 2 MB of a page.
- Keep "wow" interactive or 3D pieces on campaign pages or as progressive enhancement; keep services, pricing, booking, contact and proof plain and stable.
- Business data current where agents look: Google Business Profile, Bing Places, Merchant Center feeds for products.
- Crawler policy by purpose: allow search bots you want citations from (Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, PerplexityBot); decide training bots (GPTBot, ClaudeBot, Google-Extended) separately.
- Notify changes with IndexNow (Bing and partners); keep sitemaps accurate.
- Experiments only, behind a flag: WebMCP tools (proposed standard, Chrome origin trial) and Google Business Agent. Universal Commerce Protocol is emerging; check current status first.

## 5. Measure, don't assume

Search Console Generative AI performance report, Bing Webmaster Tools AI Performance, and booked jobs. Each reading carries an evidence state; a failed read is UNAVAILABLE, never 0. Be wary of tools claiming "internal" Google metrics.

## Review checklist (before publishing)

- [ ] Written with the brand voice package; passes `brand-voice-enforce`.
- [ ] Contains first-hand evidence that a competitor could not copy.
- [ ] No duplicate or variant-farm page; no invented people, numbers or reviews.
- [ ] Structured data matches visible content.
- [ ] Accessibility tree checked (DevTools/Lighthouse); actions are semantic and stable.
- [ ] IndexNow/sitemap updated; Search Console and Bing reports set to measure it.
