# Sentry + Vercel Analytics Setup — SYN-489

## Architecture

Sentry is configured in **tunnel mode** to avoid two known issues:
1. Ad-blockers blocking requests to `sentry.io`
2. The `@sentry/nextjs` webpack plugin causing Lambda cold-start hangs (Phase 114-02)

### How it works

```
Client error → sentry.client.config.ts → /api/monitoring/sentry-tunnel → sentry.io
Server error → instrumentation.ts → Sentry.init() (direct, lazy loaded)
```

The webpack plugin (`withSentryConfig`) remains **disabled** in `next.config.mjs`.

## Environment Variables Required

```env
# Public (client-side)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o4509143228317696.ingest.us.sentry.io/<project-id>

# Private (server-side / CI)
SENTRY_ORG=synthex
SENTRY_PROJECT=synthex-nextjs
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_PROJECT_ID=4509143230742528
```

## Alert Rules to Configure in Sentry Dashboard

1. **5xx Error Spike** — Alert when 5xx error count > 5 in 5 minutes → Slack #synthex-alerts
2. **Response Time Degradation** — Alert when p95 response time > 3s for 10 minutes → Slack #synthex-alerts  
3. **New Error Type** — Alert on first occurrence of any new error type → Email team
4. **Error Rate Threshold** — Alert when error rate > 1% of transactions → Slack #synthex-alerts

## Vercel Analytics

Vercel Analytics and Speed Insights are added via `<AnalyticsProvider />` in the root layout.
- Analytics: page views, unique visitors, top pages, referrers
- Speed Insights: Core Web Vitals (LCP, FID, CLS, TTFB)

No additional configuration needed — Vercel auto-detects the project.

## Verification Checklist

- [ ] `NEXT_PUBLIC_SENTRY_DSN` set in Vercel environment variables
- [ ] `SENTRY_PROJECT_ID` set in Vercel environment variables  
- [ ] Deploy and trigger a test error: `throw new Error('Sentry test')`
- [ ] Verify error appears in Sentry dashboard
- [ ] Verify tunnel route responds: `POST /api/monitoring/sentry-tunnel`
- [ ] Verify Vercel Analytics receiving data in Vercel dashboard
- [ ] Configure alert rules in Sentry (see above)
- [ ] Fire a test alert and confirm receipt
