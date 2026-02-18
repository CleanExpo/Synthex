---
name: search-engineer-pro
description: >-
  Executes technical SEO remediations, mobile-first indexing compliance,
  and INP performance optimization under CLI Control Plane supervision.
  Integrates Google Search Console API for indexing status, Business Profile
  API for GMB entity sync, and PageSpeed Insights API for Core Web Vitals.
  Handles robots.txt audits, JSON-LD schema injection, and mobile/desktop
  content parity validation.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: service-skill
  triggers:
    - technical SEO
    - INP optimization
    - mobile-first indexing
    - Core Web Vitals
    - schema injection
    - robots.txt audit
    - GMB sync
    - content parity
    - Search Console
    - PageSpeed
    - CWV remediation
    - mobile parity
  requires:
    - .claude/skills/geo-engine
    - .claude/skills/eeat-scorer
    - .claude/rules/operations/control-plane.md
---

# Search Engineer Pro — Technical SEO Execution

## Purpose

Technical execution layer for search optimization that bridges high-level SEO
strategy and granular web development. Operates under CLI Control Plane
supervision with validation gates for all changes affecting search visibility.

This skill handles the implementation side of SEO — where recommendations from
`seo-strategist` and analysis from `geo-engine` get translated into actual
code changes, configuration updates, and API integrations.

## When to Use

Activate this skill when:
- Auditing mobile/desktop content parity for mobile-first indexing compliance
- Optimizing Interaction to Next Paint (INP) to achieve <200ms threshold
- Injecting or validating JSON-LD schema markup
- Auditing and fixing robots.txt configuration
- Syncing Google My Business NAP data with on-page information
- Remediating Core Web Vitals issues (LCP, FID, CLS, INP)
- Integrating with Google Search Console API for indexing status
- Running PageSpeed Insights API audits programmatically
- Validating AI crawler access (GPTBot, ClaudeBot, PerplexityBot)

## When NOT to Use

- **Content scoring**: Use `geo-engine` for GEO/citability analysis
- **Content generation**: Use `local-seo-generator` for local content creation
- **E-E-A-T analysis**: Use `eeat-scorer` for trust signal evaluation
- **Full SEO audits**: Use `seo-audit` for comprehensive site analysis
- **SEO strategy**: Use `seo-strategist` for high-level planning

## Instructions

Follow the CLI Control Plane methodology: **Validate → Stabilize → Execute → Observe**

### 1. Classify Intent

Determine the task type before proceeding:
- **AUDIT**: Read-only analysis (robots.txt, parity, CWV metrics)
- **FIX**: Targeted remediation of specific issues
- **INJECT**: Adding new elements (schema, meta tags, headers)
- **SYNC**: Aligning data across sources (GMB ↔ on-page NAP)

### 2. Validate Environment

Before any action, confirm:
- [ ] Required API keys present (see Environment Variables section)
- [ ] Target files/URLs accessible
- [ ] Backup strategy identified for HIGH risk changes
- [ ] Control Plane rules loaded

### 3. Assess Risk Level

| Risk | Examples | Gate |
|------|----------|------|
| LOW | JSON-LD injection, alt-text, documentation | Proceed immediately |
| MEDIUM | CSS/JS optimization, image formats, lazy-loading | Confirm approach |
| HIGH | robots.txt changes, URL structure, auth configs | Pause and confirm |

### 4. Execute Technical Checks

For each task type, run the appropriate validation:

**Mobile Parity Audit**
```
1. Fetch desktop and mobile rendered HTML
2. Extract text content, images, structured data from each
3. Diff content sets — flag disparities
4. Report: missing content on mobile, different heading structure, hidden elements
```

**INP Optimization**
```
1. Run PageSpeed Insights API with INP category
2. Identify long tasks (>50ms) in main thread
3. Analyze event handlers, third-party scripts, hydration delays
4. Recommend: code splitting, defer/async, web workers, interaction debouncing
```

**Schema Injection**
```
1. Audit existing JSON-LD on target page(s)
2. Validate against schema.org specifications
3. Identify gaps vs. competitors
4. Generate compliant JSON-LD for missing types
5. Test with Google Rich Results Test
```

**Robots.txt Audit**
```
1. Fetch and parse robots.txt
2. Check for blocked resources that hurt rendering (CSS, JS)
3. Verify AI crawler directives (GPTBot, ClaudeBot, PerplexityBot)
4. Validate sitemap reference
5. Flag overly permissive or restrictive rules
```

### 5. Integrate Google APIs

**Search Console API**
- Indexing status for specific URLs
- Crawl errors and coverage issues
- Performance data (impressions, clicks, CTR, position)
- Mobile usability issues

**Business Profile API**
- NAP (Name, Address, Phone) consistency
- Business category alignment
- Review velocity and sentiment
- Entity graph connections

**PageSpeed Insights API**
- Core Web Vitals metrics (field + lab data)
- Performance score breakdown
- Specific remediation opportunities
- Resource-level timing

### 6. Apply Remediations

For approved changes:
1. Create backup or note rollback path
2. Implement change
3. Validate change took effect
4. Document what was changed and why

### 7. Verify Results

Post-implementation verification:
- Re-run the original diagnostic
- Compare before/after metrics
- Confirm no regressions introduced
- Update monitoring if applicable

### 8. Handle Errors Gracefully

| Error | Recovery Strategy |
|-------|-------------------|
| API rate limit | Exponential backoff, queue remaining requests |
| Invalid schema | Report validation errors with line numbers |
| Network timeout | Retry with increased timeout, then flag |
| Permission denied | Check API key scopes, escalate to user |

### 9. Document Changes

Every change should be logged:
```markdown
## Change Record

**Date**: {timestamp}
**Type**: {AUDIT|FIX|INJECT|SYNC}
**Target**: {file/URL}
**Before**: {state}
**After**: {state}
**Verification**: {result}
**Rollback**: {instructions}
```

### 10. Report Results

Produce structured output following the Output Specification below.

## Google API Integration

### Search Console API

**Purpose**: Real-time indexing status, crawl diagnostics, performance metrics

**Capabilities**:
- URL inspection (indexed, crawled, mobile-friendly status)
- Crawl stats (requests, response codes, avg response time)
- Performance reports (queries, pages, countries, devices)
- Coverage reports (valid, warning, error, excluded)
- Mobile usability issues

**Rate Limits**: 1,200 queries/minute (shared across all methods)

### Business Profile API

**Purpose**: GMB entity management, NAP consistency, review insights

**Capabilities**:
- Read/update business information (name, address, phone)
- Manage business categories
- Access review data (count, rating, velocity)
- Post updates and offers
- Get insights (views, searches, actions)

**Rate Limits**: 60 requests/minute per location

### PageSpeed Insights API

**Purpose**: Core Web Vitals, performance diagnostics, optimization suggestions

**Capabilities**:
- Lab metrics (Lighthouse): FCP, LCP, TBT, CLS, SI
- Field metrics (CrUX): LCP, FID/INP, CLS (when available)
- Performance score (0-100)
- Detailed audits with specific recommendations
- Resource-level waterfall data

**Rate Limits**: 400 queries/100 seconds (free tier)

## Risk Classification

### LOW Risk (proceed immediately)
- Adding alt text to images
- Injecting JSON-LD schema markup
- Adding meta descriptions
- Documentation and reporting
- Read-only API queries

### MEDIUM Risk (confirm approach first)
- CSS/JS optimization changes
- Image format conversions (WebP, AVIF)
- Implementing lazy-loading
- Adding preload/prefetch hints
- Modifying third-party script loading

### HIGH Risk (pause and confirm with user)
- robots.txt modifications
- URL structure changes
- Canonical tag changes
- Redirect implementations
- Authentication or access control changes
- Removing existing content or markup

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target | string | yes | URL, file path, or page identifier |
| task | enum | yes | AUDIT, FIX, INJECT, SYNC |
| scope | string | no | Specific area: 'cwv', 'schema', 'parity', 'robots', 'gmb' |
| platform | string | no | google, bing, ai-crawlers, all |
| dryRun | boolean | no | If true, report changes without applying |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| status | enum | PASS, FAIL, WARNING, PENDING |
| task | string | Task type executed |
| target | string | URL/file that was processed |
| findings | array | [{issue, severity, location, recommendation}] |
| changes | array | [{file, before, after, timestamp}] |
| metrics | object | {before: {}, after: {}, delta: {}} |
| apiCalls | array | [{api, endpoint, status, latency}] |
| nextSteps | array | Prioritized follow-up actions |

## Output Format

```markdown
## Technical SEO Report: {target}

### Status: {PASS | FAIL | WARNING}

### Task: {AUDIT | FIX | INJECT | SYNC}

### Executive Summary
{1-2 sentence overview of what was done and key findings}

### Findings

| # | Issue | Severity | Location | Recommendation |
|---|-------|----------|----------|----------------|
| 1 | {issue} | {CRITICAL/HIGH/MEDIUM/LOW} | {where} | {what to do} |

### Changes Applied

| File/URL | Change | Before | After |
|----------|--------|--------|-------|
| {target} | {description} | {old} | {new} |

### Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| INP | {ms} | {ms} | {±%} |
| LCP | {s} | {s} | {±%} |
| CLS | {score} | {score} | {±%} |

### API Calls

| API | Endpoint | Status | Latency |
|-----|----------|--------|---------|
| {api} | {endpoint} | {200/4xx/5xx} | {ms} |

### Verification
{confirmation that changes are working as expected}

### Next Steps
1. {prioritized action items}

### Rollback Instructions
{how to revert if issues arise}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SEARCH_CONSOLE_API_KEY` | For SC | Indexing status, performance data |
| `GOOGLE_BUSINESS_PROFILE_API_KEY` | For GBP | GMB entity management |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | CWV metrics (free tier available) |

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| API_KEY_MISSING | Environment variable not set | Report missing variable, skip API calls |
| RATE_LIMITED | Too many API requests | Backoff and retry, queue remaining |
| SCHEMA_INVALID | JSON-LD validation failed | Report errors with line numbers |
| PARITY_MISMATCH | Mobile differs from desktop | Report diff, suggest fixes |
| CWV_THRESHOLD | Metric exceeds target | Prioritize in recommendations |
| ROBOTS_BLOCKED | Critical resource disallowed | Flag as HIGH severity issue |

## Integration Notes

This skill works in conjunction with:
- **geo-engine**: Receives GEO scores, returns technical fixes for citability
- **eeat-scorer**: Receives E-E-A-T issues, returns author schema fixes
- **seo-strategist**: Receives strategy, returns implementation status
- **build-engineer**: Hands off deployment verification after changes

The `search-engineer` agent autonomously operates this skill under Hive Mind
orchestration for complex multi-step technical SEO tasks.
