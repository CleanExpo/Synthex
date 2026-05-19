# RestoreAssist Video Production Agency

## Decision

Yes: the RestoreAssist launch can now be run as a full Codex-side marketing production team. The team can plan, script, storyboard, assemble Remotion-ready briefs, edit, sound-design, QA, package, and hand off the campaign. It cannot truthfully claim provider/live publishing readiness until credentials, consent, licences, and explicit paid-spend approval exist.

## Operating Rule

The agency works as a production line, not a brainstorming room. Each role produces a concrete artifact, passes it to the next role, and records blockers. No role may invent customer stories, product claims, third-party API capabilities, licences, or publishing approval.

## Executive Team

| Role | Function | Output |
| --- | --- | --- |
| Executive Board Chair | Final commercial decision and go/no-go. | Board memo, approval decision, risk acceptance. |
| Campaign Manager | Daily delivery, budget, status, blockers, launch calendar. | Daily log, launch dashboard, work order tracker. |
| LinkedIn Authority SPM | LinkedIn B2B authority, founder voice, lead magnet, outreach. | LinkedIn content pack and lead-generation sequence. |
| Facebook Performance SPM | Facebook organic/retargeting, short-form creative, fatigue checks. | Facebook creative matrix and performance rules. |
| Compliance Lead | Claims, evidence, consent, privacy, licensing. | Block/pass report and evidence pack. |
| QA Lead | Format, mobile, caption, brand, export, accessibility checks. | QA report and blocked reasons. |

## Production Team

| Role | Specialty | Required Artifact |
| --- | --- | --- |
| Video Director | Story, channel, duration, feeling, CTA. | `production-brief.json` per video. |
| Video Script Writer | Hook, voiceover, retention beats, CTA placement. | `storyboard.json` and `script-spec.md`. |
| Video Cinematographer | Shot language, source choice, frame composition. | `shot-list.json`. |
| Remotion Composition Builder | Builds React/Remotion scenes from briefs. | Draft video composition and raw render. |
| Video Editor | Cut rhythm, pacing, J/L cuts, retention gates. | Locked cut and cut notes. |
| Sound Designer | Voice, music, SFX, mix, loudness. | Mixed master and audio licence notes. |
| Colorist | Brand grade and platform grade tweaks. | Graded master. |
| Video Brand Guardian | Frame-by-frame brand and AI-slop audit. | Pass/fail audit. |
| Distribution Strategist | Platform-native variants, captions, thumbnails, metadata. | Variant matrix and posting metadata. |
| Asset Librarian | File naming, source records, licence records. | Export manifest. |

## Data And Strategy Team

| Role | Specialty | Required Artifact |
| --- | --- | --- |
| Target Audience Profiler | Restoration owner, tech, assessor, property manager, network lead. | Persona evidence map. |
| Competitor Intelligence Collector | Category frame and alternatives. | Competitor-risk notes for internal use only. |
| B2B Offer Structurer | Free report offer, checklist, operator review. | Offer ladder and CTA map. |
| Psychology Lead | Trust, cognitive load, objection handling. | Persuasion/risk memo. |
| MarTech/Data Engineer | UTM links, metrics sheet, tracking QA. | Tracking pack. |

## Creative Support Team

| Role | Specialty | Required Artifact |
| --- | --- | --- |
| Direct Response Copywriter | Facebook hooks and short captions. | Hook bank and ad copy set. |
| Thought Leadership Copywriter | LinkedIn authority/founder copy. | Founder post series. |
| Lead Magnet Optimizer | Checklist and download/conversation path. | Report readiness checklist PDF draft. |
| Carousel Slide Arranger | LinkedIn document/carousel structure. | 8-slide mobile-first carousel. |
| Thumbnail Optimizer | First-frame and static creative. | Thumbnail set for 9:16, 4:5, 1:1. |
| InMail Script Personalizer | Warm outreach. | Manual outreach script set. |

## First Production Slate

Only build the smallest asset set that can launch:

| Video | Channel | Duration | Aspect Ratios | Purpose |
| --- | --- | ---: | --- | --- |
| Authority Explainer | LinkedIn | 90s | 16:9, 1:1 | Establish trust and explain the workflow. |
| Workflow Cut | Facebook + LinkedIn | 30s | 9:16, 4:5, 1:1 | Show the product idea quickly. |
| Retargeting Cut | Facebook | 15s | 9:16, 4:5, 1:1 | Remind warm viewers to start with 3 reports. |
| Bumper | Facebook/Stories | 6s | 9:16 | Simple memory cue. |
| Board Review Explainer | Internal/client review | 120s | 16:9 | Approve strategy before external release. |

## Production Briefs

### RA-LAUNCH-BOARD-REVIEW

```json
{
  "job_id": "ra-launch-board-review-2026-05",
  "brand": "ra",
  "composition_type": "product-demo",
  "story_sentence": "Launch RestoreAssist with evidence, discipline, and client-first clarity.",
  "channel": "client-review",
  "duration_seconds": 120,
  "aspect_ratio": "16:9",
  "feeling": "confident",
  "cta": "Approve the story before production",
  "must_include": [
    "client-first strategy",
    "LinkedIn and Facebook roles",
    "persona map",
    "evidence, consent, licence, and QA gates"
  ],
  "must_avoid": [
    "unsupported claims",
    "paid spend approval",
    "Artlist video-generation assumptions",
    "fake testimonials"
  ],
  "brandconfig_path": "packages/brand-config/src/brands/ra.ts",
  "source_docs": [
    "docs/marketing-agency/RESTOREASSIST-LAUNCH-STORYBOARD-PLAN.md",
    "docs/marketing-agency/RESTOREASSIST-SHOESTRING-LAUNCH-CAMPAIGN.md"
  ]
}
```

### RA-LAUNCH-LINKEDIN-AUTHORITY

```json
{
  "job_id": "ra-launch-linkedin-authority-2026-05",
  "brand": "ra",
  "composition_type": "product-demo",
  "story_sentence": "RestoreAssist connects site evidence to clear restoration reports.",
  "channel": "linkedin",
  "duration_seconds": 90,
  "aspect_ratio": "16:9",
  "feeling": "confident",
  "cta": "Start with one real job",
  "must_include": [
    "inspection",
    "scoping",
    "estimating",
    "verified site data",
    "auditable reports",
    "free starter reports"
  ],
  "must_avoid": [
    "guaranteed time saved",
    "guaranteed claim approval",
    "competitor names",
    "AI-powered filler"
  ],
  "brandconfig_path": "packages/brand-config/src/brands/ra.ts"
}
```

### RA-LAUNCH-FACEBOOK-WORKFLOW

```json
{
  "job_id": "ra-launch-facebook-workflow-2026-05",
  "brand": "ra",
  "composition_type": "social-hook",
  "story_sentence": "Capture the job once and keep the report connected.",
  "channel": "facebook",
  "duration_seconds": 30,
  "aspect_ratio": "9:16",
  "feeling": "calm",
  "cta": "Start with 3 reports",
  "must_include": [
    "job evidence everywhere",
    "inspection, scoping, estimating",
    "verified site data",
    "PDF and Excel export"
  ],
  "must_avoid": [
    "fear tactics",
    "disaster ambience",
    "fake before-after",
    "unsupported outcomes"
  ],
  "brandconfig_path": "packages/brand-config/src/brands/ra.ts"
}
```

### RA-LAUNCH-RETARGETING-15

```json
{
  "job_id": "ra-launch-retargeting-15-2026-05",
  "brand": "ra",
  "composition_type": "social-hook",
  "story_sentence": "Reports should stay tied to the evidence.",
  "channel": "facebook",
  "duration_seconds": 15,
  "aspect_ratio": "9:16",
  "feeling": "calm",
  "cta": "Start with 3 reports",
  "must_include": [
    "scattered job notes",
    "connected workflow",
    "report export"
  ],
  "must_avoid": [
    "second CTA",
    "unverified claims",
    "paid approval language"
  ],
  "brandconfig_path": "packages/brand-config/src/brands/ra.ts"
}
```

## Execution Sequence

1. Campaign Manager opens the daily log and confirms blockers.
2. Compliance Lead checks source claims against RestoreAssist.app and repo source docs.
3. Video Director locks one production brief at a time.
4. Script Writer creates `storyboard.json` and voiceover.
5. Cinematographer creates `shot-list.json` with source decisions.
6. Remotion Builder creates draft composition.
7. Editor tightens the raw render.
8. Sound Designer adds voice/music/SFX only after licence status is known.
9. Colorist applies RestoreAssist brand grade.
10. Brand Guardian audits frames, captions, brand, and claims.
11. Distribution Strategist exports variants and metadata.
12. Campaign Manager packages final assets and updates launch dashboard.

## Work Order Board

| Work Order | Owner | Input | Output | Status |
| --- | --- | --- | --- | --- |
| WO-001 Landing trust check | Campaign Manager | RestoreAssist.app | Block/pass list | Pending |
| WO-002 Claims evidence pass | Compliance Lead | Campaign docs and site | Evidence pack | Pending |
| WO-003 Board review video brief | Video Director | Storyboard plan | Production brief | Ready |
| WO-004 LinkedIn authority script | Script Writer | Production brief | Script/storyboard | Ready |
| WO-005 Facebook 30s script | Script Writer | Production brief | Script/storyboard | Ready |
| WO-006 Shot lists | Cinematographer | Storyboards | Shot-list JSON | Pending |
| WO-007 Remotion scene system | Remotion Builder | Brand config, storyboards | Composition scaffold | Pending |
| WO-008 Checklist PDF export | Lead Magnet Optimizer | Checklist doc | PDF | Pending |
| WO-009 Audio shortlist | Sound Designer | Artlist brief | Track shortlist | Pending credentials |
| WO-010 QA and export manifest | QA Lead | Rendered variants | Export package | Pending |

## Required Source Assets

The team can start with existing brand and planning docs, but client-ready output needs:

- RestoreAssist logo SVG from repo.
- RestoreAssist app screenshots or approved screen recordings.
- RestoreAssist landing page screenshots.
- Pricing/free-report screenshot.
- Privacy/support page evidence.
- Approved product workflow footage or mock UI clearly labelled as mock.
- Founder voice consent if using Phill's voice or cloned voice.
- Artlist track metadata and licence evidence if using Artlist audio.

## Blockers That Stop Client-Ready Export

- Placeholder ABN remains visible on RestoreAssist.app.
- Product screenshots are unavailable or misleading.
- Founder voice/likeness consent is not recorded.
- Artlist licence evidence is missing for selected music.
- Any factual claim lacks source evidence.
- Any customer story/testimonial is invented or lacks consent.
- Meta paid publishing is requested without explicit approval.

## Campaign Manager Command Center

Use these files as the command center:

- `docs/marketing-agency/RESTOREASSIST-SHOESTRING-LAUNCH-CAMPAIGN.md`
- `docs/marketing-agency/RESTOREASSIST-LAUNCH-STORYBOARD-PLAN.md`
- `docs/marketing-agency/RESTOREASSIST-LAUNCH-ASSET-MANIFEST.md`
- `docs/marketing-agency/RESTOREASSIST-REPORT-READINESS-CHECKLIST.md`
- `docs/marketing-agency/RESTOREASSIST-VIDEO-PRODUCTION-AGENCY.md`

## Next Build Step

Create the Remotion production scaffold for the first two external videos:

1. `ra-launch-linkedin-authority-2026-05`
2. `ra-launch-facebook-workflow-2026-05`

The scaffold should use RestoreAssist brand tokens, structured scene data, mobile-safe captions, and export presets for 16:9, 9:16, 4:5, and 1:1.
