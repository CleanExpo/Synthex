# Partial Dashboard Routes Inventory

**Source:** `.planning/ROUTE_REFERENCE.md` lines 923–1022 (hand-maintained section).  
**Count:** 100 pages marked `(partial)` — page loads; end-to-end agency loop not closed.  
**Generated:** 2026-05-25

| #   | Page                            | URL                                      | APIs detected (if any)                                 |
| --- | ------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1   | Dashboard Home                  | /dashboard                               | `/api/dashboard/stats`                                 |
| 2   | Admin                           | /dashboard/admin                         | `/api/admin/users`, `/api/auth/request-reset`          |
| 3   | Admin — Bayesian Health         | /dashboard/admin/bayesian-health         | `/api/admin/bayesian-health`, `/api/predict/models`    |
| 4   | Admin — Remotion Studio         | /dashboard/admin/remotion-studio         | —                                                      |
| 5   | Affiliates                      | /dashboard/affiliates                    | —                                                      |
| 6   | AI Chat                         | /dashboard/ai-chat                       | —                                                      |
| 7   | AI Chat — Conversation          | /dashboard/ai-chat/[conversationId]      | —                                                      |
| 8   | AI Images                       | /dashboard/ai-images                     | —                                                      |
| 9   | Analytics                       | /dashboard/analytics                     | —                                                      |
| 10  | Analytics — Benchmarks          | /dashboard/analytics/benchmarks          | —                                                      |
| 11  | Approvals                       | /dashboard/approvals                     | —                                                      |
| 12  | Audience                        | /dashboard/audience                      | —                                                      |
| 13  | Authority                       | /dashboard/authority                     | `/api/authority/*`, `/api/billing/subscription`        |
| 14  | Authors                         | /dashboard/authors                       | `/api/authors`                                         |
| 15  | Autonomous                      | /dashboard/autonomous                    | —                                                      |
| 16  | Awards                          | /dashboard/awards                        | `/api/awards`, `/api/directories`, `/api/submissions`  |
| 17  | Backlinks                       | /dashboard/backlinks                     | `/api/backlinks/*`                                     |
| 18  | Backups                         | /dashboard/backups                       | —                                                      |
| 19  | Billing                         | /dashboard/billing                       | `/api/user/subscription`, `/api/stripe/billing-portal` |
| 20  | Bio — Pages                     | /dashboard/bio                           | —                                                      |
| 21  | Bio — Page Editor               | /dashboard/bio/[pageId]                  | —                                                      |
| 22  | Brand                           | /dashboard/brand                         | `/api/brand/*`                                         |
| 23  | Brand Voice                     | /dashboard/brand-voice                   | —                                                      |
| 24  | Businesses                      | /dashboard/businesses                    | —                                                      |
| 25  | Calendar                        | /dashboard/calendar                      | `/api/team`                                            |
| 26  | Citation                        | /dashboard/citation                      | `/api/citation/*`                                      |
| 27  | Collaboration                   | /dashboard/collaboration                 | —                                                      |
| 28  | Competitors                     | /dashboard/competitors                   | `/api/intelligence/competitors`                        |
| 29  | Content                         | /dashboard/content                       | drafts, generate, cross-post, scheduler                |
| 30  | Content — Cross-Post            | /dashboard/content/cross-post            | scheduler, cross-post                                  |
| 31  | Content — Drafts                | /dashboard/content/drafts                | content-drafts, scheduler                              |
| 32  | Content — Library               | /dashboard/content/library               | content-library                                        |
| 33  | Content — Multi-Format          | /dashboard/content/multi-format          | `/api/content/generate`                                |
| 34  | Content — Optimise              | /dashboard/content/optimize              | templates, ai-content/optimize                         |
| 35  | Content — Performance           | /dashboard/content/performance           | —                                                      |
| 36  | Content — Repurpose             | /dashboard/content/repurpose             | `/api/content/repurpose`                               |
| 37  | Creative Suite                  | /dashboard/creative-suite                | —                                                      |
| 38  | EEAT                            | /dashboard/eeat                          | `/api/eeat/v2/audit`                                   |
| 39  | Experiments                     | /dashboard/experiments                   | `/api/experiments/experiments`                         |
| 40  | Forecasting                     | /dashboard/forecasting                   | `/api/forecast/*`                                      |
| 41  | Geo                             | /dashboard/geo                           | `/api/geo/analyze`                                     |
| 42  | Geo — Optimiser                 | /dashboard/geo/optimiser                 | —                                                      |
| 43  | Google Business                 | /dashboard/google-business               | —                                                      |
| 44  | Google Business — Insights      | /dashboard/google-business/insights      | —                                                      |
| 45  | Google Business — Posts         | /dashboard/google-business/posts         | `/api/google-business/posts`                           |
| 46  | Google Business — Reviews       | /dashboard/google-business/reviews       | reviews reply/auto-reply                               |
| 47  | Help                            | /dashboard/help                          | —                                                      |
| 48  | Insights                        | /dashboard/insights                      | —                                                      |
| 49  | Integrations                    | /dashboard/integrations                  | —                                                      |
| 50  | Listening                       | /dashboard/listening                     | —                                                      |
| 51  | Local                           | /dashboard/local                         | oauth, google-business, local case-studies             |
| 52  | Monitoring                      | /dashboard/monitoring                    | —                                                      |
| 53  | Optimisation                    | /dashboard/optimisation                  | `/api/bayesian/*`                                      |
| 54  | Patterns                        | /dashboard/patterns                      | `/api/patterns/analyze`                                |
| 55  | Personas                        | /dashboard/personas                      | —                                                      |
| 56  | Platforms                       | /dashboard/platforms                     | `/api/auth/connections`                                |
| 57  | PR                              | /dashboard/pr                            | `/api/pr/press-releases`                               |
| 58  | Predictions                     | /dashboard/predictions                   | —                                                      |
| 59  | Prompts                         | /dashboard/prompts                       | `/api/prompts/*`                                       |
| 60  | Psychology                      | /dashboard/psychology                    | `/api/psychology/analyze`                              |
| 61  | Quality                         | /dashboard/quality                       | `/api/quality/audit`                                   |
| 62  | Referrals                       | /dashboard/referrals                     | `/api/referrals`                                       |
| 63  | Reports                         | /dashboard/reports                       | `/api/reporting/*`                                     |
| 64  | Reports — Builder               | /dashboard/reports/builder               | —                                                      |
| 65  | Research                        | /dashboard/research                      | auto-research, research                                |
| 66  | Revenue                         | /dashboard/revenue                       | —                                                      |
| 67  | ROI                             | /dashboard/roi                           | —                                                      |
| 68  | Roles                           | /dashboard/roles                         | `/api/teams/members`                                   |
| 69  | Sandbox                         | /dashboard/sandbox                       | —                                                      |
| 70  | Schedule                        | /dashboard/schedule                      | `/api/scheduler/posts`                                 |
| 71  | Schedule — Queue                | /dashboard/schedule/queue                | scheduler bulk                                         |
| 72  | Sentiment                       | /dashboard/sentiment                     | —                                                      |
| 73  | Sentinel                        | /dashboard/sentinel                      | `/api/sentinel/*`                                      |
| 74  | SEO                             | /dashboard/seo                           | —                                                      |
| 75  | SEO — Audit                     | /dashboard/seo/audit                     | `/api/seo/audit`, campaigns                            |
| 76  | SEO — Competitor                | /dashboard/seo/competitor                | `/api/seo/competitor`                                  |
| 77  | SEO — Geo Readiness             | /dashboard/seo/geo-readiness             | —                                                      |
| 78  | SEO — Page Analysis             | /dashboard/seo/page                      | page-analysis                                          |
| 79  | SEO — PageSpeed                 | /dashboard/seo/pagespeed                 | —                                                      |
| 80  | SEO — Scheduled Audits          | /dashboard/seo/scheduled-audits          | —                                                      |
| 81  | SEO — Schema                    | /dashboard/seo/schema                    | `/api/seo/schema`                                      |
| 82  | SEO — Search Console            | /dashboard/seo/search-console            | —                                                      |
| 83  | SEO — Search Console Properties | /dashboard/seo/search-console/properties | —                                                      |
| 84  | SEO — Sitemap                   | /dashboard/seo/sitemap                   | `/api/seo/sitemap`                                     |
| 85  | SEO — Technical                 | /dashboard/seo/technical                 | —                                                      |
| 86  | Settings                        | /dashboard/settings                      | —                                                      |
| 87  | Settings — Accounts             | /dashboard/settings/accounts             | auth accounts/link/unlink                              |
| 88  | Settings — Brand Profile        | /dashboard/settings/brand-profile        | —                                                      |
| 89  | Settings — Brand Setup          | /dashboard/settings/brand-setup          | —                                                      |
| 90  | Sponsors                        | /dashboard/sponsors                      | —                                                      |
| 91  | Tasks                           | /dashboard/tasks                         | —                                                      |
| 92  | Team                            | /dashboard/team                          | —                                                      |
| 93  | Unified                         | /dashboard/unified                       | —                                                      |
| 94  | Video                           | /dashboard/video                         | `/api/video`                                           |
| 95  | Visuals                         | /dashboard/visuals                       | `/api/visuals/*`                                       |
| 96  | Voice                           | /dashboard/voice                         | —                                                      |
| 97  | Web Projects                    | /dashboard/web-projects                  | `/api/web-projects`                                    |
| 98  | Web Projects — Detail           | /dashboard/web-projects/[id]             | web-projects id                                        |
| 99  | Webhooks                        | /dashboard/webhooks                      | —                                                      |
| 100 | Workflows                       | /dashboard/workflows                     | —                                                      |

## Track 1 priority routes (agency closure)

| URL                             | Why                                     |
| ------------------------------- | --------------------------------------- |
| /dashboard/advisor              | AT-026 — actions do not spawn workflows |
| /dashboard/tasks                | AT-029 — wrong task taxonomy            |
| /dashboard/autonomous           | AT-027 — no foundation/gates            |
| /dashboard/workflows            | AT-028 — content-campaign builtin start |
| /dashboard/brand-voice          | AT-003 — not mechanical gate            |
| /dashboard/reports              | AT-005 — Tier reporting partial         |
| /dashboard/platforms            | AT-031 — live publish E2E (GAP-005)     |
| /dashboard/settings/brand-setup | AT-030 — BrandDNA wizard (seed human)   |
