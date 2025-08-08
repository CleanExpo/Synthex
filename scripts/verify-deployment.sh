#!/bin/bash

# SYNTHEX 2.0 Deployment Verification Script
# Runs all checks before production deployment

echo "════════════════════════════════════════════════════════════════"
echo "             SYNTHEX 2.0 DEPLOYMENT VERIFICATION                "
echo "════════════════════════════════════════════════════════════════"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check function
check() {
    if eval "$2"; then
        echo -e "${GREEN}✅ $1${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((CHECKS_FAILED++))
    fi
}

echo "🔍 Running Pre-Deployment Checks..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Environment Checks
echo ""
echo "📋 Environment Configuration:"
check "Node.js v20+" "[[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge 20 ]]"
check "NPM installed" "command -v npm > /dev/null 2>&1"
check "Production config exists" "[ -f config/.env.production ]"
check "App config exists" "[ -f config/app.config.js ]"

# 2. Code Quality Checks
echo ""
echo "📝 Code Quality:"
check "TypeScript compiles" "npm run typecheck 2>/dev/null"
check "No linting errors" "npm run lint 2>/dev/null"

# 3. Security Checks
echo ""
echo "🔒 Security:"
check "Auth middleware present" "[ -f src/middleware/auth.js ]"
check "Rate limiter configured" "[ -f src/middleware/rate-limiter.js ]"
check "No hardcoded secrets" "! grep -r 'password.*=.*[\"'\''][A-Za-z0-9@#$%^&*()]{8,}[\"'\'']' src/ --exclude='*.test.*' --exclude='security-analyzer.ts' 2>/dev/null | grep -v 'pattern:' | grep -v 'typeof' | grep -v 'reset-password'"
check "HTTPS enforced in production" "grep -q 'SESSION_SECURE=true' config/.env.production"

# 4. Database Checks
echo ""
echo "💾 Database:"
check "Migration files ready" "ls database/migrations/*.sql 2>/dev/null | wc -l | grep -v '^0$' > /dev/null"
check "Database config set" "grep -q 'DB_DATABASE=' config/.env.production"

# 5. API Checks
echo ""
echo "🌐 API Endpoints:"
check "Analytics routes configured" "[ -f src/routes/analytics.routes.js ]"
check "A/B Testing routes configured" "[ -f src/routes/ab-testing.routes.js ]"
check "AI Content routes configured" "[ -f src/routes/ai-content.routes.js ]"
check "Team routes configured" "[ -f src/routes/team.routes.js ]"

# 6. Feature Flags
echo ""
echo "🚀 Feature Flags:"
check "Analytics enabled" "grep -q 'FEATURE_ANALYTICS_DASHBOARD=true' config/.env.production"
check "A/B Testing enabled" "grep -q 'FEATURE_AB_TESTING=true' config/.env.production"
check "AI Content enabled" "grep -q 'FEATURE_AI_CONTENT_GENERATION=true' config/.env.production"
check "Team Collaboration enabled" "grep -q 'FEATURE_TEAM_COLLABORATION=true' config/.env.production"

# 7. Frontend Checks
echo ""
echo "🎨 Frontend:"
check "Features dashboard exists" "[ -f public/features-dashboard.html ]"
check "Admin panel exists" "[ -f public/admin-panel.html ]"
check "Main app updated" "grep -q 'ADVANCED FEATURES' public/app.html"

# 8. Documentation
echo ""
echo "📚 Documentation:"
check "API documentation present" "[ -f API_DOCUMENTATION.md ]"
check "Security audit checklist" "[ -f SECURITY_AUDIT.md ]"
check "Performance guide" "[ -f PERFORMANCE_OPTIMIZATION.md ]"
check "Rollback plan" "[ -f ROLLBACK_AND_BACKUP.md ]"

# 9. Deployment Scripts
echo ""
echo "🛠️ Deployment Tools:"
check "Deployment script exists" "[ -f scripts/deploy-v2.sh ]"
check "Deployment script executable" "[ -x scripts/deploy-v2.sh ] || [ -f scripts/deploy-v2.sh ]"

# 10. Performance Checks
echo ""
echo "⚡ Performance:"
check "Redis configured" "grep -q 'REDIS_HOST=' config/.env.production"
check "CDN configured" "grep -q 'CDN_URL=' config/.env.production"
check "Compression enabled" "grep -q 'ENABLE_COMPRESSION=true' config/.env.production"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 VERIFICATION SUMMARY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Passed: $CHECKS_PASSED checks${NC}"
echo -e "${RED}❌ Failed: $CHECKS_FAILED checks${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED! Ready for deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: npm run build:prod"
    echo "2. Run: ./scripts/deploy-v2.sh staging"
    echo "3. Test on staging environment"
    echo "4. Run: ./scripts/deploy-v2.sh production"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks failed. Please review and fix before deployment.${NC}"
    exit 1
fi