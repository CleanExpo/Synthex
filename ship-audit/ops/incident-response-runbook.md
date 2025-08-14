# 🚨 Incident Response Runbook - SYNTHEX

## 🎯 Incident Classification

### Severity Levels
| Level | Description | Response Time | Example |
|-------|------------|---------------|---------|
| **P0 - Critical** | Complete outage or data breach | < 5 min | Site down, payment system compromised |
| **P1 - High** | Major feature broken | < 15 min | Login broken, AI generation failing |
| **P2 - Medium** | Degraded performance | < 1 hour | Slow responses, partial outages |
| **P3 - Low** | Minor issues | < 4 hours | UI bugs, non-critical errors |

## 📞 Escalation Matrix

### On-Call Rotation
| Time | Primary | Secondary | Manager |
|------|---------|-----------|---------|
| Weekday 9-5 | DevOps Team | Platform Team | Engineering Lead |
| Weekday 5-9 | Platform Team | DevOps Team | Engineering Lead |
| Weekend | Rotating | Rotating | On-call Manager |

### Contact Methods
1. **P0/P1**: PagerDuty → Phone → Slack
2. **P2**: Slack → Email → Phone
3. **P3**: Slack → Email

## 🔥 Common Incident Playbooks

### 1. Site Down (P0)
```bash
# IMMEDIATE ACTIONS (0-5 minutes)
1. Verify incident:
   curl -I https://synthex.social
   curl -I https://synthex-production.vercel.app

2. Check Vercel status:
   https://vercel.com/status
   vercel ls synthex --output json

3. Check Supabase:
   https://status.supabase.com
   Test connection: node scripts/test-db-connection.js

4. If confirmed down:
   - Post in #incidents: "INVESTIGATING: synthex.social down"
   - Start incident bridge
   - Page on-call if not already alerted

# DIAGNOSIS (5-15 minutes)
5. Check recent deployments:
   vercel ls synthex | head -10
   
6. Review error logs:
   vercel logs synthex --follow --since 30m

7. Check monitoring:
   - Error rate dashboard
   - Infrastructure metrics
   - Third-party service status

# MITIGATION (15+ minutes)
8. Quick fixes:
   a) Rollback if recent deployment:
      vercel rollback synthex.social
   
   b) Scale up if resource issue:
      vercel scale synthex --min 2 --max 10
   
   c) Enable maintenance mode:
      Set env var: MAINTENANCE_MODE=true

9. If database issue:
   - Switch to read replica
   - Restart connection pool
   - Check for locks: SELECT * FROM pg_stat_activity WHERE state = 'active';

10. Update status page every 15 minutes
```

### 2. High Error Rate (P1)
```bash
# IMMEDIATE ACTIONS
1. Check error metrics:
   - Current error rate
   - Error types and patterns
   - Affected endpoints

2. Identify source:
   grep "ERROR" logs/api.log | tail -100
   vercel logs synthex --follow | grep "5[0-9][0-9]"

3. Check recent changes:
   git log --oneline -10
   vercel ls synthex | head -5

# MITIGATION
4. If specific endpoint:
   - Enable kill switch for feature
   - Add rate limiting
   - Redirect traffic

5. If third-party service:
   - Switch to fallback
   - Enable circuit breaker
   - Queue requests for retry

6. If database:
   - Check slow queries
   - Kill long-running queries
   - Increase connection pool
```

### 3. Payment System Failure (P0)
```bash
# IMMEDIATE ACTIONS
1. ACTIVATE KILL SWITCH:
   curl -X POST https://synthex.social/api/admin/kill-switch \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"feature": "PAYMENTS_ENABLED", "action": "disable"}'

2. Verify payments disabled:
   - Check feature flag status
   - Confirm UI shows maintenance message

3. Assess impact:
   - Number of failed transactions
   - Customer complaints
   - Revenue impact

# INVESTIGATION
4. Check payment provider:
   - Provider status page
   - API health check
   - Recent webhooks

5. Review logs:
   grep "payment" logs/api.log | grep -E "ERROR|FAIL"

6. Test in sandbox:
   - Attempt test transaction
   - Verify webhook handling

# RECOVERY
7. Fix identified issues
8. Test thoroughly in staging
9. Gradual re-enable:
   - 1% canary for 30 minutes
   - Monitor closely
   - Increase to 10%, 50%, 100%
```

### 4. Database Connection Issues (P1)
```bash
# IMMEDIATE ACTIONS
1. Check connection pool:
   SELECT count(*) FROM pg_stat_activity;
   SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

2. Kill idle connections:
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';

3. Check for locks:
   SELECT * FROM pg_locks WHERE NOT granted;

# MITIGATION
4. Restart application pods:
   vercel scale synthex --min 0 --max 0
   sleep 10
   vercel scale synthex --min 1 --max 5

5. If connection limit:
   - Increase max_connections in Supabase
   - Reduce app pool size temporarily

6. Emergency maintenance:
   - Enable read-only mode
   - Queue writes to Redis
   - Process when recovered
```

### 5. Memory Leak / High CPU (P2)
```bash
# DIAGNOSIS
1. Check metrics:
   - Memory usage trend
   - CPU utilization
   - Response times

2. Identify problematic pods:
   vercel inspect synthex

3. Get heap snapshot:
   curl https://synthex.social/api/admin/heap-snapshot \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -o heap.json

# MITIGATION
4. Rolling restart:
   vercel scale synthex --force

5. Reduce load:
   - Enable rate limiting
   - Increase cache TTL
   - Defer background jobs

6. Profile in staging:
   - Reproduce issue
   - Use profiler
   - Identify memory leak
```

## 📊 Monitoring & Alerting

### Key Metrics to Watch
```yaml
alerts:
  - metric: error_rate
    threshold: "> 1%"
    duration: "1m"
    action: page_oncall
    
  - metric: p95_latency
    threshold: "> 2000ms"
    duration: "5m"
    action: slack_alert
    
  - metric: cpu_usage
    threshold: "> 80%"
    duration: "10m"
    action: auto_scale
    
  - metric: memory_usage
    threshold: "> 85%"
    duration: "5m"
    action: restart_pods
    
  - metric: database_connections
    threshold: "> 90%"
    duration: "2m"
    action: alert_dba
```

### Dashboard Links
- **Main Dashboard**: https://monitoring.synthex.social
- **Vercel Analytics**: https://vercel.com/synthex/analytics
- **Supabase Metrics**: https://app.supabase.com/project/[id]/database
- **Error Tracking**: https://sentry.io/synthex

## 📝 Incident Communication

### Status Page Updates
```markdown
# Template: Investigating
We are currently investigating reports of [issue description].
Our team is working to identify the root cause.
Next update in 15 minutes.

# Template: Identified
We have identified the issue as [root cause].
A fix is being implemented.
Current impact: [affected services].
Next update in 30 minutes.

# Template: Monitoring
A fix has been deployed and we are monitoring the results.
Service is returning to normal.
Next update in 1 hour.

# Template: Resolved
The incident has been resolved.
All services are operating normally.
Root cause: [brief explanation].
We apologize for any inconvenience.
```

### Internal Communication
1. **Slack Channels**:
   - `#incidents` - Live incident updates
   - `#eng-oncall` - Engineering coordination
   - `#customer-support` - Customer impact

2. **Incident Roles**:
   - **Incident Commander**: Overall coordination
   - **Tech Lead**: Technical investigation
   - **Comms Lead**: Status updates
   - **Support Lead**: Customer communication

## 🔧 Recovery Procedures

### Post-Incident Checklist
- [ ] Confirm all services restored
- [ ] Clear any queued jobs/requests
- [ ] Verify monitoring is green
- [ ] Update status page - Resolved
- [ ] Notify stakeholders
- [ ] Schedule post-mortem (P0/P1 only)

### Post-Mortem Template
```markdown
# Incident Post-Mortem: [Title]

## Summary
- **Date**: [Date]
- **Duration**: [Duration]
- **Severity**: [P0/P1/P2]
- **Impact**: [User impact]

## Timeline
- HH:MM - Event started
- HH:MM - Alert triggered
- HH:MM - Team engaged
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause
[Detailed explanation]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## What Went Well
- [Positive 1]
- [Positive 2]

## What Could Be Improved
- [Improvement 1]
- [Improvement 2]

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action 1] | [Name] | [Date] |
| [Action 2] | [Name] | [Date] |
```

## 🛠️ Tools & Scripts

### Quick Diagnostic Commands
```bash
# Health check all services
curl https://synthex.social/api/health

# Check recent errors
vercel logs synthex --follow | grep ERROR

# Database health
psql $DATABASE_URL -c "SELECT version();"

# Redis health (if using)
redis-cli ping

# DNS check
nslookup synthex.social
dig synthex.social

# TLS certificate
openssl s_client -connect synthex.social:443 -servername synthex.social
```

### Emergency Scripts Location
- `/scripts/emergency/rollback.sh`
- `/scripts/emergency/scale-up.sh`
- `/scripts/emergency/enable-maintenance.sh`
- `/scripts/emergency/clear-cache.sh`
- `/scripts/emergency/restart-services.sh`

---

**Last Updated**: 2025-08-14
**Next Review**: Monthly
**Owner**: Platform Team