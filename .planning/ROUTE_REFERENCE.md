# Synthex Route Reference

> Auto-generated 2026-03-24. Read before implementing. Update the "Known issues" and "Last audited" fields after each task.
>
> **532 API routes · 100 dashboard pages · 110 Prisma models in use**
> Auth: 425 user-authed · 23 admin-only · 27 cron · 57 public

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

- `DELETE,GET,PUT /api/ab-testing/tests/[testId]` — user — _aBTest_
- `GET,POST /api/ab-testing/tests/[testId]/results` — user — _aBTest,aBTestResult,aBTestVariant_
- `GET,POST /api/ab-testing/tests` — user — _aBTest_

### activity

- `GET,POST /api/activity` — user — _auditLog,post_

### admin

- `DELETE,GET,PATCH,POST /api/admin/vault` — admin — _user,vaultSecret_
- `DELETE,GET,POST /api/admin/platform-credentials` — admin — _platformOAuthCredential,user_
- `GET,PATCH,POST /api/admin/users` — admin — _user_
- `GET,PATCH /api/admin/org-brand-profile` — admin — _organization,user_
- `GET,POST /api/admin/invites` — admin — _inviteCode_
- `GET,POST /api/admin/jobs` — admin
- `GET,POST /api/admin/remotion` — admin
- `GET,POST /api/admin/vault/seed-all` — admin — _organization,user,vaultSecret_
- `GET /api/admin/audit-log` — admin — _auditLog_
- `GET /api/admin/bayesian-health` — admin
- `GET /api/admin/platform-stats` — admin — _subscription,user_
- `GET /api/admin/vault/access-log` — admin — _user,vaultAccessLog_
- `POST /api/admin/upgrade-subscription` — admin
- `POST /api/admin/vault/decrypt` — admin — _user,vaultSecret_
- `POST /api/admin/vault/import-doc/confirm` — admin — _businessOwnership,user,vaultSecret_
- `POST /api/admin/vault/import-doc` — admin — _user_

### affiliates

- `DELETE,GET,PUT /api/affiliates/links/[linkId]` — user
- `DELETE,GET,PUT /api/affiliates/networks/[networkId]` — user
- `GET,POST /api/affiliates/links` — user
- `GET,POST /api/affiliates/networks` — user
- `GET /api/affiliates/links/[linkId]/clicks` — user
- `GET /api/affiliates/stats` — user
- `GET /api/affiliates/track/[shortCode]` — public
- `POST /api/affiliates/webhook` — public

### agents

- `POST /api/agents/dispatch-campaign` — user — _campaign_
- `POST /api/agents/enhance-post` — user — _organization,post_

### ai

- `DELETE,GET,PATCH /api/ai/chat/conversations/[conversationId]` — user — _aIConversation,aIMessage_
- `GET,POST /api/ai/chat/conversations` — user — _aIConversation_
- `GET,POST /api/ai/generate-content` — user — _user_
- `GET,POST /api/ai/pm/conversations` — user — _aIConversation_
- `GET /api/ai/pm/digest` — user — _aIWeeklyDigest_
- `GET /api/ai/pm/suggestions` — user
- `POST /api/ai/chat/conversations/[conversationId]/auto-title` — user — _aIConversation,aIMessage_
- `POST /api/ai/chat/conversations/[conversationId]/messages` — user — _aIConversation,aIMessage_
- `POST /api/ai/pm/conversations/[conversationId]/messages` — user — _aIConversation,aIMessage_
- `POST /api/ai/pm/feedback` — user — _aIMessage_

### ai-content

- `GET,POST /api/ai-content/sentiment` — user — _contentComment,sentimentAnalysis_
- `GET,POST /api/ai-content/translate` — user
- `POST /api/ai-content/hashtags` — user
- `POST /api/ai-content/optimize` — user
- `POST /api/ai-content/sentiment/batch` — user

### analytics

- `DELETE,GET,POST /api/analytics/reports/scheduled` — user — _report_
- `GET,POST,PUT /api/analytics/anomalies` — user
- `GET,POST /api/analytics/export` — user — _campaign,post_
- `GET,POST /api/analytics/performance` — user — _post_
- `GET,POST /api/analytics/predict-engagement` — user
- `GET,POST /api/analytics/reports` — user
- `GET /api/analytics/benchmarks` — user — _platformConnection,platformPost_
- `GET /api/analytics/dashboard` — user
- `GET /api/analytics/dashboard-stats` — user — _campaign,post_
- `GET /api/analytics/insights` — user — _analyticsEvent,campaign,post_
- `GET /api/analytics/realtime` — user — _analyticsEvent,campaign,post_
- `GET /api/analytics/sentiment` — user
- `GET /api/analytics` — user — _apiUsage,campaign,post_
- `POST /api/analytics/engagement` — user

### api-keys

- `GET /api/api-keys/status` — user — _aPICredential_

### approvals

- `DELETE,GET,PATCH /api/approvals/[id]` — user — _approvalRequest,teamNotification,user_
- `GET,POST /api/approvals` — user — _approvalRequest,user,workflowTemplate_

### audience

- `GET /api/audience/insights` — user — _platformConnection,platformPost_

### auth

- `DELETE,GET,POST /api/auth/api-keys` — user — _user_
- `DELETE,GET,POST /api/auth/connections` — user — _businessOwnership,platformConnection_
- `DELETE,POST /api/auth/logout` — user — _auditLog,session_
- `DELETE,POST /api/auth/unlink/github` — user
- `DELETE,POST /api/auth/unlink/google` — user
- `GET,POST /api/auth/reset` — public
- `GET,POST /api/auth/unified` — admin — _user_
- `GET,POST /api/auth/unified-login` — public
- `GET,POST /api/auth/verify-email` — public
- `GET,POST /api/auth/verify-token` — public
- `GET,PUT /api/auth/profile` — user — _user_
- `GET,PUT /api/auth/user` — user — _auditLog,user_
- `GET /api/auth/accounts` — user
- `GET /api/auth/callback/[platform]` — admin — _platformConnection,user_
- `GET /api/auth/connections/status` — user — _platformConnection_
- `GET /api/auth/link/github` — user
- `GET /api/auth/link/google` — user
- `GET /api/auth/oauth/[platform]` — user — _user_
- `GET /api/auth/oauth/github/callback` — public — _user_
- `GET /api/auth/oauth/github` — public
- `GET /api/auth/oauth/google/callback` — admin
- `GET /api/auth/oauth/google` — public
- `POST /api/auth/login` — public — _auditLog,session,user_
- `POST /api/auth/refresh` — public — _user_
- `POST /api/auth/request-reset` — public — _user_
- `POST /api/auth/resend-verification` — user — _user_
- `POST /api/auth/signup` — public — _inviteCode,user_
- `POST /api/auth/validate-invite` — public — _inviteCode_

### authority

- `GET /api/authority/citations` — user — _authorityAnalysis,authorityCitation_
- `GET /api/authority/sources` — user
- `POST /api/authority/analyze` — user — _user_
- `POST /api/authority/design-audit` — user
- `POST /api/authority/validate-claim` — user

### authors

- `DELETE,GET,PATCH /api/authors/[id]` — user — _authorProfile_
- `GET,POST /api/authors` — user — _authorProfile_
- `GET /api/authors/[id]/schema` — user — _authorProfile_

### autonomous

- `POST /api/autonomous/execute` — user — _user,workflowExecution_
- `POST /api/autonomous/parse` — user

### autopilot

- `GET,PATCH /api/autopilot/config` — user — _autopilotConfig_
- `GET /api/autopilot/runs/[runId]` — user — _autopilotRun,post_
- `GET /api/autopilot/runs` — user — _autopilotRun_
- `GET /api/autopilot/stats` — user — _autopilotConfig,autopilotRun_
- `POST /api/autopilot/preview` — user — _autopilotConfig_

### auto-research

- `GET,POST /api/auto-research` — user — _autoResearchRun_
- `GET /api/auto-research/[id]` — user — _autoResearchRun_
- `GET /api/auto-research/insights` — user — _trendInsight_

### awards

- `DELETE,PATCH /api/awards/[id]` — user — _awardListing_
- `GET,POST /api/awards` — user — _awardListing_
- `GET /api/awards/templates` — user
- `POST /api/awards/[id]/generate-nomination` — user — _awardListing_

### backlinks

- `GET,POST /api/backlinks/prospects` — user — _backlinkProspect_
- `GET /api/backlinks/analysis` — user — _backlinkAnalysis_
- `POST /api/backlinks/analyze` — user — _backlinkAnalysis,backlinkProspect,user_
- `POST /api/backlinks/outreach` — user — _backlinkProspect_

### backup

- `GET,POST /api/backup` — cron

### bayesian

- `GET,POST /api/bayesian/spaces` — user — _bOSpace,user_
- `GET /api/bayesian/status/[jobId]` — user — _bOOptimisationRun,user_
- `POST /api/bayesian/observe` — user — _bOObservation,bOSpace,user_
- `POST /api/bayesian/run` — user — _bOOptimisationRun,bOSpace,user_
- `POST /api/bayesian/suggest` — user — _bOObservation,bOSpace,user_

### bio

- `DELETE,GET,PATCH,POST /api/bio/[pageId]/links` — user — _linkBioLink,linkBioPage_
- `DELETE,GET,PATCH /api/bio/[pageId]` — user — _linkBioPage_
- `GET,POST /api/bio` — user — _linkBioPage_
- `POST /api/bio/[pageId]/track` — public — _linkBioLink,linkBioPage_

### brand

- `GET,POST /api/brand/generate` — user — _brandGeneration,psychologyPrinciple,userPsychologyPreference_
- `GET,POST /api/brand/identity` — user — _brandIdentity_
- `GET /api/brand/dna` — user — _brandDNA_
- `GET /api/brand/kg-check` — user — _brandIdentity_
- `GET /api/brand/mentions` — user — _brandIdentity,brandMention_
- `GET /api/brand/profile` — user — _brandDNA_
- `GET /api/brand/wikidata` — user — _brandIdentity_
- `POST /api/brand/calendar` — user — _brandIdentity_
- `POST /api/brand/consistency` — user — _brandIdentity_
- `POST /api/brand/mentions/poll` — user — _brandIdentity,brandMention_

### brand-dna

- `GET /api/brand-dna/[organizationId]` — user — _brandDNA_
- `POST /api/brand-dna/extract` — user
- `POST /api/brand-dna/refresh` — user — _brandDNA_

### brand-profile

- `GET,PATCH /api/brand-profile` — user — _organization,user_

### brand-voice

- `GET /api/brand-voice/review-queue` — user — _stepExecution,user_
- `POST /api/brand-voice/review-queue/[stepId]/approve` — user — _stepExecution,user_
- `POST /api/brand-voice/review-queue/[stepId]/reject` — user — _stepExecution,user,workflowExecution_
- `POST /api/brand-voice/score` — user — _persona,user_

### businesses

- `DELETE,PATCH /api/businesses/[id]` — user — _businessOwnership,user_
- `GET,POST /api/businesses` — user — _user_
- `GET /api/businesses/overview` — user
- `PATCH /api/businesses/switch` — user — _businessOwnership_

### campaigns

- `DELETE,GET,POST,PUT /api/campaigns` — user — _campaign_

### citation

- `GET /api/citation/opportunities` — user
- `GET /api/citation/overview` — user
- `GET /api/citation/timeline` — user

### clients

- `DELETE,GET,POST,PUT /api/clients` — user

### command-centre

- `GET /api/command-centre/activity` — user — _autopilotRun_
- `GET /api/command-centre/pending` — user — _post_
- `GET /api/command-centre/performance` — user — _post_
- `GET /api/command-centre/provider-readiness` — user — _environment readiness only_
- `GET /api/command-centre/stats` — user — _autopilotRun,platformConnection,post_
- `GET /api/command-centre/status` — user — _autopilotConfig,autopilotRun,persona,platformConnection,marketingAgencyOutcomeEvent_
- `POST /api/command-centre/autopilot` — user — _autopilotConfig_
- `POST /api/command-centre/intake` — user — _draft-only service packet_

### comments

- `DELETE,GET,PATCH /api/comments/[id]` — user — _contentComment_
- `GET,POST /api/comments` — user — _contentComment_

### competitors

- `DELETE,GET,PATCH /api/competitors/track/[id]` — user
- `GET,PATCH /api/competitors/alerts` — user
- `GET,POST /api/competitors/[competitorId]/analyze` — user
- `GET,POST /api/competitors/track/[id]/snapshot` — user
- `GET,POST /api/competitors/track` — user
- `GET,POST /api/competitors` — user — _brandGeneration,competitiveAnalysis_
- `POST /api/competitors/track/execute` — cron

### contact

- `POST /api/contact` — public

### content

- `DELETE,GET,PATCH,POST /api/content/comments` — user — _auditLog,campaign,post,user_
- `DELETE,GET,PATCH /api/content/[id]` — user — _post_
- `DELETE,GET,POST /api/content/share` — user — _user_
- `GET,PATCH,POST /api/content/calendar` — user — _approvalRequest,user_
- `GET,POST /api/content/variations` — user
- `GET /api/content/calendar/optimal-times` — user
- `GET /api/content/performance` — user — _platformConnection,platformPost_
- `GET /api/content` — user — _post_
- `POST,PUT /api/content/generate` — user — _persona_
- `POST /api/content/branded` — user
- `POST /api/content/bulk` — user — _campaign,post_
- `POST /api/content/cross-post` — user
- `POST /api/content/import-obsidian/confirm` — user
- `POST /api/content/import-obsidian` — user
- `POST /api/content/multi-format` — user
- `POST /api/content/repurpose` — user
- `POST /api/content/score` — user — _promptTemplate,user_

### content-drafts

- `DELETE,PATCH /api/content-drafts/[id]` — user — _contentDraft_
- `GET,POST /api/content-drafts` — user — _contentDraft_

### content-library

- `DELETE,GET,PATCH /api/content-library/[id]` — user — _contentLibrary_
- `GET,POST /api/content-library` — user — _contentLibrary_

### cron

- `GET,POST /api/cron/analyze-patterns` — cron
- `GET,POST /api/cron/insights` — cron — _organization_
- `GET,POST /api/cron/sentinel` — cron
- `GET /api/cron/analytics-sync` — cron — _organization,platformConnection_
- `GET /api/cron/autopilot` — cron — _autopilotConfig,autopilotRun,campaign,post_
- `GET /api/cron/autopilot-learn` — cron — _autopilotConfig_
- `GET /api/cron/daily-post` — cron — _post_
- `GET /api/cron/drip-day14` — cron — _user_
- `GET /api/cron/drip-day3` — cron — _user_
- `GET /api/cron/drip-day7` — cron — _user_
- `GET /api/cron/fetch-mentions` — cron — _platformConnection,socialMention,trackedKeyword_
- `GET /api/cron/forecast-training` — cron — _forecastModel_
- `GET /api/cron/gbp-monitor` — cron — _gBPLocation,gBPReview,gBPSnapshot_
- `GET /api/cron/gsc-auto-index` — cron — _gSCProperty,organization,platformPost_
- `GET /api/cron/gsc-monitor` — cron — _gSCProperty,gSCSnapshot,notification,user_
- `GET /api/cron/health-score` — cron
- `GET /api/cron/proactive-insights` — cron — _analyticsEvent,notification,platformMetrics,subscription,userHealthScore,userStreak_
- `GET /api/cron/publish-scheduled` — cron — _notification,platformConnection,platformPost,post_
- `GET /api/cron/refresh-tokens` — cron — _notification,platformConnection_
- `GET /api/cron/revalidate-api-keys` — cron — _aPICredential_
- `GET /api/cron/seo-audits` — cron — _sEOAudit_
- `GET /api/cron/unite-hub-revenue` — cron — _subscription_
- `GET /api/cron/weekly-digest` — cron — _aIWeeklyDigest,subscription,user_
- `GET /api/cron/welcome-sequence` — cron — _subscription,user_

### dashboard

- `GET,PATCH /api/dashboard/bio` — user
- `GET /api/dashboard/awards` — user
- `GET /api/dashboard/citation` — user
- `GET /api/dashboard/eeat` — user
- `GET /api/dashboard/experiments` — user
- `GET /api/dashboard/geo` — user
- `GET /api/dashboard/onboarding-summary` — user — _onboardingProgress,organization,user_
- `GET /api/dashboard/referrals` — user
- `GET /api/dashboard/roi` — user
- `GET /api/dashboard/sponsors` — user
- `GET /api/dashboard/stats` — user — _campaign,platformConnection,platformMetrics,post_
- `GET /api/dashboard/visuals` — user
- `GET /api/dashboard/voice` — user

### demo

- `POST /api/demo/analyze` — public
- `POST /api/demo/caption` — public
- `POST /api/demo/image` — public

### directories

- `DELETE,PATCH /api/directories/[id]` — user — _directoryListing_
- `GET,POST /api/directories` — user — _directoryListing_
- `GET /api/directories/templates` — user

### eeat

- `GET,POST /api/eeat/v2/audit` — user — _eEATAudit_
- `POST /api/eeat/v2/assets` — user

### email

- `GET,POST /api/email/send` — user

### experiments

- `GET,POST /api/experiments/experiments` — user — _sEOExperiment,user_
- `GET /api/experiments/dogfood` — user
- `GET /api/experiments/healing` — user — _healingAction_
- `POST /api/experiments/experiments/[id]/complete` — user — _sEOExperiment,user_
- `POST /api/experiments/experiments/[id]/record` — user — _experimentObservation,sEOExperiment_
- `POST /api/experiments/experiments/[id]/start` — user — _sEOExperiment_
- `POST /api/experiments/healing/analyze` — user — _user_
- `POST /api/experiments/suggest` — user — _user_

### features

- `GET /api/features` — user — _subscription_

### forecast

- `GET,POST /api/forecast/models` — user — _forecastModel,user_
- `GET /api/forecast/[modelId]` — user — _forecastModel,user_
- `POST /api/forecast/predict` — user — _forecast,forecastModel,user_

### founder

- `POST /api/founder/delete-account` — user

### gamification

- `GET,POST /api/gamification/streak` — user — _userStreak_
- `GET /api/gamification/achievements` — user — _userAchievement_

### generate

- `POST /api/generate/diagram` — user
- `POST /api/generate/plot` — user

### geo

- `POST /api/geo/analyze` — user — _entityAnalysis,gEOAnalysis,user_
- `POST /api/geo/passages` — user
- `POST /api/geo/rewrite` — user
- `POST /api/geo/score` — user
- `POST /api/geo/tactic-score` — user

### google-business

- `DELETE,POST /api/google-business/reviews/[reviewId]/reply` — user — _gBPReview_
- `GET,PATCH /api/google-business/locations/[locationId]` — user — _gBPLocation_
- `GET,POST /api/google-business/locations` — user — _gBPLocation_
- `GET,POST /api/google-business/posts` — user — _gBPLocation_
- `GET /api/google-business/insights` — user — _gBPLocation,gBPSnapshot_
- `GET /api/google-business/nap-audit` — user — _brandDNA,gBPLocation,organization_
- `GET /api/google-business/photos` — user — _gBPLocation_
- `GET /api/google-business/reviews` — user — _gBPReview_
- `POST /api/google-business/reviews/[reviewId]/auto-reply` — user — _gBPReview,organization_

### health

- `DELETE,GET,POST /api/health/redis` — public
- `GET,POST /api/health/scaling` — public
- `GET /api/health/ai` — public
- `GET /api/health/auth` — public
- `GET /api/health/composite` — user — _user_
- `GET /api/health/db` — public
- `GET /api/health/email` — public
- `GET /api/health/live` — public
- `GET /api/health/ready` — public
- `GET /api/health/stripe` — public
- `GET /api/health` — public

### indexing

- `POST /api/indexing` — user

### insights

- `GET /api/insights` — user — _user,workflowExecution_

### integrations

- `DELETE,GET,POST /api/integrations/[integrationId]/connect` — public
- `DELETE,GET,POST /api/integrations/third-party/[provider]` — user — _platformConnection_
- `DELETE,GET,POST /api/integrations` — user — _platformConnection_
- `GET,POST /api/integrations/[integrationId]/sync` — user — _platformConnection,platformMetrics,platformPost_
- `GET,PUT /api/integrations/third-party/[provider]/config` — user — _platformConnection_
- `GET /api/integrations/[integrationId]/status` — user — _platformConnection_
- `GET /api/integrations/third-party` — user — _platformConnection_

### intelligence

- `DELETE,GET,POST /api/intelligence/competitors` — user

### internal

- `POST /api/internal/bo-callback` — public — _bOOptimisationRun,bOSpace_

### invoices

- `DELETE,GET,PATCH /api/invoices/[id]` — user — _invoice_
- `GET,POST /api/invoices` — user — _invoice,subscription_
- `GET /api/invoices/list` — user — _invoice_

### library

- `DELETE,GET,PATCH /api/library/content/[contentId]` — user — _contentLibrary_
- `GET,POST /api/library/content` — user — _contentLibrary_

### listening

- `DELETE,GET,POST /api/listening/keywords` — user — _socialMention,trackedKeyword_
- `GET,PATCH /api/listening/mentions` — user — _socialMention_
- `GET /api/listening` — user — _socialMention,trackedKeyword_

### local

- `GET,POST /api/local/case-studies` — user — _localCaseStudy_

### loyalty

- `GET /api/loyalty` — user — _userLoyaltyTier_

### marketplace

- `GET,POST /api/marketplace/products` — user — _marketplaceProduct_

### marketing-agency

- `GET /api/marketing-agency/opportunities` — user — _marketingAgencyOpportunity,marketingAgencySignal_
- `POST /api/marketing-agency/campaigns` — user — _draft campaign package only_

### media

- `DELETE,GET,POST,PUT /api/media/generate/voice` — user
- `DELETE,GET,POST,PUT /api/media/library` — user
- `GET,POST,PUT /api/media/generate/image` — user
- `GET,POST,PUT /api/media/generate/video` — admin — _user_
- `POST /api/media/upload` — user

### mobile

- `GET /api/mobile/config` — user
- `POST /api/mobile/sync` — user

### moderation

- `GET,POST,PUT /api/moderation/check` — user

### monitoring

- `GET,POST /api/monitoring/alerts` — user
- `GET,POST /api/monitoring/errors` — user
- `GET,POST /api/monitoring/events` — admin — _auditLog,user_
- `GET,POST /api/monitoring/performance` — public
- `GET /api/monitoring/business-metrics` — user
- `GET /api/monitoring/health-dashboard` — public
- `GET /api/monitoring/metrics` — public

### newsletter

- `GET,POST /api/newsletter/unsubscribe` — public
- `POST /api/newsletter/subscribe` — public

### notifications

- `GET,PATCH,POST /api/notifications` — user — _notification_
- `GET,PUT /api/notifications/settings` — user — _user_
- `PATCH /api/notifications/[notificationId]/read` — user — _notification_

### onboarding

- `GET,POST /api/onboarding/api-credentials` — user — _aPICredential_
- `GET,POST /api/onboarding/kickstart` — user — _onboardingProgress,platformConnection,post,user_
- `GET,POST /api/onboarding/progress` — user — _onboardingProgress,organization_
- `GET /api/onboarding/checklist` — user — _aPICredential,brandDNA,platformConnection,post_
- `POST /api/onboarding/complete` — user — _onboardingProgress,organization,user_
- `POST /api/onboarding/pipeline` — user — _onboardingProgress,organization_
- `POST /api/onboarding/review` — user — _onboardingProgress,organization_
- `POST /api/onboarding/validate-key` — user — _user_

### optimize

- `GET,POST,PUT /api/optimize/auto-schedule` — user — _user_

### organizations

- `DELETE,GET,PATCH /api/organizations/[orgId]` — user — _organization,user_
- `GET,POST /api/organizations` — user — _organization_

### patterns

- `GET,POST /api/patterns/analyze` — public
- `GET /api/patterns/cached` — public

### performance

- `GET,POST /api/performance/metrics` — public

### personas

- `DELETE,GET,PATCH,POST /api/personas` — user — _persona_
- `GET,POST /api/personas/[id]/optimize` — user — _campaign,persona,post_
- `GET,POST /api/personas/[id]/train` — user — _persona_

### ping

- `GET /api/ping` — public

### platforms

- `GET /api/platforms/[platform]/metrics` — user — _platformConnection,post_
- `GET /api/platforms/metrics` — user — _platformConnection,post_

### pr

- `DELETE,GET,PATCH /api/pr/journalists/[id]` — user — _journalistContact_
- `DELETE,GET,PATCH /api/pr/press-releases/[id]` — user — _pressRelease_
- `GET,PATCH /api/pr/pitches/[id]` — user — _pRPitch_
- `GET,PATCH /api/pr/press-releases/[id]/distributions` — user — _pRDistribution,pressRelease_
- `GET,POST /api/pr/coverage` — user — _mediaCoverage_
- `GET,POST /api/pr/journalists` — user — _journalistContact_
- `GET,POST /api/pr/pitches` — user — _journalistContact,pRPitch_
- `GET,POST /api/pr/press-releases` — user — _pressRelease_
- `GET /api/pr/channels` — public
- `GET /api/pr/press-releases/newsroom/[orgSlug]/[slug]` — public — _organization,pressRelease_
- `POST /api/pr/coverage/poll` — user — _mediaCoverage,pRPitch_
- `POST /api/pr/journalists/[id]/enrich` — user — _journalistContact_
- `POST /api/pr/press-releases/[id]/distribute` — user — _pRDistribution,pressRelease_
- `POST /api/pr/press-releases/generate` — user

### predict

- `GET,POST /api/predict/trends` — user
- `GET /api/predict/models` — user — _spatiotemporalModel,user_
- `POST /api/predict/predict` — user — _platformConnection,spatiotemporalModel,user_
- `POST /api/predict/train` — user — _platformConnection,platformMetrics,platformPost,spatiotemporalModel,user_

### prompts

- `GET,POST /api/prompts/trackers` — user — _promptTracker_
- `GET /api/prompts/gaps` — user — _promptTracker_
- `POST /api/prompts/generate` — user
- `POST /api/prompts/test` — user — _promptResult,promptTracker,user_

### psychology

- `GET,POST /api/psychology/analyze` — public — _user_
- `GET,POST /api/psychology/principles` — user — _userPsychologyPreference_

### public

- `GET,POST /api/public/testimonials/[token]` — public — _testimonial,testimonialRequest_
- `GET /api/public/reviews/[orgSlug]` — public — _gBPReview,organization_

### quality

- `GET,POST /api/quality/audit` — user — _contentQualityAudit_
- `POST /api/quality/gate` — user

### quotes

- `DELETE,GET,PATCH,PUT /api/quotes/[id]` — user — _quote_
- `DELETE,GET,POST /api/quotes` — user — _quote_

### rate-limit

- `GET,PATCH,POST /api/rate-limit` — user

### recommendations

- `GET,POST,PUT /api/recommendations` — user

### referrals

- `GET,POST /api/referrals` — user — _referral,user_
- `POST /api/referrals/redeem` — user — _referral_

### reporting

- `DELETE,GET /api/reporting/reports/[reportId]` — user
- `GET,POST /api/reporting/generate` — user
- `GET /api/reporting/reports/[reportId]/download` — user
- `GET /api/reporting/reports` — user

### reports

- `DELETE,GET,PATCH,POST /api/reports/scheduled` — user — _auditLog,user_
- `DELETE,GET,PATCH,POST /api/reports/templates` — user — _auditLog,user_
- `GET,POST /api/reports/scheduled/execute` — cron — _analyticsEvent,report_

### research

- `DELETE,GET,PATCH /api/research/[id]` — user — _gEOResearchReport_
- `GET,POST /api/research` — user — _gEOResearchReport_
- `GET /api/research/capabilities` — user
- `GET /api/research/trends` — user
- `POST /api/research/implementation-plan` — user

### revenue

- `DELETE,GET,PUT /api/revenue/[id]` — user
- `GET,POST /api/revenue` — user

### roi

- `DELETE,GET,PUT /api/roi/investments/[id]` — user
- `GET,POST /api/roi/investments` — user
- `GET /api/roi` — user — _user_

### roles

- `DELETE,GET,PATCH /api/roles/[id]` — user — _role,user,userRole_
- `DELETE,GET,POST /api/roles/[id]/users` — user — _role,user_
- `GET,POST /api/roles` — user — _user,userRole_

### scheduler

- `DELETE,GET,PATCH,POST /api/scheduler/posts` — user — _campaign,post_
- `DELETE,GET,PATCH /api/scheduler/posts/[postId]` — user — _post_
- `GET /api/scheduler/stats` — user — _campaign,post_
- `POST /api/scheduler/posts/bulk` — user — _post_

### search

- `POST /api/search` — user — _campaign,post_

### sentinel

- `GET /api/sentinel/alerts` — user — _sentinelAlert_
- `GET /api/sentinel/status` — user — _sentinelAlert,user_
- `GET /api/sentinel/updates` — user
- `POST /api/sentinel/alerts/[id]/acknowledge` — user — _sentinelAlert_
- `POST /api/sentinel/check` — user — _user_

### seo

- `DELETE,GET,PATCH /api/seo/scheduled-audits/[id]` — user — _scheduledAuditTarget,sEOAudit_
- `GET,POST /api/seo/audit` — user — _sEOAudit,user_
- `GET,POST /api/seo/scheduled-audits` — user — _scheduledAuditTarget,sEOAudit_
- `GET,POST /api/seo/schema` — user
- `GET,POST /api/seo/search-console/properties` — user — _gSCProperty_
- `GET,POST /api/seo` — user — _sEOAudit_
- `GET /api/seo/dashboard-stats` — user — _gEOAnalysis,sEOAudit_
- `GET /api/seo/geo-readiness/history` — user
- `GET /api/seo/geo-readiness/trends` — user
- `GET /api/seo/pagespeed/history` — user
- `GET /api/seo/pagespeed/trends` — user
- `GET /api/seo/schema-markup/templates` — user
- `GET /api/seo/search-console/coverage` — user — _gSCSnapshot_
- `GET /api/seo/search-console/sitemaps` — user
- `GET /api/seo/technical/cwv-history` — user
- `POST /api/seo/competitor` — user
- `POST /api/seo/enhancements/execute` — user — _user_
- `POST /api/seo/enhancements` — user — _user_
- `POST /api/seo/geo-readiness/analyze` — user — _gEOAnalysis_
- `POST /api/seo/page-analysis` — user
- `POST /api/seo/pagespeed/analyze` — user
- `POST /api/seo/schema-markup/extract` — user
- `POST /api/seo/schema-markup/validate` — user
- `POST /api/seo/search-console/analytics` — user
- `POST /api/seo/search-console/indexing` — user
- `POST /api/seo/search-console/indexing-status` — user
- `POST /api/seo/search-console/sitemaps/submit` — user
- `POST /api/seo/sitemap` — user
- `POST /api/seo/technical/mobile-parity` — user
- `POST /api/seo/technical/robots-txt` — user

### settings

- `DELETE,GET,POST /api/settings/api-credentials` — user — _aPICredential_

### shares

- `DELETE,GET,PATCH /api/shares/[id]` — user — _contentShare_
- `GET,POST /api/shares` — user — _contentShare_

### social

- `GET,POST /api/social/facebook/post` — user
- `GET,POST /api/social/instagram/post` — user
- `GET,POST /api/social/linkedin/post` — user
- `GET,POST /api/social/pinterest/post` — user
- `GET,POST /api/social/post` — user — _platformConnection,post_
- `GET,POST /api/social/reddit/post` — user
- `GET,POST /api/social/threads/post` — user
- `GET,POST /api/social/tiktok/post` — user
- `GET,POST /api/social/twitter/post` — user
- `GET,POST /api/social/youtube/post` — user

### sponsors

- `DELETE,GET,PUT /api/sponsors/[id]/deals/[dealId]` — user
- `DELETE,GET,PUT /api/sponsors/[id]` — user
- `DELETE,PUT /api/sponsors/[id]/deals/[dealId]/deliverables/[deliverableId]` — user
- `GET,POST /api/sponsors/[id]/deals/[dealId]/deliverables` — user
- `GET,POST /api/sponsors/[id]/deals` — user
- `GET,POST /api/sponsors` — user
- `GET /api/sponsors/pipeline` — user

### stats

- `GET /api/stats` — user — _campaign,platformMetrics,post,user_

### stripe

- `GET,POST /api/stripe/change-plan` — user — _subscription_
- `POST /api/stripe/billing-portal` — user — _user_
- `POST /api/stripe/checkout` — user

### submissions

- `GET /api/submissions` — user — _awardListing,directoryListing_

### system

- `GET,POST /api/system/models` — admin

### tasks

- `DELETE,GET,PATCH,POST /api/tasks` — user — _task_
- `DELETE,PATCH /api/tasks/bulk` — user — _task_

### team

- `GET,POST /api/team` — user — _post,teamInvitation,user_

### teams

- `DELETE,GET,PATCH,POST /api/teams/notifications` — user — _user_
- `DELETE,GET,PATCH /api/teams/[id]/settings` — user — _organization,user_
- `DELETE,GET,PATCH /api/teams/invitations/[id]` — user — _user_
- `DELETE,GET,PATCH /api/teams/members/[memberId]` — user — _user_
- `GET,PATCH /api/teams/members/[memberId]/role` — user — _user_
- `GET,POST /api/teams/invitations` — user — _user_
- `GET,POST /api/teams/members` — user — _teamInvitation,user,userRole_
- `GET /api/teams/activity` — user — _auditLog,user_
- `GET /api/teams/members/search` — user — _user_
- `GET /api/teams/stats` — user — _campaign,post,teamInvitation,user_
- `POST /api/teams/invite` — user

### templates

- `DELETE,GET,PUT /api/templates/[id]` — user — _promptTemplate,user_
- `GET,POST /api/templates` — user — _promptTemplate,user_
- `POST /api/templates/[id]/use` — user — _promptTemplate,user_

### testimonials

- `GET,POST /api/testimonials/requests` — user — _testimonialRequest_
- `GET /api/testimonials` — user — _testimonial_
- `PATCH /api/testimonials/[id]` — user — _testimonial_
- `POST /api/testimonials/[id]/post-to-gmb` — user — _gBPLocation,testimonial_

### trending

- `GET /api/trending` — public — _post_

### unified

- `GET /api/unified/metrics` — user — _platformConnection,post_

### unite-hub

- `GET,POST /api/unite-hub/status` — admin — _user_
- `GET /api/unite-hub` — public — _platformPost,subscription_

### user

- `DELETE,GET,PATCH,PUT /api/user/profile` — user — _user_
- `DELETE,GET,POST /api/user/api-keys` — user — _user_
- `DELETE,GET /api/user/account` — public
- `DELETE,POST /api/user/avatar` — user — _user_
- `GET,PUT /api/user/settings` — user — _user_
- `GET /api/user/health-score` — user — _userHealthScore_
- `GET /api/user/loyalty` — user — _userAchievement,userStreak_
- `GET /api/user/subscription` — user
- `GET /api/user/usage` — user — _persona,platformConnection,subscription_
- `POST /api/user/change-password` — public
- `POST /api/user/export` — user — _campaign,platformConnection,post,subscription,user_

### video

- `GET,POST /api/video` — user
- `GET /api/video/[id]` — user — _videoGeneration_
- `POST /api/video/[id]/publish` — user — _campaign,post,videoGeneration_
- `POST /api/video/generate` — user — _videoGeneration_

### visuals

- `GET /api/visuals` — user
- `POST /api/visuals/generate` — user

### voice

- `POST /api/voice/analyze` — user — _voiceProfile_
- `POST /api/voice/capsule` — user — _contentCapsule_
- `POST /api/voice/context` — user — _voiceProfile_
- `POST /api/voice/slop-scan` — user

### webhooks

- `DELETE,GET,PATCH,POST /api/webhooks/user` — user — _auditLog,webhookEndpoint_
- `GET,POST /api/webhooks/[platform]` — public
- `GET,POST /api/webhooks/social` — public — _auditLog,platformConnection,post_
- `GET,POST /api/webhooks/stats` — public
- `GET,POST /api/webhooks/zapier` — public
- `POST,PUT /api/webhooks/internal` — public
- `POST /api/webhooks/email/sendgrid` — public — _notification,user_
- `POST /api/webhooks/linear` — public
- `POST /api/webhooks/stripe` — public

### web-projects

- `DELETE,GET,PATCH /api/web-projects/[id]` — user — _project_
- `GET,POST /api/web-projects` — user — _project_

### white-label

- `GET,PUT /api/white-label/config` — user — _organization,user_

### workflows

- `GET,POST /api/workflows/batch` — user — _user,workflowExecution,workflowTemplate_
- `GET,POST /api/workflows/executions` — user — _user,workflowExecution_
- `GET,POST /api/workflows/intelligence` — user — _stepExecution,user,workflowExecution,workflowTemplate_
- `GET,POST /api/workflows/templates` — user — _user,workflowTemplate_
- `GET /api/workflows/batch/[batchId]` — user — _user_
- `GET /api/workflows/executions/[id]` — user — _user,workflowExecution_
- `POST /api/workflows/executions/[id]/approve` — user — _stepExecution,user,workflowExecution_
- `POST /api/workflows/executions/[id]/cancel` — user — _user,workflowExecution_

---

<!-- HAND-MAINTAINED: Do not regenerate below this line -->

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

## Intentional Server-Side / Infrastructure Routes

> **Audit note:** The routes in this section have **no frontend caller by design**. Do not flag them as orphaned routes. Each category explains who calls them and why there is no UI equivalent.

---

### 1. Cron Endpoints — `POST /api/cron/*`

**Caller:** Vercel Cron scheduler (via `vercel.json`), not any frontend component.
**Auth:** `Authorization: Bearer ${CRON_SECRET}` header — all 32 routes enforce this.
**Why no UI caller:** These are background jobs triggered on a schedule. Users never invoke them directly.

| Route                                | Schedule / Purpose                                    |
| ------------------------------------ | ----------------------------------------------------- |
| `POST /api/cron/ab-rollout`          | Promote winning A/B variants automatically            |
| `POST /api/cron/analytics-sync`      | Sync platform metrics into PlatformMetrics table      |
| `POST /api/cron/analyze-patterns`    | AI pattern analysis on recent posts                   |
| `POST /api/cron/autopilot`           | Execute autopilot campaign actions                    |
| `POST /api/cron/autopilot-learn`     | Feed autopilot outcome data back into ML model        |
| `POST /api/cron/daily-post`          | Generate and queue daily content                      |
| `POST /api/cron/drip-day3`           | Send Day 3 onboarding drip email                      |
| `POST /api/cron/drip-day7`           | Send Day 7 onboarding drip email                      |
| `POST /api/cron/drip-day14`          | Send Day 14 onboarding drip email                     |
| `POST /api/cron/fetch-mentions`      | Pull social mentions from connected platforms         |
| `POST /api/cron/forecast-training`   | Retrain engagement forecasting model                  |
| `POST /api/cron/gbp-monitor`         | Poll Google Business Profile for new reviews          |
| `POST /api/cron/generate-calendars`  | Auto-generate weekly content calendars                |
| `POST /api/cron/gsc-auto-index`      | Submit new URLs to Google Search Console              |
| `POST /api/cron/gsc-monitor`         | Check GSC index status and crawl errors               |
| `POST /api/cron/gsc-topic-sync`      | Sync GSC query data into TopicCluster table           |
| `POST /api/cron/health-check`        | Internal health probe — writes to monitoring          |
| `POST /api/cron/health-score`        | Recalculate UserHealthScore for all active users      |
| `POST /api/cron/insights`            | Generate proactive AI insights                        |
| `POST /api/cron/model-scout`         | Scan for new AI model releases and update registry    |
| `POST /api/cron/proactive-insights`  | Push notifications for detected anomalies             |
| `POST /api/cron/publish-scheduled`   | Publish posts that have passed their scheduledAt time |
| `POST /api/cron/rank-snapshot`       | Capture daily keyword rank snapshot                   |
| `POST /api/cron/refresh-tokens`      | Refresh expiring OAuth platform tokens                |
| `POST /api/cron/revalidate-api-keys` | Validate stored BYOK API keys are still active        |
| `POST /api/cron/review-follow-up`    | Send review request follow-up emails                  |
| `POST /api/cron/sentinel`            | Run algorithm sentinel — detect ranking changes       |
| `POST /api/cron/seo-audits`          | Run scheduled SEO site audits                         |
| `POST /api/cron/unite-hub-revenue`   | Sync revenue data to Unite-Hub                        |
| `POST /api/cron/visibility-push`     | Send Monday Visibility Push weekly email              |
| `POST /api/cron/weekly-digest`       | Generate and email weekly performance digest          |
| `POST /api/cron/welcome-sequence`    | Trigger Day 0 welcome email for new signups           |

---

### 2. Webhook Receivers — `POST /api/webhooks/*`

**Caller:** External third-party services (Stripe, Zapier, Linear, etc.), not frontend components.
**Auth:** Signature verification per provider (Stripe: `stripe-signature` header, Zapier: `ZAPIER_WEBHOOK_SECRET`, etc.).
**Why no UI caller:** Inbound events pushed by external systems in response to actions outside Synthex.

| Route                           | Provider / Purpose                               |
| ------------------------------- | ------------------------------------------------ |
| `POST /api/webhooks/stripe`     | Stripe payment events — subscription lifecycle   |
| `POST /api/webhooks/zapier`     | Zapier trigger receiver for workflow automations |
| `POST /api/webhooks/linear`     | Linear issue events for Unite-Hub sync           |
| `POST /api/webhooks/social`     | Social platform activity callbacks               |
| `POST /api/webhooks/email`      | Email delivery status (SendGrid/Resend events)   |
| `POST /api/webhooks/stats`      | Anonymous usage statistics ingestion             |
| `POST /api/webhooks/user`       | User lifecycle events from external auth         |
| `POST /api/webhooks/internal`   | Internal cross-service event bus                 |
| `POST /api/webhooks/[platform]` | Dynamic platform-specific webhook handler        |

---

### 3. Health Check Probes — `GET /api/health/*`

**Caller:** Uptime monitors (BetterStack, Vercel), load balancers, and CI pipelines.
**Auth:** Public (no auth required — monitoring agents cannot authenticate).
**Why no UI caller:** Infrastructure readiness probes. A 200 means the service layer is up; non-200 triggers an alert.

| Route                          | Checks                                                          |
| ------------------------------ | --------------------------------------------------------------- |
| `GET /api/health`              | Top-level health — returns overall status                       |
| `GET /api/health/db`           | Prisma + PostgreSQL connectivity                                |
| `GET /api/health/redis`        | Upstash Redis connectivity                                      |
| `GET /api/health/redis-simple` | Redis ping (lightweight, no query)                              |
| `GET /api/health/stripe`       | Stripe API reachability                                         |
| `GET /api/health/email`        | Resend API reachability                                         |
| `GET /api/health/auth`         | Supabase Auth reachability                                      |
| `GET /api/health/ai`           | OpenRouter / AI provider reachability                           |
| `GET /api/health/live`         | Kubernetes-style liveness probe (always 200 if process running) |
| `GET /api/health/ready`        | Readiness probe — 200 only when all deps healthy                |
| `GET /api/health/composite`    | Full composite check with per-service breakdown                 |
| `GET /api/health/scaling`      | Auto-scaling metrics endpoint for Vercel                        |

---

### 4. Admin-Only Routes — `GET|POST /api/admin/*`

**Caller:** The `/dashboard/admin` super-admin panel, accessible only to `isOwnerEmail()` users.
**Auth:** `verifyAdmin()` from `lib/admin/verify-admin.ts` — checks API key header, then JWT Bearer, then cookie. Rejects all non-owner requests.
**Why no regular UI caller:** These routes expose raw operational data (all users, all orgs, platform credentials, audit logs) that must never be accessible to ordinary authenticated users.

| Route                                  | Purpose                                     |
| -------------------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------------ | -------------------------------------------- |
| `GET /api/admin/audit-log`             | Full audit log across all organisations     |
| `GET /api/admin/bayesian-health`       | Bayesian optimisation system diagnostics    |
| `GET                                   | POST /api/admin/blog`                       | Admin blog post management (generate, publish) |
| `GET                                   | POST /api/admin/invites`                    | Manage platform beta invites                   |
| `GET /api/admin/jobs`                  | Background job queue status                 |
| `GET /api/admin/model-metrics`         | AI model usage and cost metrics             |
| `GET                                   | PUT /api/admin/org-brand-profile`           | Override org brand profiles                    |
| `GET                                   | PUT /api/admin/platform-credentials`        | Manage shared platform API credentials         |
| `GET /api/admin/platform-stats`        | Cross-org platform performance aggregates   |
| `POST /api/admin/remotion`             | Trigger Remotion video render jobs          |
| `POST /api/admin/upgrade-subscription` | Manually upgrade a user's subscription tier |
| `GET                                   | POST                                        | PATCH                                          | DELETE /api/admin/users` | Full user management (read, suspend, delete) |
| `GET                                   | POST /api/admin/vault`                      | Manage encrypted credential vault              |

---

### 5. Social Platform Direct-Post Routes — `POST /api/social/*/post`

**Caller:** `POST /api/content/cross-post` only — this is the single orchestration endpoint that fans out to per-platform post routes.
**Why no direct UI caller:** The dashboard posts via `/api/content/cross-post` which handles multi-platform batching, retry logic, and status tracking. Per-platform routes are internal implementation details, not public API surface.

| Route                             | Platform                      |
| --------------------------------- | ----------------------------- |
| `POST /api/social/facebook/post`  | Facebook Graph API            |
| `POST /api/social/instagram/post` | Instagram Graph API           |
| `POST /api/social/linkedin/post`  | LinkedIn API                  |
| `POST /api/social/pinterest/post` | Pinterest API                 |
| `POST /api/social/reddit/post`    | Reddit API                    |
| `POST /api/social/threads/post`   | Threads API                   |
| `POST /api/social/tiktok/post`    | TikTok API                    |
| `POST /api/social/twitter/post`   | Twitter/X API                 |
| `POST /api/social/youtube/post`   | YouTube Data API              |
| `POST /api/social/post`           | Generic fallback post handler |

---

### 6. Report Generation — `POST /api/reporting/*`

**Caller:** `hooks/use-report-export.ts` — the hook POSTs to `/api/reporting/generate`, polls `/api/reporting/reports/[reportId]` every 2 seconds, then triggers a client-side download when the report status reaches `completed`.
**Why no direct page caller:** The hook abstracts the generate-then-poll pattern. The analytics page never calls these routes directly; it calls the hook.

| Route                                   | Purpose                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `POST /api/reporting/generate`          | Start async report generation, returns `reportId`              |
| `GET /api/reporting/reports/[reportId]` | Poll for report status; returns `downloadUrl` when `completed` |

---

### 7. ML Training Routes — `POST /api/predict/train`

**Caller:** `POST /api/cron/forecast-training` — the training cron calls this endpoint on a weekly schedule.
**Why no UI caller:** Model retraining is a background operation. Users trigger predictions (via `GET /api/analytics/predict-engagement`), not model training.

| Route                     | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `POST /api/predict/train` | Retrain engagement prediction model on recent data |

---

### 8. Reports Scheduled Execution — `POST /api/reports/scheduled/execute`

**Caller:** Vercel Cron — executes pending scheduled report jobs and delivers them to recipients.
**Why no UI caller:** Execution is automatic. Users configure schedules via `POST /api/reports/scheduled`; delivery happens server-side.

| Route | Purpose                              |
| ----- | ------------------------------------ | ------------------------------------------------------- |
| `GET  | POST /api/reports/scheduled/execute` | Run due scheduled reports and deliver via email/webhook |

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
| 2026-03-23 | /api/contact            | Created — public POST, Resend SDK, rate-limited (writeDefault) | —      |
| 2026-05-22 | Prisma schema           | SYN-968: Added governed signal/opportunity/outcome persistence | SYN-968 |
| 2026-05-22 | Marketing Agency API    | SYN-968: Exposed org-scoped governed opportunities for dashboard review | SYN-968 |
| 2026-05-22 | Command Centre status   | SYN-968: Added Marketing Agency outcome-learning signal to Health Loop | SYN-968 |
| 2026-05-22 | Command Centre dashboard | SYN-968: Added passive Board/Margot/@team routing queue for draft command packets | SYN-968 |

### 2026-03-30 — SYN-532: Review Intelligence → Authority Score + Weekly Digest + GEO schema

- `lib/scoring/computeAuthorityScore.ts`: v1.1 rubric — adds `reviewResponseRate` (15pts) + `averageReviewScore` (15pts), reduces GBP/velocity/freshness/backlinks
- `app/api/dashboard/authority-score/route.ts`: adds 90-day `groupBy` query for `reviewResponseRate` signal
- `app/clients/[slug]/page.tsx`: v1.1 pillar bars, FAQPage + SpeakableSpecification JSON-LD, graceful v1.0 fallback
- `lib/ai/project-manager/system-prompts.ts`: Reputation section added to WEEKLY_DIGEST_PROMPT
- `lib/ai/project-manager/context-builder.ts`: reputation stats query (total reviews, avg rating, response rate 90d, unreplied count)

### 2026-03-30 — SYN-531: AI Review Response Engine

- Prisma schema: `GBPReview` + `responseStatus` (pending/posted/dismissed), `dismissReason` — migration applied
- `app/api/google-business/reviews/[reviewId]/auto-reply/route.ts`: BrandDNA voice integration + real AI call via `getAIProvider()`
- `app/api/google-business/reviews/[reviewId]/reply/route.ts`: sets `responseStatus = 'posted'` on successful post
- `app/api/google-business/reviews/[reviewId]/dismiss/route.ts`: NEW — POST `{ reason }` → sets `responseStatus = 'dismissed'` + `dismissReason`
- `app/api/cron/gbp-monitor/route.ts`: auto-generates AI suggestions for up to 10 new unreplied reviews per cron run
- `app/dashboard/google-business/reviews/page.tsx`: one-tap Approve, Edit+Approve, Dismiss with reason picker, response status badges

### 2026-03-30 — SYN-530: Review Intelligence Engine

- `vercel.json`: gbp-monitor cron schedule `"0 5 * * *"` → `"*/5 * * * *"` (every 5 min)
- `app/dashboard/google-business/page.tsx`: "Recent Reviews" card → "Review Intelligence" panel with response status badges, unreplied count, 100-char snippets, date, and 5-item list

### 2026-03-30 — UNI-1655: Intentional server-side route documentation

- Added `## Intentional Server-Side / Infrastructure Routes` section with 8 categories
- Covers 32 cron routes, 9 webhook receivers, 12 health probes, 13 admin routes, 10 social direct-post routes, 2 reporting routes, 1 ML training route, 1 scheduled report execution route
- Future audits should suppress these from "orphaned route" findings

### 2026-03-23 — UNI-1633: Obsidian content import

- POST /api/content/import-obsidian — user-auth, writeDefault rate-limit — previews Obsidian note parse (no DB write)
- POST /api/content/import-obsidian/confirm — user-auth, writeDefault rate-limit — creates ContentDraft from parsed note
