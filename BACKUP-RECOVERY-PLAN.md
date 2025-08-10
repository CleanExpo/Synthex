# 🔐 SYNTHEX Backup and Recovery Plan

## 📋 Executive Summary
This document outlines the backup and disaster recovery procedures for the SYNTHEX platform to ensure business continuity and data protection.

## 🎯 Recovery Objectives

### RTO (Recovery Time Objective)
- **Critical Systems:** 1 hour
- **Non-critical Systems:** 4 hours
- **Full Recovery:** 24 hours

### RPO (Recovery Point Objective)
- **Database:** 15 minutes
- **Application Code:** Real-time (Git)
- **User Files:** 1 hour
- **Configuration:** Real-time (Version controlled)

## 🔄 Backup Strategy

### 1. Code Repository (GitHub)
**Frequency:** Real-time with every commit
**Retention:** Indefinite
**Location:** GitHub cloud

#### Backup Process:
```bash
# Manual backup to local
git clone https://github.com/unite-group/synthex.git synthex-backup-$(date +%Y%m%d)

# Create archive
tar -czf synthex-backup-$(date +%Y%m%d).tar.gz synthex-backup-$(date +%Y%m%d)
```

### 2. Database (Supabase/PostgreSQL)
**Frequency:** Every 15 minutes (automated)
**Retention:** 30 days rolling
**Location:** Supabase cloud + external backup

#### Backup Scripts:
```bash
# Automated backup script (save as backup-db.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="synthex"
BACKUP_DIR="/backups/database"

# Supabase backup
pg_dump $DATABASE_URL > $BACKUP_DIR/synthex_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/synthex_$DATE.sql

# Upload to cloud storage (S3/GCS)
aws s3 cp $BACKUP_DIR/synthex_$DATE.sql.gz s3://synthex-backups/db/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### 3. Environment Variables
**Frequency:** On change
**Retention:** Version controlled
**Location:** Encrypted in repository

#### Backup Process:
```bash
# Encrypt and backup env vars
gpg --symmetric --cipher-algo AES256 .env
git add .env.gpg
git commit -m "backup: Update encrypted environment variables"
```

### 4. User-Generated Content
**Frequency:** Hourly
**Retention:** 90 days
**Location:** Object storage (S3/GCS)

### 5. Application State
**Frequency:** Daily
**Retention:** 7 days
**Location:** Vercel + local backup

## 🚨 Disaster Recovery Procedures

### Scenario 1: Complete System Failure

#### Step 1: Assess the Situation (5 minutes)
```bash
# Check service status
curl -I https://synthex.ai
vercel ls synthex --yes

# Check database
psql $DATABASE_URL -c "SELECT 1"

# Check GitHub
git ls-remote origin
```

#### Step 2: Initiate Recovery (10 minutes)
```bash
# 1. Clone repository
git clone https://github.com/unite-group/synthex.git synthex-recovery

# 2. Install dependencies
cd synthex-recovery
npm install

# 3. Restore environment variables
gpg --decrypt .env.gpg > .env

# 4. Verify configuration
npm run type-check
```

#### Step 3: Restore Database (20 minutes)
```bash
# Get latest backup
aws s3 cp s3://synthex-backups/db/latest.sql.gz .
gunzip latest.sql.gz

# Restore to new database
createdb synthex_recovery
psql synthex_recovery < latest.sql

# Update DATABASE_URL in .env
```

#### Step 4: Deploy Application (15 minutes)
```bash
# Deploy to Vercel
vercel --prod --yes

# Verify deployment
curl https://synthex.ai/api/health
```

#### Step 5: Verify and Monitor (10 minutes)
- Check all critical endpoints
- Monitor error rates
- Verify data integrity
- Test user authentication

### Scenario 2: Database Corruption

#### Recovery Steps:
```bash
# 1. Stop application
vercel scale synthex 0

# 2. Create point-in-time recovery
pg_dump $DATABASE_URL > corrupted_backup.sql

# 3. Restore from last known good backup
psql $DATABASE_URL < last_good_backup.sql

# 4. Apply transaction logs if available
pg_restore --data-only --table=audit_log

# 5. Restart application
vercel scale synthex 1
```

### Scenario 3: Deployment Rollback

#### Immediate Rollback:
```bash
# List recent deployments
vercel ls synthex --yes

# Rollback to previous version
vercel rollback synthex-[previous-deployment-id]

# Or redeploy specific commit
git checkout [commit-hash]
vercel --prod --yes
```

### Scenario 4: Security Breach

#### Emergency Response:
```bash
# 1. Rotate all credentials immediately
node scripts/rotate-credentials.js

# 2. Revoke all user sessions
psql $DATABASE_URL -c "DELETE FROM sessions;"

# 3. Enable maintenance mode
vercel env add MAINTENANCE_MODE true

# 4. Audit logs
grep -r "suspicious_pattern" logs/

# 5. Deploy patched version
git checkout security-patch
vercel --prod --yes
```

## 📦 Recovery Scripts

### Create automated recovery script:
```bash
#!/bin/bash
# save as recover.sh

echo "🚨 Starting SYNTHEX Recovery Process..."

# Configuration
REPO_URL="https://github.com/unite-group/synthex.git"
BACKUP_S3="s3://synthex-backups"
RECOVERY_DIR="synthex-recovery-$(date +%Y%m%d_%H%M%S)"

# Step 1: Clone repository
echo "📥 Cloning repository..."
git clone $REPO_URL $RECOVERY_DIR
cd $RECOVERY_DIR

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Step 3: Restore environment
echo "🔐 Restoring environment variables..."
aws s3 cp $BACKUP_S3/env/.env.gpg .
gpg --decrypt .env.gpg > .env

# Step 4: Restore database
echo "💾 Restoring database..."
aws s3 cp $BACKUP_S3/db/latest.sql.gz .
gunzip latest.sql.gz
psql $DATABASE_URL < latest.sql

# Step 5: Deploy
echo "🚀 Deploying application..."
vercel --prod --yes

echo "✅ Recovery complete!"
```

## 🔍 Testing Procedures

### Monthly Disaster Recovery Test
1. **Week 1:** Test backup creation
2. **Week 2:** Test partial recovery (database only)
3. **Week 3:** Test full recovery (non-production)
4. **Week 4:** Review and update procedures

### Test Checklist:
- [ ] Backup scripts execute successfully
- [ ] Backups are accessible and valid
- [ ] Recovery scripts work as expected
- [ ] RTO and RPO objectives are met
- [ ] Team knows their responsibilities
- [ ] Documentation is up to date

## 👥 Team Responsibilities

### During Incident:
| Role | Primary Contact | Backup Contact | Responsibilities |
|------|----------------|----------------|------------------|
| Incident Commander | Team Lead | Senior Dev | Coordinate recovery |
| Database Admin | DBA | Backend Dev | Restore database |
| Platform Engineer | DevOps | Full Stack | Deploy application |
| Communications | PM | Team Lead | User updates |

## 📞 Emergency Contacts

### Critical Services:
- **Vercel Support:** support@vercel.com
- **Supabase Support:** support@supabase.io
- **GitHub Support:** https://support.github.com
- **Domain Registrar:** [Your registrar support]

### Internal Team:
- **On-Call Engineer:** [Phone/Slack]
- **Team Lead:** [Phone/Slack]
- **CTO:** [Phone/Email]

## 📊 Backup Monitoring

### Daily Checks:
```bash
# Check backup status
./scripts/check-backups.sh

# Verify backup integrity
pg_restore --list backup.sql.gz

# Test restoration (staging)
./scripts/test-restore.sh --env staging
```

### Alerts Configuration:
```yaml
# monitoring.yml
alerts:
  - name: backup_failed
    condition: backup_age > 24h
    severity: critical
    notify: [email, slack, pagerduty]
  
  - name: backup_storage_full
    condition: storage_usage > 90%
    severity: warning
    notify: [email, slack]
```

## 🔄 Maintenance Windows

### Scheduled Maintenance:
- **Weekly:** Sunday 2-4 AM UTC (backup verification)
- **Monthly:** First Sunday 2-6 AM UTC (full DR test)
- **Quarterly:** Announced 2 weeks prior (major updates)

## 📝 Documentation Updates

### Review Schedule:
- **Weekly:** Update contact information
- **Monthly:** Review procedures
- **Quarterly:** Full DR drill
- **Annually:** Complete plan review

## ⚡ Quick Recovery Commands

```bash
# Check system status
curl https://synthex.ai/api/health

# Emergency rollback
vercel rollback

# View recent deployments
vercel ls synthex --yes

# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# View application logs
vercel logs synthex --since 1h

# Scale application
vercel scale synthex 0  # Stop
vercel scale synthex 1  # Start

# Clear cache
vercel env rm CACHE_VERSION
vercel env add CACHE_VERSION $(date +%s)
```

## 📈 Metrics and Reporting

### Key Metrics:
- Backup success rate: Target 99.9%
- Recovery time achieved vs RTO
- Data loss vs RPO
- Number of recovery drills completed
- Time to detect issues

### Monthly Report Template:
```markdown
## Backup & Recovery Report - [Month Year]

### Backup Statistics
- Total backups: X
- Successful: X (XX%)
- Failed: X
- Average backup size: XX GB
- Storage used: XX GB / XXX GB

### Recovery Tests
- Tests performed: X
- Successful: X
- Average recovery time: XX minutes
- Issues identified: X

### Action Items
1. [Issue and resolution]
2. [Improvements needed]
```

---

**Document Version:** 1.0
**Last Updated:** 2025-08-10
**Next Review:** 2025-09-10
**Owner:** DevOps Team

## 🚨 In Case of Emergency

**If you're reading this during an incident:**
1. Don't panic
2. Follow the procedures step by step
3. Communicate status every 15 minutes
4. Document everything
5. Ask for help if needed

**Remember:** It's better to over-communicate than under-communicate during an incident.