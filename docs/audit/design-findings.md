# Design Director Audit — Findings

**Date:** 2026-03-26 | **Auditor:** Design Director (design skill)

## Critical (breaks dark theme)

| File                                           | Line                | Issue                                                  | Fix                                            |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `app/dashboard/seo/schema/page.tsx`            | 128,175,221,259,283 | 5 hardcoded light boxes (bg-white + text-black)        | Replace with dark glass tokens                 |
| `components/api-key-gate/ApiKeyGate.tsx`       | 72                  | `text-black` on button                                 | Replace with `text-white` or `text-orange-400` |
| `components/api-key-gate/ApiKeySetupModal.tsx` | 128                 | `text-black` on button                                 | Replace with `text-white`                      |
| `components/dashboard/SocialConnectBanner.tsx` | 58                  | `text-black` on button                                 | Replace with `text-white`                      |
| `components/pr/DistributionPanel.tsx`          | 276                 | `text-black` on button                                 | Replace with `text-white`                      |
| `components/pr/PRGeneratorForm.tsx`            | 330                 | `text-black` on button                                 | Replace with `text-white`                      |
| `app/dashboard/invoices/page.tsx`              | 170,533             | `text-black` on buttons                                | Replace with `text-white`                      |
| `components/content/AuthorBlock.tsx`           | 50                  | `text-gray-900`                                        | Replace with `text-white/80`                   |
| `components/error-states/api-error.tsx`        | 197,220,357,368     | `text-gray-900`                                        | Replace with `text-white/80`                   |
| `app/dashboard/seo/displacement/page.tsx`      | 139,327,330         | `text-gray-900`                                        | Replace with `text-white/80`                   |
| `app/dashboard/seo/rankings/page.tsx`          | 215,362,368         | `text-gray-900`                                        | Replace with `text-white/80`                   |
| `app/dashboard/integrations/page.tsx`          | 115                 | `text-gray-900`                                        | Replace with `text-white/80`                   |
| `components/marketing/CTASection.tsx`          | 91,143,144,158,159  | 4 light-mode CTA overrides (`bg-white` + `text-black`) | Replace with glassmorphic dark tokens          |

## Moderate (inconsistent glassmorphism)

| File                                          | Line            | Issue                                    | Fix                                           |
| --------------------------------------------- | --------------- | ---------------------------------------- | --------------------------------------------- |
| `components/affiliates/LinkForm.tsx`          | 360,379,449     | `bg-white/20` → too bright               | Change to `bg-white/10`                       |
| `components/affiliates/NetworkForm.tsx`       | 220             | `bg-white/20`                            | Change to `bg-white/10`                       |
| `components/ai/image-preview-card.tsx`        | 176,185,199     | `bg-white/40` → overly bright            | Change to `bg-white/10`                       |
| `components/ui/progress.tsx`                  | 44              | glass: `bg-white/40`                     | Change to `bg-white/10`                       |
| `components/ui/slider.tsx`                    | 38              | glass: `bg-white/40`                     | Change to `bg-white/10`                       |
| `components/error-states/api-error.tsx`       | 177             | `bg-white/20` on hover                   | Change to `bg-white/10`                       |
| `components/experiments/DogfoodScorecard.tsx` | 129             | `bg-white/20` separator                  | Change to `bg-white/[0.06]`                   |
| `components/dashboard/SystemPulsePanel.tsx`   | 96              | `bg-white/20`                            | Change to `bg-white/10`                       |
| `components/ai/image-gallery.tsx`             | 79,82,170,173   | `text-gray-500` in empty states          | Replace with `text-white/40`                  |
| `components/ai/image-preview-card.tsx`        | 146,147         | `bg-gray-900` + `text-gray-700` fallback | Replace with `bg-slate-900` + `text-white/40` |
| `components/content/ObsidianImportModal.tsx`  | 347,387,487,515 | `placeholder:text-gray-600`              | Replace with `placeholder:text-white/30`      |
| `app/dashboard/brand/page.tsx`                | 196,205         | `placeholder:text-gray-600`              | Replace with `placeholder:text-white/30`      |

## Low (style hygiene)

| File                                         | Line          | Issue                              | Fix                                      |
| -------------------------------------------- | ------------- | ---------------------------------- | ---------------------------------------- |
| `components/admin/vault-import-dialog.tsx`   | 798,1150,1269 | Hardcoded hex `#0f1117`, `#1a1d27` | Replace with design tokens               |
| `components/ai/ai-file-input.tsx`            | 114,209       | Hardcoded `#0a0a0a`                | Replace with `bg-slate-950`              |
| `components/referral/ReferralCard.tsx`       | 128           | `placeholder:text-gray-600`        | Replace with `placeholder:text-white/30` |
| `components/workflows/NewWorkflowDialog.tsx` | 287,302       | `placeholder:text-gray-600`        | Replace with `placeholder:text-white/30` |

## Summary

- **Critical:** 29 violations across 13 files (text-black, bg-white injection)
- **Moderate:** 26 violations across 12 files (bg-white/20+, gray fallbacks)
- **Low:** ~15 violations across 4 files (hardcoded hex)
- **Files affected:** 29 total
- **Pass:** Typography (Space Grotesk confirmed), Spacing (4px scale confirmed)
