# Trending Video Research And Board Review

## Scope

- Campaign: RestoreAssist.app launch
- Platforms: LinkedIn and Facebook
- Review date: 2026-05-16
- Constraint: no paid publishing, fake claims, fake testimonials, or unlicensed media.

## Research Reality Check

LinkedIn and Meta do not expose a universal public "ranking" table for all active B2B ads with full view counts. The reliable inputs for this pass are current platform guidance, public ad-library availability, and recent creative analyses of active SaaS and contractor ads.

## Signals To Implement

1. Shorter mobile-first cuts need to exist beside authority explainers.
   - LinkedIn guidance favours 15-second video ads for many high-performing placements.
   - The current 60-second authority explainer remains useful for warm audiences, but it should not be the only LinkedIn owner cut.

2. The first three seconds carry most of the ranking burden.
   - Facebook/SaaS creative analysis repeatedly points to the opening seconds as the skip-or-watch decision.
   - RestoreAssist cuts must show the pain immediately: scattered job data, report rework, or inconsistent assessor review.

3. Muted viewing must be treated as the default.
   - Every storyboard needs caption-complete on-screen text, not audio-dependent meaning.
   - Audio should improve the cut, not carry the core message.

4. Human and expert cues matter on LinkedIn.
   - LinkedIn's 2025 video research found stronger top-of-funnel dwell time when videos used expert speakers, conversational tone, human-centred framing, credentials, and clear brand cues.
   - RestoreAssist should use an operator/assessor voice and visible workflow credibility instead of generic SaaS animation.

5. One message per video.
   - High-performing SaaS examples generally isolate one pain, one transformation, and one action.
   - The RestoreAssist videos should avoid listing every feature in one cut.

6. Contractor-ad creative must build trust with real work proof.
   - Contractor guidance consistently favours sharp work visuals, direct benefits, clear CTAs, local or vertical relevance, retargeting, and A/B testing.
   - For RestoreAssist this means workflow screenshots, report export proof, sample report proof, and no unsupported outcome claims.

## Board Review

| Role | Review |
| --- | --- |
| Executive Chair | Approves the mock-mode package as strategically coherent, provided live export stays blocked until licences, consent, screenshots, and sample reports are real. |
| Brand Guardian | Requires every cut to keep the "client problem before product" rule and avoid guaranteed time, cost, or claim-approval language. |
| Psychology Lead | Recommends using operational frustration, relief, and professional pride, not fear-based emergency messaging. |
| Commercial Lead | Recommends a 15-second LinkedIn owner cut to compete for cold attention while preserving the longer explainer for retargeting and sales enablement. |
| QA Lead | Requires every storyboard to include ranking rationale and a test hypothesis so creative review ties to measurable outcomes. |

## Senior Project Manager Decisions

| SPM | Decision |
| --- | --- |
| LinkedIn Authority SPM | Add `linkedin-owner-thumbstop-15` as the cold-feed control. Keep `linkedin-authority` as the longer explainer for warm audiences. |
| Facebook Performance SPM | Keep both Facebook cuts vertical and muted-first. Track early hold, view completion, CTR, and trial CTA clicks separately. |
| Production SPM | Do not proceed to final render until approved screenshots, Artlist licence references, and export proof assets are attached. |

## Implemented Changes

- Added `rankingRationale` and `testHypothesis` metadata to every storyboard.
- Added a fifth video cut: `linkedin-owner-thumbstop-15`.
- Updated the dashboard storyboard panel so board/SPM rationale is visible before rendering.
- Updated the Remotion plan tests so the 15-second LinkedIn cut maps to a vertical `SocialReel`.

## Source Links

- LinkedIn video ad tips: `https://business.linkedin.com/advertise/ads/sponsored-content/video-ads/tips`
- LinkedIn ad types and video best practices: `https://www.linkedin.com/business/marketing/blog/linkedin-ads/a-b2b-marketer-s-guide-to-every-linkedin-ad-type`
- LinkedIn Art and Science of Video: `https://business.linkedin.com/content/dam/business/marketing-solutions/global/en_US/site/pdf/wp/2025/the-art-and-science-of-video.pdf`
- LinkedIn Ad Library help: `https://www.linkedin.com/help/lms/answer/a1632229`
- Meta video ads format page: `https://www.facebook.com/business/ads/video-ad-format`
- Meta creative strategy page: `https://www.facebook.com/business/ads/ad-creative`
- Meta Reels ads page: `https://www.facebook.com/business/ads/facebook-instagram-reels-ads`
- SaaS Facebook video ad analysis: `https://aimers.io/blog/facebook-video-ads-examples`
- Contractor Facebook ads guidance: `https://www.servicetitan.com/blog/contractor-facebook-ads`
