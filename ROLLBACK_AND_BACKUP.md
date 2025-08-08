# SYNTHEX 2.0 Rollback Plan & Backup Strategy

## 🔄 Rollback Strategy

### Pre-Deployment Preparation

#### 1. Create Deployment Snapshot
```bash
# Tag current production version
git tag -a v1.9.0-stable -m "Last stable version before v2.0"
git push origin v1.9.0-stable

# Create database backup
pg_dump synthex_production > backup_pre_v2_$(date +%Y%m%d_%H%M%S).sql

# Backup current configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/ .env.production

# Document current state
echo "Production State: $(date)" > deployment_state.txt
echo "Current Version: v1.9.0" >> deployment_state.txt
echo "Database Schema: v1.9" >> deployment_state.txt
```

### Rollback Triggers

Initiate rollback if any of these conditions occur:
- [ ] Error rate exceeds 5% for 5 minutes
- [ ] Response time exceeds 2 seconds (p95)
- [ ] Database connection failures
- [ ] Critical feature malfunction
- [ ] Security breach detected
- [ ] Data corruption identified

### Rollback Procedure

#### Phase 1: Immediate Response (0-5 minutes)
```bash
# 1. Enable maintenance mode
echo "MAINTENANCE_MODE=true" >> .env.production
systemctl reload nginx

# 2. Stop application servers
pm2 stop synthex-app

# 3. Prevent new deployments
touch /var/lock/deployment.lock
```

#### Phase 2: Rollback Application (5-15 minutes)
```bash
# 1. Checkout previous version
git checkout v1.9.0-stable

# 2. Restore node modules
npm ci --production

# 3. Rebuild application
npm run build:prod

# 4. Restore previous configuration
tar -xzf config_backup_20240101.tar.gz

# 5. Start application with old version
pm2 start ecosystem.config.js --env production
```

#### Phase 3: Database Rollback (if needed)
```bash
# 1. Stop all connections
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='synthex_production';"

# 2. Restore database backup
psql -U postgres -c "DROP DATABASE IF EXISTS synthex_production;"
psql -U postgres -c "CREATE DATABASE synthex_production;"
psql -U synthex_user synthex_production < backup_pre_v2_20240101_120000.sql

# 3. Verify database integrity
psql -U synthex_user synthex_production -c "\dt"
psql -U synthex_user synthex_production -c "SELECT COUNT(*) FROM users;"
```

#### Phase 4: Verification (15-20 minutes)
```bash
# 1. Health checks
curl -f https://synthex.app/health || exit 1

# 2. Run smoke tests
npm run test:smoke

# 3. Check error logs
tail -f /var/log/synthex/error.log

# 4. Monitor metrics
watch -n 5 'curl -s https://synthex.app/api/metrics'

# 5. Disable maintenance mode
sed -i '/MAINTENANCE_MODE=true/d' .env.production
systemctl reload nginx
```

## 💾 Backup Strategy

### Backup Types & Schedule

#### 1. Database Backups
```bash
# Daily full backup (2 AM)
0 2 * * * pg_dump synthex_production | gzip > /backups/db/daily/synthex_$(date +\%Y\%m\%d).sql.gz

# Hourly incremental backup
0 * * * * pg_dump synthex_production --data-only --inserts | gzip > /backups/db/hourly/synthex_$(date +\%Y\%m\%d_\%H).sql.gz

# Weekly archive (Sunday 3 AM)
0 3 * * 0 pg_dump synthex_production | gzip > /backups/db/weekly/synthex_week_$(date +\%U).sql.gz

# Monthly archive (1st day, 4 AM)
0 4 1 * * pg_dump synthex_production | gzip > /backups/db/monthly/synthex_$(date +\%Y\%m).sql.gz
```

#### 2. Application Backups
```bash
# Daily code backup
0 1 * * * tar -czf /backups/app/synthex_app_$(date +\%Y\%m\%d).tar.gz /var/www/synthex --exclude=node_modules

# Configuration backup
0 */6 * * * tar -czf /backups/config/synthex_config_$(date +\%Y\%m\%d_\%H).tar.gz /var/www/synthex/config /var/www/synthex/.env*
```

#### 3. Media/Asset Backups
```bash
# Daily media sync to S3
0 3 * * * aws s3 sync /var/www/synthex/public/uploads s3://synthex-backups/media/ --delete

# Weekly full media backup
0 4 * * 0 tar -czf /backups/media/synthex_media_$(date +\%Y\%m\%d).tar.gz /var/www/synthex/public/uploads
```

### Backup Storage Locations

```yaml
Primary Storage:
  - Local: /backups/ (7 days retention)
  - Network: NAS server (30 days retention)

Secondary Storage:
  - AWS S3: synthex-backups bucket (90 days retention)
  - Google Cloud Storage: synthex-archive (1 year retention)

Offsite Storage:
  - AWS Glacier: Long-term archive (7 years retention)
```

### Automated Backup Script
```bash
#!/bin/bash
# /scripts/backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
S3_BUCKET="synthex-backups"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> /var/log/backup.log
}

# Database backup
backup_database() {
    log "Starting database backup..."
    
    pg_dump synthex_production | gzip > "$BACKUP_DIR/db/synthex_db_$DATE.sql.gz"
    
    if [ $? -eq 0 ]; then
        log "Database backup completed successfully"
        
        # Upload to S3
        aws s3 cp "$BACKUP_DIR/db/synthex_db_$DATE.sql.gz" "s3://$S3_BUCKET/db/"
        
        # Verify backup
        gunzip -t "$BACKUP_DIR/db/synthex_db_$DATE.sql.gz"
        if [ $? -eq 0 ]; then
            log "Backup verification successful"
        else
            log "ERROR: Backup verification failed!"
            send_alert "Database backup verification failed"
        fi
    else
        log "ERROR: Database backup failed!"
        send_alert "Database backup failed"
    fi
}

# Application backup
backup_application() {
    log "Starting application backup..."
    
    tar -czf "$BACKUP_DIR/app/synthex_app_$DATE.tar.gz" \
        /var/www/synthex \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs
    
    if [ $? -eq 0 ]; then
        log "Application backup completed"
        aws s3 cp "$BACKUP_DIR/app/synthex_app_$DATE.tar.gz" "s3://$S3_BUCKET/app/"
    else
        log "ERROR: Application backup failed!"
        send_alert "Application backup failed"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Remove local backups older than 7 days
    find $BACKUP_DIR -type f -mtime +7 -delete
    
    # Remove S3 backups older than 90 days
    aws s3 ls "s3://$S3_BUCKET/" --recursive | while read -r line; do
        createDate=$(echo $line | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "90 days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo $line | awk '{print $4}')
            aws s3 rm "s3://$S3_BUCKET/$fileName"
        fi
    done
    
    log "Cleanup completed"
}

# Send alert
send_alert() {
    curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"⚠️ Backup Alert: $1\"}"
}

# Main execution
main() {
    log "=== Starting backup process ==="
    
    backup_database
    backup_application
    cleanup_old_backups
    
    log "=== Backup process completed ==="
}

main
```

### Disaster Recovery Plan

#### Recovery Time Objectives (RTO)
- Critical Services: 30 minutes
- Core Features: 1 hour
- Full System: 4 hours

#### Recovery Point Objectives (RPO)
- Database: 1 hour maximum data loss
- User uploads: 24 hours maximum
- Configuration: Real-time replication

### Recovery Procedures

#### 1. Total System Failure
```bash
# 1. Provision new infrastructure
terraform apply -var-file=production.tfvars

# 2. Restore latest database backup
psql -h new-db-host -U synthex_user synthex_production < latest_backup.sql

# 3. Deploy application
git clone https://github.com/synthex/app.git
cd app && npm ci --production
npm run build:prod
pm2 start ecosystem.config.js

# 4. Restore media files
aws s3 sync s3://synthex-backups/media/ /var/www/synthex/public/uploads/

# 5. Update DNS
aws route53 change-resource-record-sets --hosted-zone-id Z123456 --change-batch file://dns-update.json
```

#### 2. Database Corruption
```bash
# 1. Stop application
pm2 stop all

# 2. Create corruption backup (for analysis)
pg_dump synthex_production > corrupted_$(date +%Y%m%d).sql

# 3. Drop and recreate database
psql -U postgres -c "DROP DATABASE synthex_production;"
psql -U postgres -c "CREATE DATABASE synthex_production;"

# 4. Restore from last known good backup
psql -U synthex_user synthex_production < /backups/db/last_good_backup.sql

# 5. Apply transaction logs (if available)
pg_restore -U synthex_user -d synthex_production /backups/wal/

# 6. Verify data integrity
npm run db:verify

# 7. Restart application
pm2 restart all
```

### Backup Testing Schedule

#### Monthly Tests
- [ ] Restore database to test environment
- [ ] Verify application startup with restored data
- [ ] Test user authentication
- [ ] Validate data integrity

#### Quarterly Tests
- [ ] Full disaster recovery drill
- [ ] Restore to different infrastructure
- [ ] Measure recovery time
- [ ] Document issues and improvements

### Monitoring & Alerts

```yaml
Backup Monitoring:
  - Backup completion status
  - Backup size trends
  - Backup duration
  - Storage usage
  
Alert Conditions:
  - Backup failure
  - Backup size anomaly (>20% change)
  - Storage space < 20%
  - Verification failure
```

## Feature Flag Rollback

### Feature-Specific Rollback
```javascript
// config/feature-flags.js
const featureFlags = {
  analyticsV2: {
    enabled: true,
    rollback: () => {
      // Disable new analytics
      process.env.FEATURE_ANALYTICS_V2 = 'false';
      // Clear analytics cache
      redis.del('analytics:*');
      // Restart analytics service
      pm2.restart('analytics-service');
    }
  },
  aiContentGen: {
    enabled: true,
    rollback: () => {
      process.env.FEATURE_AI_CONTENT = 'false';
      // Fallback to v1 content generation
      process.env.CONTENT_API = 'v1';
    }
  }
};

// Emergency feature toggle
async function toggleFeature(featureName, enabled) {
  featureFlags[featureName].enabled = enabled;
  if (!enabled && featureFlags[featureName].rollback) {
    await featureFlags[featureName].rollback();
  }
  await redis.set(`feature:${featureName}`, enabled);
  return { feature: featureName, enabled };
}
```

## Post-Rollback Checklist

- [ ] Verify all services are running
- [ ] Check database connectivity
- [ ] Test critical user journeys
- [ ] Monitor error rates
- [ ] Review rollback logs
- [ ] Update status page
- [ ] Notify stakeholders
- [ ] Schedule post-mortem
- [ ] Document lessons learned
- [ ] Update rollback procedures

## Contact Information

### Escalation Path
1. **On-Call Engineer**: +1-XXX-XXX-XXXX
2. **DevOps Lead**: devops@synthex.app
3. **CTO**: cto@synthex.app
4. **External Support**: support@cloudprovider.com

### Communication Channels
- **Slack**: #incidents channel
- **PagerDuty**: synthex.pagerduty.com
- **Status Page**: status.synthex.app