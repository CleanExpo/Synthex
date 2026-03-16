# =============================================================================
# Synthex Task Runner (Justfile)
# Install: https://github.com/casey/just
# Usage: just <recipe>
# =============================================================================

# Default: list all recipes
default:
    @just --list

# ─── Development ─────────────────────────────────────────────────────────────

# Start development server (Turbo)
dev:
    npm run dev

# Start development server + WebSocket server
dev-full:
    npm run dev:full

# Open Prisma Studio
studio:
    npm run db:studio

# ─── Code Quality ────────────────────────────────────────────────────────────

# Run ESLint
lint:
    npm run lint

# Run ESLint with auto-fix
lint-fix:
    npm run lint -- --fix

# Run TypeScript type-check
types:
    npm run type-check

# Run Prettier formatting
format:
    npm run format

# Run all quality checks (lint + types + tests)
check:
    npm run lint && npm run type-check && npm test

# Pre-release validation (full)
release-check:
    npm run release:check

# ─── Testing ─────────────────────────────────────────────────────────────────

# Run unit tests
test:
    npm test

# Run tests in watch mode
test-watch:
    npm run test:watch

# Run tests with coverage report
coverage:
    npm run test:coverage

# Run E2E tests (Playwright)
e2e:
    npm run e2e

# Run E2E tests with UI
e2e-ui:
    npm run e2e:ui

# Run UI story validation (agent-driven Playwright stories)
ui-review:
    npx playwright install chromium --with-deps 2>/dev/null; echo "Run: /ui-review run in Claude to execute stories"

# ─── Database ────────────────────────────────────────────────────────────────

# Push schema to database
db-push:
    npm run db:push

# Create development migration
db-migrate:
    npm run db:migrate:dev

# Deploy migrations (production)
db-deploy:
    npm run db:migrate:deploy

# Show migration status
db-status:
    npm run db:status

# Generate Prisma client
db-generate:
    PRISMA_GENERATE_SKIP_AUTOINSTALL=true npx --no prisma generate

# Validate Prisma schema
db-validate:
    npm run db:validate

# Seed templates
db-seed:
    npm run seed:templates

# ─── Environment ─────────────────────────────────────────────────────────────

# Initial project setup (Unix)
setup:
    bash scripts/setup.sh

# Initial project setup (Windows)
setup-windows:
    powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

# Verify environment health (Unix)
verify:
    bash scripts/verify.sh

# Verify environment health (Windows)
verify-windows:
    powershell -ExecutionPolicy Bypass -File scripts/verify.ps1

# Validate environment variables
check-env:
    npm run validate:env:enhanced

# ─── Build & Deploy ──────────────────────────────────────────────────────────

# Production build
build:
    npm run build

# Build with cache cleared
build-fresh:
    npm run build:fresh

# Deploy to Vercel production
deploy:
    npm run deploy:prod

# ─── Security ────────────────────────────────────────────────────────────────

# Run security audit
security:
    npm run security:audit

# Run npm audit
audit:
    npm run audit

# ─── Utilities ───────────────────────────────────────────────────────────────

# Clear build cache
clean-cache:
    npm run clean:cache

# Install dependencies
install:
    npm install --legacy-peer-deps

# Reinstall all dependencies from scratch
reinstall:
    npm run reinstall
