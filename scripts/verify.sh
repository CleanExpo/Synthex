#!/usr/bin/env bash
# =============================================================================
# Synthex Environment Verification Script
# Checks all services, env vars, and tooling are correctly configured
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

ok()   { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1"; }
warn() { WARN=$((WARN+1)); echo -e "  ${YELLOW}⚠${NC} $1"; }
section() { echo ""; echo -e "${CYAN}── $1${NC}"; }

echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}     Synthex Environment Verification   ${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

# ─────────────────────────────────────────
# Prerequisites
# ─────────────────────────────────────────
section "Prerequisites"

command -v node &>/dev/null && ok "Node.js $(node -v)" || fail "Node.js not installed"
command -v npm &>/dev/null  && ok "npm $(npm -v)"      || fail "npm not installed"
command -v git &>/dev/null  && ok "Git installed"       || fail "Git not installed"
command -v npx &>/dev/null  && ok "npx available"       || fail "npx not available"

# ─────────────────────────────────────────
# Project files
# ─────────────────────────────────────────
section "Project Files"

[ -f "package.json" ]       && ok "package.json"       || fail "package.json missing"
[ -f "tsconfig.json" ]      && ok "tsconfig.json"      || fail "tsconfig.json missing"
[ -f "prisma/schema.prisma" ] && ok "prisma/schema.prisma" || fail "prisma/schema.prisma missing"
[ -f "next.config.ts" ] || [ -f "next.config.js" ] && ok "next.config found" || fail "next.config missing"
[ -d "node_modules" ]       && ok "node_modules installed" || fail "node_modules missing — run npm install"
[ -d "node_modules/@prisma/client" ] && ok "Prisma client package present" || fail "Prisma client missing — run npm install"

# ─────────────────────────────────────────
# Environment variables
# ─────────────────────────────────────────
section "Environment Variables"

ENV_FILE=""
[ -f ".env.local" ] && ENV_FILE=".env.local"
[ -f ".env" ] && ENV_FILE=".env"

if [ -z "$ENV_FILE" ]; then
  fail "No .env or .env.local file found — run: cp .env.example .env.local"
else
  ok "Environment file: $ENV_FILE"

  # Required variables
  check_env() {
    local key=$1
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$val" ] && [ "$val" != "your_${key,,}" ] && [ "$val" != "CHANGE_ME" ]; then
      ok "${key} set"
    else
      fail "${key} not configured in $ENV_FILE"
    fi
  }

  check_env "DATABASE_URL"
  check_env "DIRECT_URL"
  check_env "NEXT_PUBLIC_SUPABASE_URL"
  check_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  check_env "JWT_SECRET"
  check_env "NEXTAUTH_SECRET"
fi

# ─────────────────────────────────────────
# Prisma
# ─────────────────────────────────────────
section "Prisma"

if PRISMA_GENERATE_SKIP_AUTOINSTALL=true npx --no prisma validate 2>/dev/null; then
  ok "Prisma schema valid"
else
  fail "Prisma schema validation failed"
fi

if [ -d "node_modules/@prisma/client" ]; then
  ok "Prisma client generated"
else
  fail "Prisma client not generated — run: npx prisma generate"
fi

# ─────────────────────────────────────────
# Git hooks
# ─────────────────────────────────────────
section "Git Hooks"

[ -f ".husky/pre-commit" ] && ok ".husky/pre-commit installed" || warn ".husky/pre-commit missing — run: npm run prepare"
[ -d ".husky/_" ] && ok "Husky initialized" || warn "Husky not initialized — run: npm run prepare"

# ─────────────────────────────────────────
# Connectivity (optional — skip if no env)
# ─────────────────────────────────────────
section "Service Connectivity"

# Health endpoint (if server running)
if command -v curl &>/dev/null; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "503" ]; then
    ok "Dev server responding at localhost:3000 (HTTP $HTTP_STATUS)"
  else
    warn "Dev server not running at localhost:3000 (start with: npm run dev)"
  fi
else
  warn "curl not available — skipping HTTP health check"
fi

# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
TOTAL_CHECKS=$((PASS + FAIL + WARN))
echo -e "  Checks: ${TOTAL_CHECKS} | ${GREEN}Pass: ${PASS}${NC} | ${RED}Fail: ${FAIL}${NC} | ${YELLOW}Warn: ${WARN}${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}✗ Verification FAILED — fix the issues above${NC}"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ Verification passed with warnings${NC}"
  exit 0
else
  echo -e "  ${GREEN}✓ All checks passed — environment ready${NC}"
  exit 0
fi
