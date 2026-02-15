---
name: build-orchestrator
description: >
  5-phase deployment orchestrator for Synthex production releases. Manages the
  full lifecycle from preflight validation through post-deploy monitoring.
  Use when deploying to production, running build pipelines, or diagnosing
  deployment failures. Phases: PREFLIGHT, BUILD, DEPLOY, VERIFY, MONITOR.
---

# Build & Deployment Orchestrator

## Process

Execute phases sequentially. Each phase must PASS before proceeding to the next. If any phase FAILs, halt the pipeline, log the failure, and report.

1. **PREFLIGHT** -- validate all prerequisites before building
2. **BUILD** -- compile and bundle the application
3. **DEPLOY** -- push to Vercel production
4. **VERIFY** -- confirm the deployment is healthy
5. **MONITOR** -- watch error rates and latency post-deploy

## Phase 1: PREFLIGHT

Validate configuration, dependencies, and types before any build attempt.

### Steps
1. Verify `.env` / `.env.production` contains all required variables
2. Run `npm ci` to install exact dependency versions from lockfile
3. Run `npx prisma generate` to generate Prisma client
4. Run `npx tsc --noEmit` to validate TypeScript types
5. Confirm `vercel.json` exists and contains valid configuration
6. Check that `api/vercel.js` entry point exists

### Pass Criteria
- All environment variables present (no empty required values)
- `npm ci` exits 0
- `prisma generate` exits 0
- `tsc --noEmit` exits 0 with zero errors
- `vercel.json` parses as valid JSON with expected structure

### Fail Criteria
- Any missing required environment variable
- Dependency installation failure
- TypeScript compilation errors
- Missing or malformed `vercel.json`

## Phase 2: BUILD

Compile TypeScript and generate production bundle.

### Steps
1. Run `npm run build:prod`
2. Verify output directory (`dist/`) contains expected artifacts
3. Check bundle size against thresholds (warn if serverless function > 50MB)
4. Validate no dev dependencies leaked into production bundle

### Build Command
```bash
npm run build:prod
```

### Pass Criteria
- Build command exits 0
- `dist/` directory created with expected file structure
- No build warnings treated as errors
- Bundle size within acceptable limits

### Fail Criteria
- Non-zero exit code from build command
- Missing expected output files
- Bundle size exceeds hard limit (50MB for serverless function)

## Phase 3: DEPLOY

Push the built application to Vercel production.

### Steps
1. Run `vercel --prod` via Vercel CLI
2. Capture deployment URL from CLI output
3. Record deployment ID for rollback reference
4. Verify deployment status shows "Ready" in Vercel dashboard

### Deploy Command
```bash
vercel --prod
```

### Pass Criteria
- Vercel CLI exits 0
- Deployment URL returned and accessible
- Deployment status is "Ready"
- No function initialization errors in Vercel logs

### Fail Criteria
- Vercel CLI non-zero exit code
- Deployment stuck in "Building" or "Error" state
- Function crash on initialization

### Rollback Protocol
If deploy fails after push:
1. Identify last known-good deployment ID
2. Run `vercel rollback [deployment-id]`
3. Verify rollback deployment is healthy

## Phase 4: VERIFY

Confirm the live deployment is healthy and functional.

### Steps
1. **Health check** -- `GET /api/health` returns 200 with `{ "status": "ok" }`
2. **Smoke tests** -- verify critical endpoints:
   - `GET /api/health` -- 200 response
   - `GET /` -- 200 response, HTML contains expected title
   - `POST /api/auth/login` -- 401 with proper error shape (no credentials)
   - `GET /api/campaigns` -- 401 (auth required, confirms route exists)
3. **Response time** -- all smoke test responses complete within 5 seconds
4. **SSL verification** -- HTTPS certificate valid and not expiring within 30 days

### Pass Criteria
- Health endpoint returns 200
- All smoke test endpoints return expected status codes
- Response times under 5 seconds
- SSL certificate valid

### Fail Criteria
- Health endpoint returns non-200 or times out
- Any smoke test returns unexpected status code
- Response times exceed 10 seconds
- SSL certificate invalid or expiring within 7 days

## Phase 5: MONITOR

Watch the deployment for errors and performance degradation for 15 minutes post-deploy.

### Steps
1. Monitor Vercel function logs for error-level entries
2. Track error rate (target: < 1% of requests)
3. Track p95 latency (target: < 3 seconds)
4. Check for memory limit warnings (1024MB threshold)
5. Generate post-deploy report

### Monitoring Window
- Duration: 15 minutes post-deploy
- Check interval: every 3 minutes (5 checks)

### Pass Criteria
- Error rate < 1% across monitoring window
- p95 latency < 3 seconds
- No memory limit warnings
- No function timeout errors

### Fail Criteria
- Error rate > 5% triggers immediate rollback
- p95 latency > 10 seconds
- Out-of-memory crashes detected
- Repeated function timeouts

## Output Format

```markdown
## Deployment Report

| Phase | Status | Duration | Notes |
|-------|--------|----------|-------|
| PREFLIGHT | PASS/FAIL | Xs | [details] |
| BUILD | PASS/FAIL | Xs | [details] |
| DEPLOY | PASS/FAIL | Xs | [deployment URL] |
| VERIFY | PASS/FAIL | Xs | [endpoint results] |
| MONITOR | PASS/FAIL | Xs | [error rate, latency] |

### Overall: PASS / FAIL
### Deployment URL: [url]
### Deployment ID: [id]
### Rollback Command: `vercel rollback [id]`

### Errors (if any)
- [phase]: [error description]

### Metrics
- Build duration: Xs
- Bundle size: X MB
- Error rate: X%
- p95 latency: Xms
```

## Pipeline Halting Rules

- FAIL in any phase stops the pipeline immediately
- FAIL in DEPLOY or later triggers rollback consideration
- All failures are logged with full error output for diagnosis
- Operator is notified with failure details and suggested remediation
