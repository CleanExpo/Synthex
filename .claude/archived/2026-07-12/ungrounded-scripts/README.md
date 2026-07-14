# Ungrounded Scripts Archive — 2026-07-12

> **Spec:** `docs/superpowers/specs/2026-07-12-real-images-only-design.md` — Part C
> "Sanctioned exceptions register", item 3 ("One-off campaign scripts").
> **Mandate:** Real Images Only — Grounded-by-Default, Everywhere (founder-mandated,
> 2026-07-12): every image/video generation must resolve the owned reference
> library first; producing pixels without owned references is no longer a
> default behaviour anywhere in the system.

## What was archived here

Three standalone scripts that generated real marketing/product images by
calling provider APIs (OpenAI, Gemini "nano-banana", Imagen) **directly**,
completely bypassing `generateImage()` (`lib/services/ai/image-generation.ts`)
and its grounding gate, LoRA registry, and generation lineage:

- `generate-ccw-openai-campaign-images.ts` — CCW EOFY campaign support images
  via raw OpenAI `POST /v1/images/generations` (`gpt-image-2`), Prisma-linked
  manifest output.
- `generate_nano_banana.py` — direct Gemini "nano-banana" image generation.
- `generate_imagen.py` — direct Google Imagen generation.

Per the spec, these are **archived, not rewritten** — recoverable, not
rebuilt against the new grounded contract. They were one-off tools for a
specific past campaign, not part of any ongoing product surface.

## Why this was safe

None of these scripts are imported by application code (`app/`, `lib/`) — they
are standalone `tsx`/`python3` entry points invoked manually. Archiving them
does not change any runtime behaviour. The one dependent artifact,
`tests/unit/marketing-agency/ccw-openai-campaign-images-script.test.ts`
(a static-content assertion against the file), was updated in the same change
to read from the new archived path so the suite keeps passing.

## Recovery — how to restore

Per CLAUDE.md "never delete · move to archived/" convention, all three files
are preserved verbatim (git history intact via `git mv`). To restore any file:

```bash
git mv .claude/archived/2026-07-12/ungrounded-scripts/generate-ccw-openai-campaign-images.ts scripts/
git mv .claude/archived/2026-07-12/ungrounded-scripts/generate_nano_banana.py scripts/
git mv .claude/archived/2026-07-12/ungrounded-scripts/generate_imagen.py scripts/
```

If reused, route image generation through `generateImage()` with
`systemGenerationContext()` (grounded-by-default, LoRA auto-applied) rather
than reintroducing a direct provider call — see
`app/api/media/generate/image/route.ts` for the reference pattern.
