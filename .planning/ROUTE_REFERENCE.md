# Synthex Route Reference

> Auto-generated 2026-03-23. Read before implementing. Update the "Known issues" and "Last audited" fields after each task.
>
> **498 API routes · 100 dashboard pages · 104 Prisma models in use**
> Auth: 389 user-authed · 22 admin-only · 24 cron · 62 public (1 route counted once in "line total" = 498 lines, 497 distinct paths)

---

## Auth Levels

| Level    | Meaning                                                             |
| -------- | ------------------------------------------------------------------- |
| `user`   | Requires valid session (`getUserIdFromRequestOrCookies`)            |
| `admin`  | Owner email or admin role required (`verifyAdmin` / `isOwnerEmail`) |
| `cron`   | `CRON_SECRET` header required                                       |
| `public` | No auth — accessible without session                                |

---

## API Routes

Routes grouped by prefix. Format: `METHOD /api/path — auth — _models_`

### ab-testing

- `GET,POST /api/ab-testing/tests` — user — _aBTest_
- `GET,PUT,DELETE /api/ab-testing/tests/[testId]` — user — _aBTest_
- `GET,POST /api/ab-testing/tests/[testId]/results` — user — _aBTest, aBTestResult, aBTestVariant_

### activity

- `GET,POST /api/activity` — user — _post, auditLog_

### admin

- `GET /api/admin/audit-log` — admin — _auditLog_
- `GET /api/admin/bayesian-health` — admin
- `GET,POST /api/admin/invites` — admin — _inviteCode_
- `GET,POST /api/admin/jobs` — admin
- `GET,PATCH /api/admin/org-brand-profile` — admin — _user, organization_
- `GET,POST,DELETE /api/admin/platform-credentials` — admin — _user, platformOAuthCredential_
- `GET /api/admin/platform-stats` — admin — _user, subscription_
- `GET,POST /api/admin/remotion` — admin
- `POST /api/admin/upgrade-subscription` — admin
- `GET,POST,PATCH /api/admin/users` — admin — _user_
- `GET,POST,PATCH,DELETE /api/admin/vault` — admin — _user_
- `GET /api/admin/vault/access-log` — admin — _user_
- `POST /api/admin/vault/decrypt` — admin — _user_
- `POST /api/admin/vault/import-doc` — admin — _user_
- `POST /api/admin/vault/import-doc/confirm` — admin — _user, businessOwnership, vaultSecret_
- `GET,POST /api/admin/vault/seed-all` — admin — _user, organization, vaultSecret_

### affiliates

- `GET,POST /api/affiliates/links` — user
- `GET,PUT,DELETE /api/affiliates/links/[linkId]` — user
- `GET /api/affiliates/links/[linkId]/clicks` — user
- `GET,POST /api/affiliates/networks` — user
- `GET,PUT,DELETE /api/affiliates/networks/[networkId]` — user
- `GET /api/affiliates/stats` — user
- `GET /api/affiliates/track/[shortCode]` — public
- `POST /api/affiliates/webhook` — public

### agents

- `POST /api/agents/dispatch-campaign` — user — _campaign_
- `POST /api/agents/enhance-post` — user — _post, organization_

### ai

- `GET,POST /api/ai/chat/conversations` — user — _aIConversation_
- `GET,PATCH,DELETE /api/ai/chat/conversations/[conversationId]` — user — _aIConversation, aIMessage_
- `POST /api/ai/chat/conversations/[conversationId]/auto-title` — user — _aIConversation, aIMessage_
- `POST /api/ai/chat/conversations/[conversationId]/messages` — user — _aIConversation, aIMessage_
- `GET,POST /api/ai/generate-content` — user — _user_
- `GET,POST /api/ai/pm/conversations` — user — _aIConversation_
- `POST /api/ai/pm/conversations/[conversationId]/messages` — user — _aIConversation, aIMessage_
- `GET /api/ai/pm/digest` — user — _aIWeeklyDigest_
- `POST /api/ai/pm/feedback` — user — _aIMessage_
- `GET /api/ai/pm/suggestions` — user

### ai-content

- `POST /api/ai-content/hashtags` — user
- `POST /api/ai-content/optimize` — user
- `GET,POST /api/ai-content/sentiment` — user
- `POST /api/ai-content/sentiment/batch` — user
- `GET,POST /api/ai-content/translate` — user

### analytics

- `GET /api/analytics` — user — _campaign, post, apiUsage_
- `GET,POST,PUT /api/analytics/anomalies` — user
- `GET /api/analytics/benchmarks` — user — _platformConnection, platformPost_
- `GET /api/analytics/dashboard` — user
- `GET /api/analytics/dashboard-stats` — user — _campaign, post_
- `POST /api/analytics/engagement` — public
- `GET,POST /api/analytics/export` — user — _post, campaign_
- `GET /api/analytics/insights` — user — _campaign, post, analyticsEvent_
- `GET,POST /api/analytics/performance` — user — _post_
- `GET,POST /api/analytics/predict-engagement` — user
- `GET /api/analytics/realtime` — user — _campaign, analyticsEvent, post_
- `GET,POST /api/analytics/reports` — user
- `GET,POST,DELETE /api/analytics/reports/scheduled` — user — _report_
- `GET /api/analytics/sentiment` — user

### approvals

- `GET,POST /api/approvals` — user — _user, approvalRequest, workflowTemplate_
- `GET,PATCH,DELETE /api/approvals/[id]` — user — _teamNotification, user, approvalRequest_

### audience

- `GET /api/audience/insights` — user — _platformConnection, platformPost_

### auth

- `GET /api/auth/accounts` — user
- `GET,POST,DELETE /api/auth/api-keys` — user — _user_
- `GET /api/auth/callback/[platform]` — admin — _platformConnection, user_
- `GET,POST,DELETE /api/auth/connections` — user — _businessOwnership, platformConnection_
- `GET /api/auth/connections/status` — user — _platformConnection_
- `GET /api/auth/link/github` — user
- `GET /api/auth/link/google` — user
- `POST /api/auth/login` — user — _user, auditLog, session_
- `POST,DELETE /api/auth/logout` — user — _session, auditLog_
- `GET /api/auth/oauth/[platform]` — user — _user_
- `GET /api/auth/oauth/github` — user
- `GET /api/auth/oauth/github/callback` — user — _user_
- `GET /api/auth/oauth/google` — user
- `GET /api/auth/oauth/google/callback` — admin
- `GET,PUT /api/auth/profile` — user — _user_
- `POST /api/auth/refresh` — user — _user_
- `POST /api/auth/request-reset` — public — _user_
- `POST /api/auth/resend-verification` — user — _user_
- `GET,POST /api/auth/reset` — public
- `POST /api/auth/signup` — user — _inviteCode, user_
- `GET,POST /api/auth/unified` — admin — _user_
- `GET,POST /api/auth/unified-login` — public
- `POST,DELETE /api/auth/unlink/github` — user
- `POST,DELETE /api/auth/unlink/google` — user
- `GET,PUT /api/auth/user` — user — _user, auditLog_
- `POST /api/auth/validate-invite` — public — _inviteCode_
- `GET,POST /api/auth/verify-email` — user
- `GET,POST /api/auth/verify-token` — user

### authority

- `POST /api/authority/analyze` — user — _user_
- `GET /api/authority/citations` — user — _authorityAnalysis, authorityCitation_
- `POST /api/authority/design-audit` — user
- `GET /api/authority/sources` — user
- `POST /api/authority/validate-claim` — user

### authors

- `GET,POST /api/authors` — user — _authorProfile_
- `GET,PATCH,DELETE /api/authors/[id]` — user — _authorProfile_
- `GET /api/authors/[id]/schema` — user — _authorProfile_

### auto-research

- `GET,POST /api/auto-research` — user — _autoResearchRun_
- `GET /api/auto-research/[id]` — user — _autoResearchRun_
- `GET /api/auto-research/insights` — user — _trendInsight_

### autonomous

- `POST /api/autonomous/execute` — user — _user, workflowExecution_
- `POST /api/autonomous/parse` — user

### autopilot

- `GET,PATCH /api/autopilot/config` — user — _autopilotConfig_
- `POST /api/autopilot/preview` — user — _autopilotConfig_
- `GET /api/autopilot/runs` — user — _autopilotRun_
- `GET /api/autopilot/runs/[runId]` — user — _autopilotRun, post_
- `GET /api/autopilot/stats` — user — _autopilotRun, autopilotConfig_

### awards

- `GET,POST /api/awards` — user — _awardListing_
- `PATCH,DELETE /api/awards/[id]` — user — _awardListing_
- `POST /api/awards/[id]/generate-nomination` — user — _awardListing_
- `GET /api/awards/templates` — user

### backlinks

- `GET /api/backlinks/analysis` — user — _backlinkAnalysis_
- `POST /api/backlinks/analyze` — user — _user, backlinkAnalysis, backlinkProspect_
- `POST /api/backlinks/outreach` — user — _backlinkProspect_
- `GET,POST /api/backlinks/prospects` — user — _backlinkProspect_

### backup

- `GET,POST /api/backup` — cron

### bayesian

- `POST /api/bayesian/observe` — user — _user, bOSpace, bOObservation_
- `POST /api/bayesian/run` — user — _user, bOSpace, bOOptimisationRun_
- `GET,POST /api/bayesian/spaces` — user — _user, bOSpace_
- `GET /api/bayesian/status/[jobId]` — user — _user, bOOptimisationRun_
- `POST /api/bayesian/suggest` — user — _user, bOSpace, bOObservation_

### billing

- `GET /api/billing/subscription` — public

### bio

- `GET,POST /api/bio` — user — _linkBioPage_
- `GET,PATCH,DELETE /api/bio/[pageId]` — user — _linkBioPage_
- `GET,POST,PATCH,DELETE /api/bio/[pageId]/links` — user — _linkBioPage, linkBioLink_
- `POST /api/bio/[pageId]/track` — public — _linkBioPage, linkBioLink_

### brand

- `POST /api/brand/calendar` — user — _brandIdentity_
- `POST /api/brand/consistency` — user — _brandIdentity_
- `GET,POST /api/brand/generate` — user — _brandGeneration, userPsychologyPreference, psychologyPrinciple_
- `GET,POST /api/brand/identity` — user — _brandIdentity_
- `GET /api/brand/kg-check` — user — _brandIdentity_
- `GET /api/brand/mentions` — user — _brandIdentity, brandMention_
- `POST /api/brand/mentions/poll` — user — _brandIdentity, brandMention_
- `GET /api/brand/profile` — user — _brandDNA_
- `GET /api/brand/wikidata` — user — _brandIdentity_

### brand-dna

- `GET /api/brand-dna/[organizationId]` — user — _brandDNA_
- `POST /api/brand-dna/extract` — user
- `POST /api/brand-dna/refresh` — user — _brandDNA_

### brand-profile

- `GET,PATCH /api/brand-profile` — user — _user, organization_

### brand-voice

- `GET /api/brand-voice/review-queue` — user — _user, stepExecution_
- `POST /api/brand-voice/review-queue/[stepId]/approve` — user — _user, stepExecution_
- `POST /api/brand-voice/review-queue/[stepId]/reject` — user — _user, stepExecution, workflowExecution_
- `POST /api/brand-voice/score` — user — _user, persona_

### businesses

- `GET,POST /api/businesses` — user — _user_
- `PATCH,DELETE /api/businesses/[id]` — user — _businessOwnership, user_
- `GET /api/businesses/overview` — user
- `PATCH /api/businesses/switch` — user — _businessOwnership_

### campaigns

- `GET,POST,PUT,DELETE /api/campaigns` — user — _campaign_

### citation

- `GET /api/citation/opportunities` — user
- `GET /api/citation/overview` — user
- `GET /api/citation/timeline` — user

### clients

- `GET,POST,PUT,DELETE /api/clients` — user

### command-centre

- `GET /api/command-centre/activity` — user — _autopilotRun_
- `POST /api/command-centre/autopilot` — user — _autopilotConfig_
- `GET /api/command-centre/pending` — user — _post_
- `GET /api/command-centre/performance` — user — _post_
- `GET /api/command-centre/stats` — user — _post, autopilotRun, platformConnection_
- `GET /api/command-centre/status` — user — _autopilotConfig, autopilotRun, persona, platformConnection_

### comments

- `GET,POST /api/comments` — user — _contentComment_
- `GET,PATCH,DELETE /api/comments/[id]` — user — _contentComment_

### competitors

- `GET,POST /api/competitors` — user — _competitiveAnalysis, brandGeneration_
- `GET,POST /api/competitors/[competitorId]/analyze` — user
- `GET,PATCH /api/competitors/alerts` — user
- `GET,POST /api/competitors/track` — user
- `GET,PATCH,DELETE /api/competitors/track/[id]` — user
- `GET,POST /api/competitors/track/[id]/snapshot` — user
- `POST /api/competitors/track/execute` — cron

### content

- `GET /api/content` — user — _post_
- `GET /api/content-drafts` — user — _contentDraft_
- `GET,POST /api/content-drafts` — user — _contentDraft_
- `PATCH,DELETE /api/content-drafts/[id]` — user — _contentDraft_
- `GET,POST /api/content-library` — user — _contentLibrary_
- `GET,PATCH,DELETE /api/content-library/[id]` — user — _contentLibrary_
- `GET,PATCH,DELETE /api/content/[id]` — user — _post_
- `POST /api/content/branded` — user
- `POST /api/content/bulk` — user — _post, campaign_
- `GET,POST,PATCH /api/content/calendar` — user — _user, approvalRequest_
- `GET /api/content/calendar/optimal-times` — user
- `GET,POST,PATCH,DELETE /api/content/comments` — user — _user, campaign, post, auditLog_
- `POST /api/content/cross-post` — user
- `POST,PUT /api/content/generate` — user — _persona_
- `POST /api/content/multi-format` — public
- `GET /api/content/performance` — user — _platformConnection, platformPost_
- `POST /api/content/repurpose` — public
- `POST /api/content/score` — user — _user, promptTemplate_
- `GET,POST,DELETE /api/content/share` — user — _user_
- `GET,POST /api/content/variations` — public

### cron

- `GET /api/cron/analytics-sync` — cron — _organization, platformConnection_
- `GET,POST /api/cron/analyze-patterns` — cron
- `GET /api/cron/autopilot` — cron — _autopilotConfig, campaign, autopilotRun, post_
- `GET /api/cron/autopilot-learn` — cron — _autopilotConfig_
- `GET /api/cron/daily-post` — cron — _post_
- `GET /api/cron/fetch-mentions` — cron — _trackedKeyword, platformConnection, socialMention_
- `GET /api/cron/forecast-training` — cron — _forecastModel_
- `GET /api/cron/gbp-monitor` — cron — _gBPLocation, gBPSnapshot, gBPReview_
- `GET /api/cron/gsc-auto-index` — cron — _gSCProperty, platformPost, organization_
- `GET /api/cron/gsc-monitor` — cron — _gSCProperty, gSCSnapshot, user, notification_
- `GET /api/cron/health-score` — cron
- `GET,POST /api/cron/insights` — cron — _organization_
- `GET /api/cron/proactive-insights` — cron — _subscription, userHealthScore, platformMetrics, userStreak, analyticsEvent, notification_
- `GET /api/cron/publish-scheduled` — cron — _post, platformConnection, platformPost, notification_
- `GET /api/cron/refresh-tokens` — cron — _notification, platformConnection_
- `GET /api/cron/revalidate-api-keys` — cron — _aPICredential_
- `GET,POST /api/cron/sentinel` — cron
- `GET /api/cron/seo-audits` — cron — _sEOAudit_
- `GET /api/cron/unite-hub-revenue` — cron — _subscription_
- `GET /api/cron/weekly-digest` — cron — _subscription, aIWeeklyDigest, user_
- `GET /api/cron/welcome-sequence` — cron — _user, subscription_

### dashboard

- `GET /api/dashboard/onboarding-summary` — user — _organization, onboardingProgress, user_
- `GET /api/dashboard/stats` — user — _post, platformConnection, platformMetrics, campaign_

### demo

- `POST /api/demo/analyze` — public
- `POST /api/demo/caption` — public
- `POST /api/demo/image` — public

### directories

- `GET,POST /api/directories` — user — _directoryListing_
- `PATCH,DELETE /api/directories/[id]` — user — _directoryListing_
- `GET /api/directories/templates` — user

### eeat

- `POST /api/eeat/v2/assets` — user
- `GET,POST /api/eeat/v2/audit` — user — _eEATAudit_

### email

- `GET,POST /api/email/send` — user

### experiments

- `GET /api/experiments/dogfood` — user
- `GET,POST /api/experiments/experiments` — user — _sEOExperiment, user_
- `POST /api/experiments/experiments/[id]/complete` — user — _sEOExperiment, user_
- `POST /api/experiments/experiments/[id]/record` — user — _sEOExperiment, experimentObservation_
- `POST /api/experiments/experiments/[id]/start` — user — _sEOExperiment_
- `GET /api/experiments/healing` — user — _healingAction_
- `POST /api/experiments/healing/analyze` — user — _user_
- `POST /api/experiments/suggest` — user — _user_

### features

- `GET /api/features` — user — _subscription_

### forecast

- `GET /api/forecast/[modelId]` — user — _user, forecastModel_
- `GET,POST /api/forecast/models` — user — _user, forecastModel_
- `POST /api/forecast/predict` — user — _user, forecast, forecastModel_

### gamification

- `GET /api/gamification/achievements` — user — _userAchievement_
- `GET,POST /api/gamification/streak` — user — _userStreak_

### generate

- `POST /api/generate/diagram` — user
- `POST /api/generate/plot` — user

### geo

- `POST /api/geo/analyze` — user — _user, gEOAnalysis, entityAnalysis_
- `POST /api/geo/passages` — user
- `POST /api/geo/rewrite` — user
- `POST /api/geo/score` — user
- `POST /api/geo/tactic-score` — user

### google-business

- `GET /api/google-business/insights` — user — _gBPLocation, gBPSnapshot_
- `GET,POST /api/google-business/locations` — user — _gBPLocation_
- `GET,PATCH /api/google-business/locations/[locationId]` — user — _gBPLocation_
- `GET /api/google-business/photos` — user — _gBPLocation_
- `GET,POST /api/google-business/posts` — user — _gBPLocation_
- `GET /api/google-business/reviews` — user — _gBPReview_
- `POST /api/google-business/reviews/[reviewId]/auto-reply` — user — _gBPReview, organization_
- `POST,DELETE /api/google-business/reviews/[reviewId]/reply` — user — _gBPReview_

### health

- `GET,HEAD /api/health` — public
- `GET /api/health/ai` — public
- `GET /api/health/auth` — public
- `GET /api/health/composite` — user — _user_
- `GET /api/health/db` — public
- `GET /api/health/email` — public
- `GET,HEAD /api/health/live` — public
- `GET,HEAD /api/health/ready` — public
- `GET,POST,DELETE /api/health/redis` — admin
- `GET,POST /api/health/scaling` — public
- `GET /api/health/stripe` — public

### indexing

- `POST /api/indexing` — public

### insights

- `GET /api/insights` — user — _user, workflowExecution_

### integrations

- `GET,POST,DELETE /api/integrations` — user — _platformConnection_
- `GET,POST,DELETE /api/integrations/[integrationId]/connect` — user
- `GET /api/integrations/[integrationId]/status` — user — _platformConnection_
- `GET,POST /api/integrations/[integrationId]/sync` — user — _platformConnection, platformPost, platformMetrics_
- `GET /api/integrations/third-party` — user — _platformConnection_
- `GET,POST,DELETE /api/integrations/third-party/[provider]` — user — _platformConnection_
- `GET,PUT /api/integrations/third-party/[provider]/config` — user — _platformConnection_

### intelligence

- `GET,POST,DELETE /api/intelligence/competitors` — user

### internal

- `POST /api/internal/bo-callback` — public — _bOOptimisationRun, bOSpace_

### invoices

- `GET /api/invoices` — user — _subscription_

### library

- `GET,POST /api/library/content` — user — _contentLibrary_
- `GET,PATCH,DELETE /api/library/content/[contentId]` — user — _contentLibrary_

### listening

- `GET /api/listening` — user — _socialMention, trackedKeyword_
- `GET,POST,DELETE /api/listening/keywords` — user — _trackedKeyword, socialMention_
- `GET,PATCH /api/listening/mentions` — user — _socialMention_

### local

- `GET,POST /api/local/case-studies` — user — _localCaseStudy_

### loyalty

- `GET /api/loyalty` — user — _userLoyaltyTier_

### media

- `GET,POST,PUT /api/media/generate/image` — user
- `GET,POST,PUT /api/media/generate/video` — admin — _user_
- `GET,POST,PUT,DELETE /api/media/generate/voice` — user
- `GET,POST,PUT,DELETE /api/media/library` — user
- `POST /api/media/upload` — user

### mobile

- `GET /api/mobile/config` — user
- `POST /api/mobile/sync` — user

### moderation

- `GET,POST,PUT /api/moderation/check` — user

### monitoring

- `GET,POST /api/monitoring/alerts` — user
- `GET /api/monitoring/business-metrics` — user
- `GET,POST /api/monitoring/errors` — user
- `GET,POST /api/monitoring/events` — user
- `GET /api/monitoring/health-dashboard` — public
- `GET /api/monitoring/metrics` — public
- `GET,POST /api/monitoring/performance` — public

### notifications

- `GET,POST /api/notifications` — user — _notification_
- `PATCH /api/notifications/[notificationId]/read` — user — _notification_
- `GET,PUT /api/notifications/settings` — user — _user_
- `GET /api/notifications/stream` — user

### og

- `GET /api/og` — public

### onboarding

- `GET,POST /api/onboarding/api-credentials` — user — _aPICredential_
- `POST /api/onboarding/complete` — user — _user, organization, onboardingProgress_
- `GET,POST /api/onboarding/kickstart` — user — _user, post, onboardingProgress, platformConnection_
- `POST /api/onboarding/pipeline` — user — _organization, onboardingProgress_
- `GET,POST /api/onboarding/progress` — user — _organization, onboardingProgress_
- `POST /api/onboarding/review` — user — _organization, onboardingProgress_
- `POST /api/onboarding/validate-key` — user — _user_

### optimize

- `GET,POST,PUT /api/optimize/auto-schedule` — user — _user_

### organizations

- `GET,POST /api/organizations` — user — _organization_
- `GET,PATCH,DELETE /api/organizations/[orgId]` — user — _user, organization_

### patterns

- `GET,POST /api/patterns/analyze` — user
- `GET /api/patterns/cached` — public

### performance

- `GET,POST /api/performance/metrics` — public

### personas

- `GET,POST,PATCH,DELETE /api/personas` — user — _persona_
- `GET,POST /api/personas/[id]/optimize` — user — _persona, campaign, post_
- `GET,POST /api/personas/[id]/train` — user — _persona_

### ping

- `GET /api/ping` — public

### platforms

- `GET /api/platforms/[platform]/metrics` — user — _platformConnection, post_
- `GET /api/platforms/metrics` — user — _platformConnection, post_

### pr

- `GET /api/pr/channels` — public
- `GET,POST /api/pr/coverage` — user — _mediaCoverage_
- `POST /api/pr/coverage/poll` — user — _pRPitch, mediaCoverage_
- `GET,POST /api/pr/journalists` — user — _journalistContact_
- `GET,PATCH,DELETE /api/pr/journalists/[id]` — user — _journalistContact_
- `POST /api/pr/journalists/[id]/enrich` — user — _journalistContact_
- `GET,POST /api/pr/pitches` — user — _pRPitch, journalistContact_
- `GET,PATCH /api/pr/pitches/[id]` — user — _pRPitch_
- `GET,POST /api/pr/press-releases` — user — _pressRelease_
- `GET,PATCH,DELETE /api/pr/press-releases/[id]` — user — _pressRelease_
- `POST /api/pr/press-releases/[id]/distribute` — user — _pressRelease, pRDistribution_
- `GET,PATCH /api/pr/press-releases/[id]/distributions` — user — _pressRelease, pRDistribution_
- `POST /api/pr/press-releases/generate` — user
- `GET /api/pr/press-releases/newsroom/[orgSlug]/[slug]` — public — _organization, pressRelease_

### predict

- `GET /api/predict/models` — user — _user, spatiotemporalModel_
- `POST /api/predict/predict` — user — _user, spatiotemporalModel, platformConnection_
- `POST /api/predict/train` — user — _platformConnection, platformPost, platformMetrics, user, spatiotemporalModel_
- `GET,POST /api/predict/trends` — user

### prompts

- `GET /api/prompts/gaps` — user — _promptTracker_
- `POST /api/prompts/generate` — user
- `POST /api/prompts/test` — user — _promptTracker, user, promptResult_
- `GET,POST /api/prompts/trackers` — user — _promptTracker_

### psychology

- `GET,POST /api/psychology/analyze` — user — _user_
- `GET,POST /api/psychology/principles` — user — _userPsychologyPreference_

### quality

- `GET,POST /api/quality/audit` — user — _contentQualityAudit_
- `POST /api/quality/gate` — user

### quotes

- `GET,POST,DELETE /api/quotes` — user — _quote_
- `GET,PUT,PATCH,DELETE /api/quotes/[id]` — user — _quote_

### rate-limit

- `GET,POST,PATCH /api/rate-limit` — user

### recommendations

- `GET,POST,PUT /api/recommendations` — user

### referrals

- `GET,POST /api/referrals` — user — _referral, user_
- `POST /api/referrals/redeem` — user — _referral_

### reporting

- `GET,POST /api/reporting/generate` — user
- `GET /api/reporting/reports` — user
- `GET,DELETE /api/reporting/reports/[reportId]` — user
- `GET /api/reporting/reports/[reportId]/download` — user

### reports

- `GET,POST,PATCH,DELETE /api/reports/scheduled` — user — _user, auditLog_
- `GET,POST /api/reports/scheduled/execute` — cron — _analyticsEvent, report_
- `GET,POST,PATCH,DELETE /api/reports/templates` — user — _user, auditLog_

### research

- `GET,POST /api/research` — user — _gEOResearchReport_
- `GET,PATCH,DELETE /api/research/[id]` — user — _gEOResearchReport_
- `GET /api/research/capabilities` — user
- `POST /api/research/implementation-plan` — user
- `GET /api/research/trends` — user

### revenue

- `GET,POST /api/revenue` — user
- `GET,PUT,DELETE /api/revenue/[id]` — user

### roi

- `GET /api/roi` — user — _user_
- `GET,POST /api/roi/investments` — user
- `GET,PUT,DELETE /api/roi/investments/[id]` — user

### roles

- `GET,POST /api/roles` — user — _user, userRole_
- `GET,PATCH,DELETE /api/roles/[id]` — user — _user, role, userRole_
- `GET,POST,DELETE /api/roles/[id]/users` — user — _user, role_

### scheduler

- `GET,POST,PATCH,DELETE /api/scheduler/posts` — user — _campaign, post_
- `GET,PATCH,DELETE /api/scheduler/posts/[postId]` — user — _post_
- `POST /api/scheduler/posts/bulk` — user — _post_
- `GET /api/scheduler/stats` — user — _campaign, post_

### search

- `POST /api/search` — user — _campaign, post_

### sentinel

- `GET /api/sentinel/alerts` — user — _sentinelAlert_
- `POST /api/sentinel/alerts/[id]/acknowledge` — user — _sentinelAlert_
- `POST /api/sentinel/check` — user — _user_
- `GET /api/sentinel/status` — user — _user, sentinelAlert_
- `GET /api/sentinel/updates` — public

### seo

- `GET,POST /api/seo` — user — _sEOAudit_
- `GET,POST /api/seo/audit` — user — _sEOAudit, user_
- `POST /api/seo/competitor` — public
- `GET /api/seo/dashboard-stats` — user — _sEOAudit, gEOAnalysis_
- `POST /api/seo/enhancements` — user — _user_
- `POST /api/seo/enhancements/execute` — user — _user_
- `POST /api/seo/geo-readiness/analyze` — user — _gEOAnalysis_
- `GET /api/seo/geo-readiness/history` — user
- `GET /api/seo/geo-readiness/trends` — user
- `POST /api/seo/page-analysis` — public
- `POST /api/seo/pagespeed/analyze` — user
- `GET /api/seo/pagespeed/history` — user
- `GET /api/seo/pagespeed/trends` — user
- `GET,POST /api/seo/scheduled-audits` — user — _scheduledAuditTarget, sEOAudit_
- `GET,PATCH,DELETE /api/seo/scheduled-audits/[id]` — user — _scheduledAuditTarget, sEOAudit_
- `GET,POST /api/seo/schema` — user
- `POST /api/seo/schema-markup/extract` — user
- `GET /api/seo/schema-markup/templates` — public
- `POST /api/seo/schema-markup/validate` — user
- `POST /api/seo/search-console/analytics` — user
- `GET /api/seo/search-console/coverage` — user — _gSCSnapshot_
- `POST /api/seo/search-console/indexing` — user
- `POST /api/seo/search-console/indexing-status` — user
- `GET,POST /api/seo/search-console/properties` — user — _gSCProperty_
- `GET /api/seo/search-console/sitemaps` — user
- `POST /api/seo/search-console/sitemaps/submit` — user
- `POST /api/seo/sitemap` — public
- `GET /api/seo/technical/cwv-history` — user
- `POST /api/seo/technical/mobile-parity` — user
- `POST /api/seo/technical/robots-txt` — user

### settings

- `GET,POST,DELETE /api/settings/api-credentials` — user — _aPICredential_

### shares

- `GET,POST /api/shares` — user — _contentShare_
- `GET,PATCH,DELETE /api/shares/[id]` — user — _contentShare_

### social

- `GET,POST /api/social/facebook/post` — user
- `GET,POST /api/social/instagram/post` — user
- `GET,POST /api/social/linkedin/post` — user
- `GET,POST /api/social/pinterest/post` — user
- `GET,POST /api/social/post` — user — _platformConnection, post_
- `GET,POST /api/social/reddit/post` — user
- `GET,POST /api/social/threads/post` — user
- `GET,POST /api/social/tiktok/post` — user
- `GET,POST /api/social/twitter/post` — user
- `GET,POST /api/social/youtube/post` — user

### sponsors

- `GET,POST /api/sponsors` — user
- `GET,PUT,DELETE /api/sponsors/[id]` — user
- `GET,POST /api/sponsors/[id]/deals` — user
- `GET,PUT,DELETE /api/sponsors/[id]/deals/[dealId]` — user
- `GET,POST /api/sponsors/[id]/deals/[dealId]/deliverables` — user
- `PUT,DELETE /api/sponsors/[id]/deals/[dealId]/deliverables/[deliverableId]` — user
- `GET /api/sponsors/pipeline` — user

### stats

- `GET /api/stats` — user — _user, campaign, post, platformMetrics_

### stripe

- `POST /api/stripe/billing-portal` — user — _user_
- `GET,POST /api/stripe/change-plan` — user — _subscription_
- `POST /api/stripe/checkout` — user

### submissions

- `GET /api/submissions` — user — _awardListing, directoryListing_

### system

- `GET,POST /api/system/models` — admin

### tasks

- `GET,POST,PATCH,DELETE /api/tasks` — user — _task_
- `PATCH,DELETE /api/tasks/bulk` — user — _task_

### team

- `GET,POST /api/team` — user — _user, post, teamInvitation_

### teams

- `GET,PATCH,DELETE /api/teams/[id]/settings` — user — _user, organization_
- `GET /api/teams/activity` — user — _user, auditLog_
- `GET,POST /api/teams/invitations` — user — _user_
- `GET,PATCH,DELETE /api/teams/invitations/[id]` — user — _user_
- `POST /api/teams/invite` — user
- `GET,POST /api/teams/members` — admin — _user, userRole, teamInvitation_
- `GET,PATCH,DELETE /api/teams/members/[memberId]` — user — _user_
- `GET,PATCH /api/teams/members/[memberId]/role` — admin — _user_
- `GET /api/teams/members/search` — user — _user_
- `GET,POST,PATCH,DELETE /api/teams/notifications` — user — _user_
- `GET /api/teams/stats` — user — _user, campaign, post_

### templates

- `GET,POST /api/templates` — user — _user, promptTemplate_
- `GET,PUT,DELETE /api/templates/[id]` — user — _user, promptTemplate_
- `POST /api/templates/[id]/use` — user — _user, promptTemplate_

### trending

- `GET /api/trending` — public — _post_

### unified

- `GET /api/unified/metrics` — user — _platformConnection, post_

### unite-hub

- `GET /api/unite-hub` — public — _subscription, platformPost_
- `GET,POST /api/unite-hub/status` — admin — _user_

### user

- `GET,DELETE /api/user/account` — user
- `GET,POST,DELETE /api/user/api-keys` — user — _user_
- `POST,DELETE /api/user/avatar` — user — _user_
- `POST /api/user/change-password` — user
- `POST /api/user/export` — user — _user, campaign, platformConnection, post, subscription_
- `GET /api/user/health-score` — user — _userHealthScore_
- `GET /api/user/loyalty` — user — _userStreak, userAchievement_
- `GET,PUT,DELETE /api/user/profile` — user — _user_
- `GET,PUT /api/user/settings` — user — _user_
- `GET /api/user/subscription` — user
- `GET /api/user/usage` — user — _subscription, platformConnection, persona_

### video

- `GET,POST /api/video` — user
- `GET /api/video/[id]` — user — _videoGeneration_
- `POST /api/video/[id]/publish` — user — _videoGeneration, campaign, post_
- `POST /api/video/generate` — user — _videoGeneration_

### visuals

- `GET /api/visuals` — user
- `POST /api/visuals/generate` — user

### voice

- `POST /api/voice/analyze` — user — _voiceProfile_
- `POST /api/voice/capsule` — user — _contentCapsule_
- `POST /api/voice/context` — user — _voiceProfile_
- `POST /api/voice/slop-scan` — user

### web-projects

- `GET,POST /api/web-projects` — user — _project_
- `GET,PATCH,DELETE /api/web-projects/[id]` — user — _project_

### webhooks

- `GET,POST /api/webhooks/[platform]` — public
- `POST /api/webhooks/email/sendgrid` — user — _notification, user_
- `POST,PUT /api/webhooks/internal` — user
- `POST /api/webhooks/linear` — public
- `GET,POST /api/webhooks/social` — user — _post, auditLog, platformConnection_
- `GET,POST /api/webhooks/stats` — public
- `POST /api/webhooks/stripe` — public
- `GET,POST,PATCH,DELETE /api/webhooks/user` — user — _webhookEndpoint, auditLog_
- `GET,POST /api/webhooks/zapier` — public

### white-label

- `GET,PUT /api/white-label/config` — user — _user, organization_

### workflows

- `GET,POST /api/workflows/batch` — user — _user, workflowTemplate, workflowExecution_
- `GET /api/workflows/batch/[batchId]` — user — _user_
- `GET,POST /api/workflows/executions` — user — _user, workflowExecution_
- `GET /api/workflows/executions/[id]` — user — _user, workflowExecution_
- `POST /api/workflows/executions/[id]/approve` — user — _user, workflowExecution, stepExecution_
- `POST /api/workflows/executions/[id]/cancel` — user — _user, workflowExecution_
- `GET,POST /api/workflows/intelligence` — user — _user, workflowExecution, stepExecution, workflowTemplate_
- `GET,POST /api/workflows/templates` — user — _user, workflowTemplate_

### ws

- `GET,POST,OPTIONS /api/ws` — user

---

## Dashboard Pages

| Page                            | URL                                      | API calls detected                                                                                                                                                             |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard Home                  | /dashboard                               | `/api/dashboard/stats` (partial)                                                                                                                                               |
| Admin                           | /dashboard/admin                         | `/api/admin/users`, `/api/auth/request-reset` (partial)                                                                                                                        |
| Admin — Bayesian Health         | /dashboard/admin/bayesian-health         | `/api/admin/bayesian-health`, `/api/predict/models` (partial)                                                                                                                  |
| Admin — Remotion Studio         | /dashboard/admin/remotion-studio         | (partial)                                                                                                                                                                      |
| Affiliates                      | /dashboard/affiliates                    | (partial)                                                                                                                                                                      |
| AI Chat                         | /dashboard/ai-chat                       | (partial)                                                                                                                                                                      |
| AI Chat — Conversation          | /dashboard/ai-chat/[conversationId]      | (partial)                                                                                                                                                                      |
| AI Images                       | /dashboard/ai-images                     | (partial)                                                                                                                                                                      |
| Analytics                       | /dashboard/analytics                     | (partial)                                                                                                                                                                      |
| Analytics — Benchmarks          | /dashboard/analytics/benchmarks          | (partial)                                                                                                                                                                      |
| Approvals                       | /dashboard/approvals                     | (partial)                                                                                                                                                                      |
| Audience                        | /dashboard/audience                      | (partial)                                                                                                                                                                      |
| Authority                       | /dashboard/authority                     | `/api/authority/sources`, `/api/billing/subscription`, `/api/authority/analyze`, `/api/authority/design-audit` (partial)                                                       |
| Authors                         | /dashboard/authors                       | `/api/authors` (partial)                                                                                                                                                       |
| Autonomous                      | /dashboard/autonomous                    | (partial)                                                                                                                                                                      |
| Awards                          | /dashboard/awards                        | `/api/awards`, `/api/directories`, `/api/submissions`, `/api/awards/[id]`, `/api/directories/[id]`, `/api/awards/[awardId]/generate-nomination` (partial)                      |
| Backlinks                       | /dashboard/backlinks                     | `/api/backlinks/prospects`, `/api/backlinks/analysis`, `/api/backlinks/analyze`, `/api/backlinks/outreach` (partial)                                                           |
| Backups                         | /dashboard/backups                       | (partial)                                                                                                                                                                      |
| Billing                         | /dashboard/billing                       | `/api/user/subscription`, `/api/user/usage`, `/api/stripe/billing-portal` (partial)                                                                                            |
| Bio — Pages                     | /dashboard/bio                           | (partial)                                                                                                                                                                      |
| Bio — Page Editor               | /dashboard/bio/[pageId]                  | (partial)                                                                                                                                                                      |
| Brand                           | /dashboard/brand                         | `/api/brand/identity`, `/api/brand/consistency`, `/api/brand/wikidata`, `/api/brand/kg-check` (partial)                                                                        |
| Brand Voice                     | /dashboard/brand-voice                   | (partial)                                                                                                                                                                      |
| Businesses                      | /dashboard/businesses                    | (partial)                                                                                                                                                                      |
| Calendar                        | /dashboard/calendar                      | `/api/team` (partial)                                                                                                                                                          |
| Citation                        | /dashboard/citation                      | `/api/citation/overview`, `/api/citation/timeline`, `/api/citation/opportunities` (partial)                                                                                    |
| Collaboration                   | /dashboard/collaboration                 | (partial)                                                                                                                                                                      |
| Competitors                     | /dashboard/competitors                   | `/api/intelligence/competitors` (partial)                                                                                                                                      |
| Content                         | /dashboard/content                       | `/api/content-drafts`, `/api/ai/generate-content`, `/api/content/cross-post`, `/api/psychology/analyze`, `/api/analytics/predict-engagement`, `/api/scheduler/posts` (partial) |
| Content — Cross-Post            | /dashboard/content/cross-post            | `/api/scheduler/posts`, `/api/content/cross-post` (partial)                                                                                                                    |
| Content — Drafts                | /dashboard/content/drafts                | `/api/content-drafts`, `/api/scheduler/posts` (partial)                                                                                                                        |
| Content — Library               | /dashboard/content/library               | `/api/content-library`, `/api/content-library/[id]` (partial)                                                                                                                  |
| Content — Multi-Format          | /dashboard/content/multi-format          | `/api/content/generate` (partial)                                                                                                                                              |
| Content — Optimise              | /dashboard/content/optimize              | `/api/templates`, `/api/ai-content/optimize` (partial)                                                                                                                         |
| Content — Performance           | /dashboard/content/performance           | (partial)                                                                                                                                                                      |
| Content — Repurpose             | /dashboard/content/repurpose             | `/api/content/repurpose` (partial)                                                                                                                                             |
| Creative Suite                  | /dashboard/creative-suite                | (partial)                                                                                                                                                                      |
| EEAT                            | /dashboard/eeat                          | `/api/eeat/v2/audit` (partial)                                                                                                                                                 |
| Experiments                     | /dashboard/experiments                   | `/api/experiments/experiments` (partial)                                                                                                                                       |
| Forecasting                     | /dashboard/forecasting                   | `/api/forecast/models`, `/api/forecast/predict` (partial)                                                                                                                      |
| Geo                             | /dashboard/geo                           | `/api/geo/analyze` (partial)                                                                                                                                                   |
| Geo — Optimiser                 | /dashboard/geo/optimiser                 | (partial)                                                                                                                                                                      |
| Google Business                 | /dashboard/google-business               | (partial)                                                                                                                                                                      |
| Google Business — Insights      | /dashboard/google-business/insights      | (partial)                                                                                                                                                                      |
| Google Business — Posts         | /dashboard/google-business/posts         | `/api/google-business/posts` (partial)                                                                                                                                         |
| Google Business — Reviews       | /dashboard/google-business/reviews       | `/api/google-business/reviews/[reviewId]/reply`, `/api/google-business/reviews/[reviewId]/auto-reply` (partial)                                                                |
| Help                            | /dashboard/help                          | (partial)                                                                                                                                                                      |
| Insights                        | /dashboard/insights                      | (partial)                                                                                                                                                                      |
| Integrations                    | /dashboard/integrations                  | (partial)                                                                                                                                                                      |
| Listening                       | /dashboard/listening                     | (partial)                                                                                                                                                                      |
| Local                           | /dashboard/local                         | `/api/auth/oauth/[platform]`, `/api/google-business/posts`, `/api/local/case-studies`, `/api/google-business/reviews/[id]/auto-reply` (partial)                                |
| Monitoring                      | /dashboard/monitoring                    | (partial)                                                                                                                                                                      |
| Optimisation                    | /dashboard/optimisation                  | `/api/bayesian/spaces`, `/api/bayesian/run` (partial)                                                                                                                          |
| Patterns                        | /dashboard/patterns                      | `/api/patterns/analyze` (partial)                                                                                                                                              |
| Personas                        | /dashboard/personas                      | (partial)                                                                                                                                                                      |
| Platforms                       | /dashboard/platforms                     | `/api/auth/connections` (partial)                                                                                                                                              |
| PR                              | /dashboard/pr                            | `/api/pr/press-releases` (partial)                                                                                                                                             |
| Predictions                     | /dashboard/predictions                   | (partial)                                                                                                                                                                      |
| Prompts                         | /dashboard/prompts                       | `/api/prompts/trackers`, `/api/prompts/test`, `/api/prompts/gaps` (partial)                                                                                                    |
| Psychology                      | /dashboard/psychology                    | `/api/psychology/analyze` (partial)                                                                                                                                            |
| Quality                         | /dashboard/quality                       | `/api/quality/audit` (partial)                                                                                                                                                 |
| Referrals                       | /dashboard/referrals                     | `/api/referrals` (partial)                                                                                                                                                     |
| Reports                         | /dashboard/reports                       | `/api/reporting/reports`, `/api/reporting/generate` (partial)                                                                                                                  |
| Reports — Builder               | /dashboard/reports/builder               | (partial)                                                                                                                                                                      |
| Research                        | /dashboard/research                      | `/api/auto-research`, `/api/auto-research/insights`, `/api/research` (partial)                                                                                                 |
| Revenue                         | /dashboard/revenue                       | (partial)                                                                                                                                                                      |
| ROI                             | /dashboard/roi                           | (partial)                                                                                                                                                                      |
| Roles                           | /dashboard/roles                         | `/api/teams/members` (partial)                                                                                                                                                 |
| Sandbox                         | /dashboard/sandbox                       | (partial)                                                                                                                                                                      |
| Schedule                        | /dashboard/schedule                      | `/api/scheduler/posts` (partial)                                                                                                                                               |
| Schedule — Queue                | /dashboard/schedule/queue                | `/api/scheduler/posts`, `/api/scheduler/posts/bulk` (partial)                                                                                                                  |
| Sentiment                       | /dashboard/sentiment                     | (partial)                                                                                                                                                                      |
| Sentinel                        | /dashboard/sentinel                      | `/api/sentinel/status`, `/api/sentinel/alerts`, `/api/sentinel/updates`, `/api/sentinel/check`, `/api/sentinel/alerts/[id]/acknowledge` (partial)                              |
| SEO                             | /dashboard/seo                           | (partial)                                                                                                                                                                      |
| SEO — Audit                     | /dashboard/seo/audit                     | `/api/seo/audit`, `/api/campaigns` (partial)                                                                                                                                   |
| SEO — Competitor                | /dashboard/seo/competitor                | `/api/seo/competitor` (partial)                                                                                                                                                |
| SEO — Geo Readiness             | /dashboard/seo/geo-readiness             | (partial)                                                                                                                                                                      |
| SEO — Page Analysis             | /dashboard/seo/page                      | `/api/seo/page-analysis` (partial)                                                                                                                                             |
| SEO — PageSpeed                 | /dashboard/seo/pagespeed                 | (partial)                                                                                                                                                                      |
| SEO — Scheduled Audits          | /dashboard/seo/scheduled-audits          | (partial)                                                                                                                                                                      |
| SEO — Schema                    | /dashboard/seo/schema                    | `/api/seo/schema` (partial)                                                                                                                                                    |
| SEO — Search Console            | /dashboard/seo/search-console            | (partial)                                                                                                                                                                      |
| SEO — Search Console Properties | /dashboard/seo/search-console/properties | (partial)                                                                                                                                                                      |
| SEO — Sitemap                   | /dashboard/seo/sitemap                   | `/api/seo/sitemap` (partial)                                                                                                                                                   |
| SEO — Technical                 | /dashboard/seo/technical                 | (partial)                                                                                                                                                                      |
| Settings                        | /dashboard/settings                      | (partial)                                                                                                                                                                      |
| Settings — Accounts             | /dashboard/settings/accounts             | `/api/auth/accounts`, `/api/auth/link/[provider]`, `/api/auth/unlink/[provider]` (partial)                                                                                     |
| Settings — Brand Profile        | /dashboard/settings/brand-profile        | (partial)                                                                                                                                                                      |
| Settings — Brand Setup          | /dashboard/settings/brand-setup          | (partial)                                                                                                                                                                      |
| Sponsors                        | /dashboard/sponsors                      | (partial)                                                                                                                                                                      |
| Tasks                           | /dashboard/tasks                         | (partial)                                                                                                                                                                      |
| Team                            | /dashboard/team                          | (partial)                                                                                                                                                                      |
| Unified                         | /dashboard/unified                       | (partial)                                                                                                                                                                      |
| Video                           | /dashboard/video                         | `/api/video` (partial)                                                                                                                                                         |
| Visuals                         | /dashboard/visuals                       | `/api/visuals`, `/api/visuals/generate` (partial)                                                                                                                              |
| Voice                           | /dashboard/voice                         | (partial)                                                                                                                                                                      |
| Web Projects                    | /dashboard/web-projects                  | `/api/web-projects`, `/api/web-projects/[id]` (partial)                                                                                                                        |
| Web Projects — Detail           | /dashboard/web-projects/[id]             | `/api/web-projects/[id]` (partial)                                                                                                                                             |
| Webhooks                        | /dashboard/webhooks                      | (partial)                                                                                                                                                                      |
| Workflows                       | /dashboard/workflows                     | (partial)                                                                                                                                                                      |

---

## Prisma Model → Routes Index

Reverse lookup: which routes touch each model. Top 30 most-used models.

| Model              | Route count | Routes (first 8 shown)                                                                                                                                                                                                                                                            |
| ------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user               | 114         | `/api/admin/org-brand-profile`, `/api/admin/platform-credentials`, `/api/admin/platform-stats`, `/api/admin/users`, `/api/admin/vault`, `/api/admin/vault/access-log`, `/api/admin/vault/decrypt`, `/api/admin/vault/import-doc` … (+106 more)                                    |
| post               | 38          | `/api/activity`, `/api/agents/enhance-post`, `/api/analytics`, `/api/analytics/dashboard-stats`, `/api/analytics/export`, `/api/analytics/insights`, `/api/analytics/performance`, `/api/analytics/realtime` … (+30 more)                                                         |
| platformConnection | 29          | `/api/analytics/benchmarks`, `/api/audience/insights`, `/api/auth/callback/[platform]`, `/api/auth/connections`, `/api/auth/connections/status`, `/api/command-centre/stats`, `/api/command-centre/status`, `/api/content/performance` … (+21 more)                               |
| campaign           | 19          | `/api/agents/dispatch-campaign`, `/api/analytics`, `/api/analytics/dashboard-stats`, `/api/analytics/export`, `/api/analytics/insights`, `/api/analytics/realtime`, `/api/campaigns`, `/api/content/bulk` … (+11 more)                                                            |
| organization       | 18          | `/api/admin/org-brand-profile`, `/api/admin/vault/seed-all`, `/api/agents/enhance-post`, `/api/brand-profile`, `/api/cron/analytics-sync`, `/api/cron/gsc-auto-index`, `/api/cron/insights`, `/api/dashboard/onboarding-summary` … (+10 more)                                     |
| auditLog           | 11          | `/api/activity`, `/api/admin/audit-log`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/user`, `/api/content/comments`, `/api/reports/scheduled`, `/api/reports/templates` … (+3 more)                                                                                         |
| subscription       | 11          | `/api/admin/platform-stats`, `/api/cron/proactive-insights`, `/api/cron/unite-hub-revenue`, `/api/cron/weekly-digest`, `/api/cron/welcome-sequence`, `/api/features`, `/api/invoices`, `/api/stripe/change-plan` … (+3 more)                                                      |
| workflowExecution  | 9           | `/api/autonomous/execute`, `/api/brand-voice/review-queue/[stepId]/reject`, `/api/insights`, `/api/workflows/batch`, `/api/workflows/executions`, `/api/workflows/executions/[id]`, `/api/workflows/executions/[id]/approve`, `/api/workflows/executions/[id]/cancel` … (+1 more) |
| platformPost       | 8           | `/api/analytics/benchmarks`, `/api/audience/insights`, `/api/content/performance`, `/api/cron/gsc-auto-index`, `/api/cron/publish-scheduled`, `/api/integrations/[integrationId]/sync`, `/api/predict/train`, `/api/unite-hub`                                                    |
| autopilotConfig    | 7           | `/api/autopilot/config`, `/api/autopilot/preview`, `/api/autopilot/stats`, `/api/command-centre/autopilot`, `/api/command-centre/status`, `/api/cron/autopilot`, `/api/cron/autopilot-learn`                                                                                      |
| autopilotRun       | 7           | `/api/autopilot/runs`, `/api/autopilot/runs/[runId]`, `/api/autopilot/stats`, `/api/command-centre/activity`, `/api/command-centre/stats`, `/api/command-centre/status`, `/api/cron/autopilot`                                                                                    |
| persona            | 7           | `/api/brand-voice/score`, `/api/command-centre/status`, `/api/content/generate`, `/api/personas`, `/api/personas/[id]/optimize`, `/api/personas/[id]/train`, `/api/user/usage`                                                                                                    |
| brandIdentity      | 7           | `/api/brand/calendar`, `/api/brand/consistency`, `/api/brand/identity`, `/api/brand/kg-check`, `/api/brand/mentions`, `/api/brand/mentions/poll`, `/api/brand/wikidata`                                                                                                           |
| notification       | 7           | `/api/cron/gsc-monitor`, `/api/cron/proactive-insights`, `/api/cron/publish-scheduled`, `/api/cron/refresh-tokens`, `/api/notifications`, `/api/notifications/[notificationId]/read`, `/api/webhooks/email/sendgrid`                                                              |
| aIConversation     | 6           | `/api/ai/chat/conversations`, `/api/ai/chat/conversations/[conversationId]`, `/api/ai/chat/conversations/[conversationId]/auto-title`, `/api/ai/chat/conversations/[conversationId]/messages`, `/api/ai/pm/conversations`, `/api/ai/pm/conversations/[conversationId]/messages`   |
| gBPLocation        | 6           | `/api/cron/gbp-monitor`, `/api/google-business/insights`, `/api/google-business/locations`, `/api/google-business/locations/[locationId]`, `/api/google-business/photos`, `/api/google-business/posts`                                                                            |
| sEOAudit           | 6           | `/api/cron/seo-audits`, `/api/seo`, `/api/seo/audit`, `/api/seo/dashboard-stats`, `/api/seo/scheduled-audits`, `/api/seo/scheduled-audits/[id]`                                                                                                                                   |
| onboardingProgress | 6           | `/api/dashboard/onboarding-summary`, `/api/onboarding/complete`, `/api/onboarding/kickstart`, `/api/onboarding/pipeline`, `/api/onboarding/progress`, `/api/onboarding/review`                                                                                                    |
| aIMessage          | 5           | `/api/ai/chat/conversations/[conversationId]`, `/api/ai/chat/conversations/[conversationId]/auto-title`, `/api/ai/chat/conversations/[conversationId]/messages`, `/api/ai/pm/conversations/[conversationId]/messages`, `/api/ai/pm/feedback`                                      |
| bOSpace            | 5           | `/api/bayesian/observe`, `/api/bayesian/run`, `/api/bayesian/spaces`, `/api/bayesian/suggest`, `/api/internal/bo-callback`                                                                                                                                                        |
| stepExecution      | 5           | `/api/brand-voice/review-queue`, `/api/brand-voice/review-queue/[stepId]/approve`, `/api/brand-voice/review-queue/[stepId]/reject`, `/api/workflows/executions/[id]/approve`, `/api/workflows/intelligence`                                                                       |
| platformMetrics    | 5           | `/api/cron/proactive-insights`, `/api/dashboard/stats`, `/api/integrations/[integrationId]/sync`, `/api/predict/train`, `/api/stats`                                                                                                                                              |
| pressRelease       | 5           | `/api/pr/press-releases`, `/api/pr/press-releases/[id]`, `/api/pr/press-releases/[id]/distribute`, `/api/pr/press-releases/[id]/distributions`, `/api/pr/press-releases/newsroom/[orgSlug]/[slug]`                                                                                |
| businessOwnership  | 4           | `/api/admin/vault/import-doc/confirm`, `/api/auth/connections`, `/api/businesses/[id]`, `/api/businesses/switch`                                                                                                                                                                  |
| analyticsEvent     | 4           | `/api/analytics/insights`, `/api/analytics/realtime`, `/api/cron/proactive-insights`, `/api/reports/scheduled/execute`                                                                                                                                                            |
| workflowTemplate   | 4           | `/api/approvals`, `/api/workflows/batch`, `/api/workflows/intelligence`, `/api/workflows/templates`                                                                                                                                                                               |
| awardListing       | 4           | `/api/awards`, `/api/awards/[id]`, `/api/awards/[id]/generate-nomination`, `/api/submissions`                                                                                                                                                                                     |
| linkBioPage        | 4           | `/api/bio`, `/api/bio/[pageId]`, `/api/bio/[pageId]/links`, `/api/bio/[pageId]/track`                                                                                                                                                                                             |
| contentLibrary     | 4           | `/api/content-library`, `/api/content-library/[id]`, `/api/library/content`, `/api/library/content/[contentId]`                                                                                                                                                                   |
| promptTemplate     | 4           | `/api/content/score`, `/api/templates`, `/api/templates/[id]`, `/api/templates/[id]/use`                                                                                                                                                                                          |

---

## Known Issues Log

| Route/Page                                  | Issue | Added | Fixed |
| ------------------------------------------- | ----- | ----- | ----- |
| _Add entries here as issues are discovered_ |       |       |       |

---

## Recent Changes

| Date       | Route/Page              | Change                                                         | Issue  |
| ---------- | ----------------------- | -------------------------------------------------------------- | ------ |
| 2026-03-23 | /api/user/account       | COMP-1: Added `supabase.auth.admin.deleteUser()` — GDPR Art.17 | COMP-1 |
| 2026-03-23 | /api/user/export        | COMP-3: Created GDPR Art.20 data export endpoint               | COMP-3 |
| 2026-03-23 | /api/auth/unified-login | SEC-3: Removed `accessToken` from response body                | SEC-3  |
| 2026-03-23 | /api/content/branded    | SEC-1: Added auth + org check                                  | SEC-1  |
| 2026-03-23 | /api/brand/profile      | SEC-2: Added auth + org check                                  | SEC-2  |
| 2026-03-23 | middleware.ts           | SEC-5: JWT HMAC verification via jose                          | SEC-5  |
| 2026-03-23 | /api/ws                 | COMP-5: WebSocket CORS restricted to synthex.social            | COMP-5 |
