---
name: pre-deploy
type: hook
trigger: Before deployment to production
priority: 1
blocking: true
version: 1.0.0
---

# Pre-Deploy Hook (BLOCKING)

**CRITICAL**: Blocks deployment without passing Tier D verification.

## Actions

### 1. Full E2E Test Suite
```bash
pnpm turbo run test
# All tests must pass
```

### 2. Lighthouse Audit
```
Targets (all must be >90):
- Performance: >90
- Accessibility: >90
- Best Practices: >90
- SEO: >90
```

### 3. Security Scan
- No exposed secrets (.env, API keys)
- No dependency vulnerabilities (critical/high)
- HTTPS enforced
- Security headers configured

### 4. Environment Validation
- All required env vars set
- API connections working
- Database accessible
- Migrations applied

### 5. SEO Verification
- Schema markup valid
- Meta tags present
- Sitemap updated
- Robots.txt correct
- Australian context (en-AU, AUD)

## On Failure

**BLOCK DEPLOYMENT**

Generate failure report:
- Which checks failed
- Specific errors
- Remediation steps
- Re-run command

## Evidence Required

All checks must PASS with evidence collected.

## Integration

Called automatically before Vercel/production deployment.
