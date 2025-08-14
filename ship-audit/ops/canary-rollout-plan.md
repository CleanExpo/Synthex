# 🚀 Canary Rollout Plan - SYNTHEX Production

## Deployment Strategy: Blue/Green with Canary

### Phase 1: Pre-Deployment (T-24h)
- [ ] Lower DNS TTL to 300 seconds
- [ ] Create feature flag configuration
- [ ] Backup production database
- [ ] Prepare rollback scripts
- [ ] Configure monitoring dashboards

### Phase 2: Blue Environment Setup (T-2h)
```bash
# Deploy to blue environment (staging-like)
vercel --scope synthex --env preview

# Verify blue environment
curl -I https://synthex-preview.vercel.app
```

### Phase 3: Canary Rollout (1% → 5% → 25% → 100%)

#### Stage 1: 1% Traffic (30 minutes)
```bash
# Enable canary for 1% of users
vercel alias set synthex-preview.vercel.app synthex.social --percentage 1

# Monitor metrics
- Error rate < 0.1%
- P95 latency < 500ms
- No critical alerts
```

#### Stage 2: 5% Traffic (2 hours)
```bash
# Increase to 5%
vercel alias set synthex-preview.vercel.app synthex.social --percentage 5

# Success Criteria:
- Error rate < 0.5%
- P95 latency < 750ms
- User complaints < 2
```

#### Stage 3: 25% Traffic (4 hours)
```bash
# Increase to 25%
vercel alias set synthex-preview.vercel.app synthex.social --percentage 25

# Success Criteria:
- Error rate < 1%
- P95 latency < 1000ms
- Core flows working
- No payment issues
```

#### Stage 4: 100% Traffic (Full rollout)
```bash
# Full traffic shift
vercel alias set synthex-preview.vercel.app synthex.social --percentage 100

# Post-deployment:
- Monitor for 24 hours
- Keep blue environment for 48h
```

## 🔄 Rollback Procedures

### One-Click Rollback
```bash
# Immediate rollback to previous version
vercel rollback synthex.social

# Or specific deployment
vercel alias set [PREVIOUS_DEPLOYMENT_URL] synthex.social
```

### Feature Flag Kill Switches
```javascript
// Emergency disable specific features
POST /api/admin/kill-switch
{
  "feature": "PAYMENTS_ENABLED",
  "action": "disable"
}

// Or via environment variable
KILL_PAYMENTS_ENABLED=true
```

### Database Rollback
```sql
-- Each migration includes rollback
-- Location: ship-audit/sql/rollback/
BEGIN;
  -- Rollback script here
  SELECT pg_sleep(0.1); -- Prevent accidental execution
ROLLBACK; -- Remove this when ready
```

## 📊 Monitoring During Rollout

### Key Metrics to Watch
| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Error Rate | < 0.5% | 0.5-1% | > 1% |
| P95 Latency | < 500ms | 500-1000ms | > 1000ms |
| Apdex Score | > 0.9 | 0.7-0.9 | < 0.7 |
| CPU Usage | < 50% | 50-70% | > 70% |
| Memory Usage | < 60% | 60-80% | > 80% |

### Alert Thresholds
```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 1% for 1 minute
    action: page_oncall
    
  - name: slow_response
    condition: p95_latency > 2000ms for 5 minutes
    action: slack_notification
    
  - name: payment_failures
    condition: payment_error_count > 3 in 5 minutes
    action: activate_kill_switch
```

## 🎯 Smoke Tests (Auto-Run)

### Critical Path Tests
```bash
# Run on new environment before traffic shift
npm run test:smoke:production

# Tests include:
1. User registration and login
2. Create and save campaign
3. Generate AI content
4. View analytics dashboard
5. Update user settings
```

### E2E Validation
```javascript
// playwright/smoke-tests/production.spec.ts
test('Critical user journey', async ({ page }) => {
  await page.goto('https://synthex.social');
  
  // Test homepage loads
  await expect(page).toHaveTitle(/Synthex/);
  
  // Test login flow
  await page.click('[data-testid="login-button"]');
  await page.fill('[name="email"]', 'test@synthex.social');
  await page.fill('[name="password"]', process.env.TEST_PASSWORD);
  await page.click('[type="submit"]');
  
  // Verify dashboard access
  await expect(page).toHaveURL(/.*dashboard/);
});
```

## 📋 Rollout Checklist

### Before Starting Canary
- [ ] All feature flags configured
- [ ] Kill switches tested
- [ ] Monitoring dashboards ready
- [ ] Rollback scripts prepared
- [ ] On-call team notified
- [ ] Customer support briefed

### During Each Stage
- [ ] Error rates within threshold
- [ ] Performance metrics acceptable
- [ ] No critical bugs reported
- [ ] Database connections stable
- [ ] Third-party integrations working

### After Full Rollout
- [ ] Remove canary configuration
- [ ] Update DNS TTL back to normal
- [ ] Document lessons learned
- [ ] Schedule retrospective
- [ ] Update runbooks

## 🚨 Emergency Contacts

| Role | Name | Contact | Escalation |
|------|------|---------|------------|
| Platform Lead | On-Call | PagerDuty | Immediate |
| Database Admin | DBA Team | Slack #dba | 5 min |
| Security | SecOps | security@synthex.social | 10 min |
| Customer Success | Support | support@synthex.social | 15 min |

---

**Last Updated:** 2025-08-14
**Next Review:** After each deployment