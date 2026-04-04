#!/usr/bin/env bash
# =============================================================================
# Synthex Developer Setup Script
# Automates local development environment configuration
# =============================================================================
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

STEP=0
TOTAL=7

step() {
  STEP=$((STEP + 1))
  echo ""
  echo -e "${CYAN}[${STEP}/${TOTAL}]${NC} ${BLUE}$1${NC}"
  echo "────────────────────────────────────────"
}

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}     Synthex Development Setup          ${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

# ─────────────────────────────────────────
# Step 1: Check prerequisites
# ─────────────────────────────────────────
step "Checking prerequisites"

# Node.js
if ! command -v node &> /dev/null; then
  fail "Node.js not found. Install from https://nodejs.org (v20+)"
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  fail "Node.js v20+ required. Current: $(node -v)"
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &> /dev/null; then
  fail "npm not found"
fi
ok "npm $(npm -v)"

# Git
if ! command -v git &> /dev/null; then
  fail "Git not found. Install from https://git-scm.com"
fi
ok "Git $(git --version | awk '{print $3}')"

# ─────────────────────────────────────────
# Step 2: Install dependencies
# ─────────────────────────────────────────
step "Installing dependencies"
if npm install --legacy-peer-deps; then
  ok "Dependencies installed"
else
  fail "npm install failed"
fi

# ─────────────────────────────────────────
# Step 3: Configure environment
# ─────────────────────────────────────────
step "Configuring environment"
if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env.local
    warn ".env.local created from .env.example — fill in your API keys"
  else
    warn "No .env.example found — create .env.local manually"
  fi
else
  ok "Environment file already exists"
fi

# ─────────────────────────────────────────
# Step 4: Set up Git hooks
# ─────────────────────────────────────────
step "Installing Git hooks"
if npm run prepare 2>/dev/null; then
  ok "Husky hooks installed"
else
  warn "Husky install skipped (not in a Git repository)"
fi

# ─────────────────────────────────────────
# Step 5: Generate Prisma client
# ─────────────────────────────────────────
step "Generating Prisma client"
if PRISMA_GENERATE_SKIP_AUTOINSTALL=true npx --no prisma generate 2>/dev/null; then
  ok "Prisma client generated"
else
  warn "Prisma generate failed — run manually: npx prisma generate"
fi

# ─────────────────────────────────────────
# Step 6: Verify TypeScript
# ─────────────────────────────────────────
step "Checking TypeScript configuration"
if npx tsc --noEmit --pretty false 2>/dev/null | grep -c "error" | grep -q "^0$" 2>/dev/null; then
  ok "TypeScript: no errors"
else
  warn "TypeScript has pre-existing errors — run 'npm run type-check' for details"
fi

# ─────────────────────────────────────────
# Step 7: Final summary
# ─────────────────────────────────────────
step "Setup complete"
echo ""
echo -e "${GREEN}✓ Synthex development environment ready!${NC}"
echo ""
echo "  Next steps:"
echo "  1. Fill in API keys in .env.local (see .env.example for guidance)"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
echo "  Useful commands:"
echo "  npm run dev           — Start development server"
echo "  npm run type-check    — Check TypeScript"
echo "  npm run lint          — Run ESLint"
echo "  npm test              — Run unit tests"
echo "  npm run e2e           — Run E2E tests"
echo "  npm run verify        — Health check all services"
echo ""
