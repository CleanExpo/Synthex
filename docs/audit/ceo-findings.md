# CEO Audit — Commercial Findings

**Date:** 2026-03-26 | **Auditor:** CEO agent

## Dead CTAs (links going nowhere)

| Page               | CTA text                                     | Current href                                | Fix                                                                   |
| ------------------ | -------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `/docs`            | "View Full Docs" button × 6 (category cards) | No `href` — styled as buttons but not links | Add `href` to each card linking to sub-pages                          |
| `/docs`            | "Contact Support" button                     | No `href`                                   | Wire to `/contact`                                                    |
| `/docs`            | "Join Community" button                      | No `href`                                   | Wire to Discord/community URL                                         |
| `/blog`            | Page exists but no articles published        | N/A                                         | Publish 3 foundational articles OR hide nav link until content exists |
| Footer (all pages) | `https://status.synthex.social`              | External — unverified                       | Verify external status domain is live                                 |

## Feature claims without working destinations

| Page                  | Claim                                         | Issue                                 | Fix                                                               |
| --------------------- | --------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| API Reference         | "Official SDKs: JavaScript, Python, Ruby, Go" | "Coming soon" — no links              | Remove from features list until ready, or add early-access signup |
| API Reference         | "Webhooks"                                    | Described but no docs/examples        | Add basic webhook documentation                                   |
| Features/Pricing      | "White-label PDF reports"                     | Described, no demo                    | Link to a sample report or dashboard section                      |
| `/dashboard/invoices` | Invoice creation                              | Toast: "Invoice creation coming soon" | Remove from nav or add proper coming-soon state                   |
| `/dashboard/geo`      | Analysis history                              | Placeholder: "coming soon"            | Remove placeholder or wire to real data                           |

## Missing CTAs (sections with no next action)

| Page                 | Section                     | Recommended CTA                                                               |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `/blog`              | Hero                        | "Subscribe for updates" exists, add "Browse our guides →" when articles exist |
| `/integrations`      | Platform grid (9 platforms) | Each platform card needs "Connect" → `/dashboard/integrations`                |
| `/case-studies`      | Hero                        | "See all results" → `/case-studies` listing                                   |
| `/roadmap`           | Timeline items              | "Vote on a feature" or "Request a feature" link                               |
| Landing testimonials | 4 avatar cards              | Link through to `/case-studies` or full testimonials page                     |

## Navigation gaps

| Nav link               | Status          | Issue                                                                                      |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `/blog`                | ⚠️ Incomplete   | No published articles — shows "coming soon" — breaks thought-leader positioning            |
| Social links           | ⚠️ Inconsistent | 3 different handles used: `@synthex`, `@synthex_social`, `@synthexai` — standardise to one |
| Features → Analytics   | Missing         | "Real-time analytics" claim has no direct link to `/dashboard/analytics` from marketing    |
| Features → A/B Testing | Missing         | A/B testing feature has no link to `/dashboard/experiments`                                |

## Dashboard first impression

New users see: Welcome banner → "Create your first post in 2 minutes" with clear CTA to `/dashboard/content/drafts` and secondary "Connect a platform" → `/dashboard/integrations`. **Score: ✅ Clear and actionable.**

Returning users: Health Score, Visibility Score, Content Opportunities, Revenue Projection — all showing real data. **Score: ✅ Professional.**

## Priority fixes (by commercial impact)

1. **Blog nav** (HIGH) — Either publish 3+ articles or hide from nav. Current state damages credibility.
2. **Docs category cards** (HIGH) — 6 clickable cards that do nothing. Fix with hrefs immediately.
3. **Social handle inconsistency** (MEDIUM) — Standardise to one handle across all 3 locations.
4. **SDK "coming soon"** (MEDIUM) — Remove from API Reference feature list or add early-access form.
5. **Integrations platform cards** (MEDIUM) — Add "Connect" CTA to each of the 9 platform cards.
6. **Status page verification** (LOW) — Confirm `status.synthex.social` is live and updated.

## Summary

- **Dead CTAs:** 5 (docs cards ×6, contact/community buttons, blog, status link)
- **Feature gaps:** 5 (SDKs, webhooks, white-label demo, invoices, geo history)
- **Missing CTAs:** 5 (integrations cards, case studies, roadmap voting, testimonials link, blog articles)
- **Navigation status:** 90% working
- **Overall credibility score:** 7/10 — Core flows solid; blog and docs interactivity are weak points
