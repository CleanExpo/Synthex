#!/bin/bash

# SYNTHEX 2.0 Production Deployment Script
# Version: 2.0.0
# Date: 2024-01-08

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${1:-production}
DEPLOYMENT_VERSION="2.0.0"
DEPLOYMENT_DATE=$(date +"%Y-%m-%d %H:%M:%S")
BACKUP_DIR="/backups/deployment"
LOG_FILE="/var/log/synthex/deployment-$(date +%Y%m%d-%H%M%S).log"

# Feature flags for progressive rollout
FEATURE_FLAGS=(
    "FEATURE_ANALYTICS_DASHBOARD=true"
    "FEATURE_AB_TESTING=true"
    "FEATURE_AI_CONTENT_GENERATION=true"
    "FEATURE_TEAM_COLLABORATION=true"
    "FEATURE_WHITE_LABEL=true"
    "FEATURE_ADVANCED_SCHEDULER=true"
    "FEATURE_CONTENT_LIBRARY=true"
    "FEATURE_MOBILE_API=false"  # Beta - disabled initially
    "FEATURE_AUTOMATED_REPORTING=true"
    "FEATURE_COMPETITOR_ANALYSIS=true"
)

# Logging function
log() {
    echo -e "${2:-$NC}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1" "$RED"
    exit 1
}

# Success message
success() {
    log "✓ $1" "$GREEN"
}

# Warning message
warning() {
    log "⚠ $1" "$YELLOW"
}

# Info message
info() {
    log "ℹ $1" "$BLUE"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_NODE="20.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
        error_exit "Node.js version must be >= $REQUIRED_NODE (current: $NODE_VERSION)"
    fi
    
    # Check required commands
    for cmd in git npm psql redis-cli nginx; do
        if ! command -v $cmd &> /dev/null; then
            error_exit "$cmd is not installed"
        fi
    done
    
    # Check disk space (minimum 5GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 5242880 ]; then
        error_exit "Insufficient disk space (< 5GB available)"
    fi
    
    success "Prerequisites check passed"
}

# Create backup
create_backup() {
    info "Creating pre-deployment backup..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    pg_dump synthex_production | gzip > "$BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    # Backup application
    tar -czf "$BACKUP_DIR/app-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
        /var/www/synthex \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs
    
    # Backup configuration
    cp -r /var/www/synthex/config "$BACKUP_DIR/config-backup-$(date +%Y%m%d-%H%M%S)"
    
    success "Backup completed"
}

# Run database migrations
run_migrations() {
    info "Running database migrations..."
    
    cd /var/www/synthex
    
    # Run migrations in order
    for migration in database/migrations/*.sql; do
        info "Applying migration: $(basename $migration)"
        psql -U synthex_user -d synthex_production -f "$migration" >> "$LOG_FILE" 2>&1
        
        if [ $? -ne 0 ]; then
            error_exit "Migration failed: $(basename $migration)"
        fi
    done
    
    success "Database migrations completed"
}

# Update application code
update_application() {
    info "Updating application code..."
    
    cd /var/www/synthex
    
    # Pull latest code
    git fetch origin
    git checkout v$DEPLOYMENT_VERSION
    
    # Install dependencies
    npm ci --production
    
    # Build application
    npm run build:prod
    
    success "Application updated to version $DEPLOYMENT_VERSION"
}

# Configure feature flags
configure_feature_flags() {
    info "Configuring feature flags..."
    
    for flag in "${FEATURE_FLAGS[@]}"; do
        KEY=$(echo $flag | cut -d'=' -f1)
        VALUE=$(echo $flag | cut -d'=' -f2)
        
        # Set in Redis
        redis-cli SET "feature:$KEY" "$VALUE" EX 86400
        
        # Set in environment
        echo "export $flag" >> /var/www/synthex/.env.production
        
        info "Set $KEY = $VALUE"
    done
    
    success "Feature flags configured"
}

# Health check
health_check() {
    info "Performing health checks..."
    
    # Wait for services to start
    sleep 10
    
    # Check application health
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
    if [ "$HTTP_STATUS" != "200" ]; then
        error_exit "Application health check failed (HTTP $HTTP_STATUS)"
    fi
    
    # Check database connectivity
    psql -U synthex_user -d synthex_production -c "SELECT 1" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        error_exit "Database connectivity check failed"
    fi
    
    # Check Redis connectivity
    redis-cli ping > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        error_exit "Redis connectivity check failed"
    fi
    
    success "All health checks passed"
}

# Run smoke tests
run_smoke_tests() {
    info "Running smoke tests..."
    
    cd /var/www/synthex
    
    # Run critical path tests
    npm run test:smoke
    
    if [ $? -ne 0 ]; then
        warning "Some smoke tests failed - review logs"
    else
        success "Smoke tests passed"
    fi
}

# Enable monitoring
enable_monitoring() {
    info "Enabling monitoring..."
    
    # Start monitoring services
    systemctl start prometheus-node-exporter
    systemctl start grafana-server
    
    # Configure alerts
    cat > /etc/prometheus/alerts.yml << EOF
groups:
  - name: synthex_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      - alert: SlowResponse
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        annotations:
          summary: "Slow response time detected"
EOF
    
    systemctl reload prometheus
    
    success "Monitoring enabled"
}

# Progressive rollout
progressive_rollout() {
    info "Starting progressive rollout..."
    
    # Stage 1: 10% of traffic
    info "Stage 1: Routing 10% of traffic to v2..."
    nginx_config "10"
    sleep 300  # Monitor for 5 minutes
    
    # Check metrics
    ERROR_RATE=$(curl -s http://localhost:9090/api/v1/query?query=rate\(http_requests_total{status=~\"5..\"}\[5m\]\) | jq '.data.result[0].value[1]' | tr -d '"')
    if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
        error_exit "High error rate detected during rollout"
    fi
    
    # Stage 2: 50% of traffic
    info "Stage 2: Routing 50% of traffic to v2..."
    nginx_config "50"
    sleep 300  # Monitor for 5 minutes
    
    # Stage 3: 100% of traffic
    info "Stage 3: Routing 100% of traffic to v2..."
    nginx_config "100"
    
    success "Progressive rollout completed"
}

# Update nginx configuration
nginx_config() {
    local PERCENTAGE=$1
    
    cat > /etc/nginx/conf.d/synthex-split.conf << EOF
split_clients "\$remote_addr" \$app_version {
    ${PERCENTAGE}% v2;
    *            v1;
}

upstream app_v1 {
    server localhost:3000;
}

upstream app_v2 {
    server localhost:3001;
}

server {
    listen 80;
    server_name synthex.app;
    
    location / {
        proxy_pass http://app_\$app_version;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
    
    nginx -t && systemctl reload nginx
}

# Send deployment notification
send_notification() {
    local STATUS=$1
    local MESSAGE=$2
    
    # Slack notification
    curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"🚀 SYNTHEX v$DEPLOYMENT_VERSION Deployment\",
            \"attachments\": [{
                \"color\": \"$([ "$STATUS" = "success" ] && echo "good" || echo "danger")\",
                \"fields\": [
                    {\"title\": \"Status\", \"value\": \"$STATUS\", \"short\": true},
                    {\"title\": \"Environment\", \"value\": \"$DEPLOYMENT_ENV\", \"short\": true},
                    {\"title\": \"Version\", \"value\": \"$DEPLOYMENT_VERSION\", \"short\": true},
                    {\"title\": \"Date\", \"value\": \"$DEPLOYMENT_DATE\", \"short\": true},
                    {\"title\": \"Message\", \"value\": \"$MESSAGE\", \"short\": false}
                ]
            }]
        }"
    
    # Email notification
    echo "$MESSAGE" | mail -s "SYNTHEX Deployment $STATUS" ops@synthex.app
}

# Rollback function
rollback() {
    error_exit "Deployment failed - initiating rollback..."
    
    # Restore from backup
    cd /var/www/synthex
    git checkout v1.9.0
    npm ci --production
    npm run build:prod
    
    # Restore database if needed
    if [ -f "$BACKUP_DIR/db-backup-*.sql.gz" ]; then
        gunzip -c "$BACKUP_DIR"/db-backup-*.sql.gz | psql -U synthex_user synthex_production
    fi
    
    # Restart services
    pm2 restart all
    
    send_notification "rollback" "Deployment failed and was rolled back"
    exit 1
}

# Main deployment flow
main() {
    log "========================================" "$BLUE"
    log "   SYNTHEX v$DEPLOYMENT_VERSION Deployment" "$BLUE"
    log "   Environment: $DEPLOYMENT_ENV" "$BLUE"
    log "   Date: $DEPLOYMENT_DATE" "$BLUE"
    log "========================================" "$BLUE"
    
    # Set up error handling
    trap rollback ERR
    
    # Pre-deployment
    check_prerequisites
    create_backup
    
    # Deployment
    info "Starting deployment..."
    
    # Enable maintenance mode
    echo "MAINTENANCE_MODE=true" >> /var/www/synthex/.env.production
    systemctl reload nginx
    
    # Deploy
    run_migrations
    update_application
    configure_feature_flags
    
    # Start services
    pm2 restart ecosystem.config.js --env production
    
    # Post-deployment
    health_check
    run_smoke_tests
    enable_monitoring
    
    # Progressive rollout
    progressive_rollout
    
    # Disable maintenance mode
    sed -i '/MAINTENANCE_MODE=true/d' /var/www/synthex/.env.production
    systemctl reload nginx
    
    # Success
    success "Deployment completed successfully!"
    send_notification "success" "SYNTHEX v$DEPLOYMENT_VERSION deployed successfully to $DEPLOYMENT_ENV"
    
    log "========================================" "$GREEN"
    log "   Deployment Summary" "$GREEN"
    log "   Version: $DEPLOYMENT_VERSION" "$GREEN"
    log "   Duration: $SECONDS seconds" "$GREEN"
    log "   Status: SUCCESS" "$GREEN"
    log "========================================" "$GREEN"
}

# Execute main function
main "$@"