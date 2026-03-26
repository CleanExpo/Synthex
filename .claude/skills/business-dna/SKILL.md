---
name: business-dna
description: >-
  Synthex brand DNA extractor. NEVER produce surface-level brand descriptions
  ("professional and friendly"), generic persona archetypes ("busy professional
  aged 25–45"), or tone descriptions that could apply to any brand. ALWAYS
  extract vocabulary the brand actually uses, describe what the brand explicitly
  is NOT, and ground the audience in a specific outcome they are seeking.
  Activate on ANY request to extract brand identity, build a DNA profile,
  define a brand voice, analyse a website for brand signals, or create a
  persona profile.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: capability-uplift-content
  triggers:
    - scan website
    - brand DNA
    - brand profile
    - extract brand
    - analyse my brand
    - business identity
    - brand kit
    - pomelli
    - brand identity
    - brand voice
    - persona
    - dna
    - website analysis
context: fork
---

# Business DNA — Brand Profile Extraction

## Purpose

Scans a business website and builds a structured Brand DNA profile. This profile powers
every downstream skill: campaign generation, visual briefs, consistency checks, and
campaign planning. Inspired by Google Labs Pomelli — but outputs to Synthex workflows
including scheduling, analytics, and BYOK-powered content generation.

## Workflow

```
1. Collect URL from user
2. Run website analysis via lib/ai/website-analyzer.ts
3. Extract Business DNA (see schema below)
4. Display profile for user review and override
5. Persist to brand profile (if user confirms)
6. Offer next steps: campaign, visual brief, or planner
```

## Business DNA Schema

```typescript
interface BusinessDNA {
  // Identity
  brandName: string;
  tagline?: string;
  industry: string;
  location?: string; // For local SEO + tone

  // Audience
  targetAudience: string; // "small business owners aged 35-55"
  audiencePainPoints: string[];

  // Voice
  toneOfVoice: string[]; // e.g. ["professional", "direct", "approachable"]
  vocabulary: string[]; // Brand-specific terms to always use
  avoidWords: string[]; // Words/phrases to never use
  languageStyle: 'formal' | 'casual' | 'technical' | 'conversational';

  // Visual
  primaryColour: string; // Hex — e.g. "#00F5FF"
  secondaryColours: string[]; // Supporting palette
  typography: string; // Font family or description
  imageStyle: string; // e.g. "clean product shots on white"
  logoDescription?: string;

  // Value proposition
  usp: string; // Single-sentence unique selling proposition
  keyBenefits: string[]; // 3-5 core benefits
  differentiators: string[]; // What makes them different
  socialProof?: string; // Credentials, awards, client counts

  // Platforms
  activePlatforms: string[]; // Detected social platforms
  contentThemes: string[]; // Recurring content topics
}
```

## Extraction via Website Analyzer

**File:** `lib/ai/website-analyzer.ts`
Two-tier scraping: Firecrawl (primary) → native fetch fallback.

```typescript
import { analyzeWebsite } from '@/lib/ai/website-analyzer';

const result = await analyzeWebsite(url, businessName);
// result contains: description, audience, tone, products, credentials, social links
```

Map analyzer output to BusinessDNA schema — supplement with AI inference for
missing fields (colours, typography) by requesting the user's brand kit or
analysing visible design elements described in the scrape.

## User Override Mode

After extraction, ALWAYS display the DNA profile and invite corrections:

```
Here's your Business DNA — review and tell me anything that needs adjusting:

BRAND: [name]
INDUSTRY: [industry]
USP: [usp]
TONE: [tone array joined with ", "]
PRIMARY COLOUR: [hex]
TARGET AUDIENCE: [audience]
KEY BENEFITS: [benefits as bullet list]
CONTENT THEMES: [themes]

→ Type "looks good" to lock this in, or tell me what to change.
```

## Storing to Synthex Brand Profile

When confirmed, the DNA maps to Synthex's brand profile system:

- Brand name, USP, audience → `lib/ai/brand-context-builder.ts`
- Tone + vocabulary → Persona creation via `POST /api/personas`
- Colours + visual style → `app/dashboard/settings/brand-profile`

## After DNA is Locked

Offer the user next steps:

```
Your Business DNA is locked in. What would you like to do next?

1. Generate a social media campaign  → brand-campaign-generator skill
2. Create a visual content brief     → visual-content-brief skill
3. Plan your content calendar        → campaign-planner skill
4. Check existing content for brand  → brand-consistency-checker skill
```

## Common Issues

| Issue                | Fix                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Site blocks scraping | Ask user to paste homepage text or upload brand kit                                           |
| Colours not detected | Ask user to provide hex codes from their logo/website                                         |
| Tone unclear         | Ask 3 quick questions: "formal or casual?", "educational or inspiring?", "local or national?" |
| Missing audience     | Ask: "Who is your ideal customer in one sentence?"                                            |

---

## Capability Uplift — Override Defaults

**NEVER** describe a brand's tone as "professional and friendly" (every brand
says this), produce a target audience as "busy professionals aged 25–45" (too
generic to act on), or write brand values that sound like an MBA mission
statement ("we deliver excellence through innovation").

**INSTEAD** a high-quality Business DNA extraction includes:

1. **Vocabulary the brand actually uses** — specific words and phrases pulled
   verbatim from their website/materials, not inferred generics
2. **What the brand is NOT** — explicit exclusions are as valuable as inclusions
   ("never corporate-speak", "never aspirational fluff", "never discounts")
3. **Audience defined by outcome** — not demographics, but what they're seeking:
   - ✗ "Women aged 30–45 interested in wellness"
   - ✓ "Mums who want to lose the baby weight without giving up wine on Friday"
4. **Voice on a spectrum** — position on 3 axes:
   - Formal ←→ Casual
   - Serious ←→ Playful
   - Broad ←→ Niche

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
