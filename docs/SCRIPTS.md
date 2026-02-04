# Synthex Scripts Inventory

> Generated: 2026-02-04
> Total Scripts: 97 files
> Location: `scripts/`

## Status Legend

| Status | Description |
|--------|-------------|
| :white_check_mark: ACTIVE | Currently in use, maintained |
| :warning: DEPRECATED | Legacy, will be removed |
| :construction: WIP | Work in progress |
| :no_entry: REDUNDANT | Duplicate functionality, consolidate |

---

## Deployment Scripts

### Primary Deployment
| Script | Status | Description |
|--------|--------|-------------|
| `deploy.js` | :white_check_mark: ACTIVE | Main deployment script |
| `deploy-v2.sh` | :white_check_mark: ACTIVE | Enhanced deployment with checks |
| `ultimate-deploy.ts` | :white_check_mark: ACTIVE | Full deployment pipeline (31KB) |
| `no-bullshit-deploy.ts` | :warning: DEPRECATED | Use `ultimate-deploy.ts` instead |

### Staging Deployment
| Script | Status | Description |
|--------|--------|-------------|
| `deploy-staging.sh` | :white_check_mark: ACTIVE | Deploy to staging environment |
| `deploy-staging-local.sh` | :warning: DEPRECATED | Use `deploy-staging.sh` |

### Production Deployment
| Script | Status | Description |
|--------|--------|-------------|
| `deploy-production.js` | :no_entry: REDUNDANT | Use `ultimate-deploy.ts` |
| `stable-deploy.js` | :no_entry: REDUNDANT | Use `ultimate-deploy.ts` |
| `direct-deploy.js` | :no_entry: REDUNDANT | Use `ultimate-deploy.ts` |
| `force-deploy.js` | :warning: DEPRECATED | Emergency use only |
| `emergency-deploy.js` | :warning: DEPRECATED | Emergency use only |
| `smart-deploy.sh` | :no_entry: REDUNDANT | Use `deploy-v2.sh` |
| `smart-deploy.ps1` | :no_entry: REDUNDANT | Windows version of above |

### Deployment Utilities
| Script | Status | Description |
|--------|--------|-------------|
| `deploy-assistant.js` | :white_check_mark: ACTIVE | Interactive deployment helper |
| `deployment-check.js` | :white_check_mark: ACTIVE | Pre-deployment validation |
| `pre-deploy-check.ts` | :white_check_mark: ACTIVE | Comprehensive pre-deploy checks |
| `real-deploy-check.ts` | :no_entry: REDUNDANT | Merged into `pre-deploy-check.ts` |

### Sentry Integration
| Script | Status | Description |
|--------|--------|-------------|
| `deploy-with-sentry.sh` | :white_check_mark: ACTIVE | Deploy with Sentry releases |
| `deploy-with-sentry.ps1` | :white_check_mark: ACTIVE | Windows version |
| `configure-sentry.ps1` | :white_check_mark: ACTIVE | Sentry configuration |

---

## Build & Verification Scripts

### Build Scripts
| Script | Status | Description |
|--------|--------|-------------|
| `build-production.js` | :white_check_mark: ACTIVE | Production build pipeline |
| `quick-build-check.sh` | :white_check_mark: ACTIVE | Fast build validation |
| `ensure-build-success.js` | :no_entry: REDUNDANT | Merged into `build-production.js` |
| `diagnose-build.js` | :white_check_mark: ACTIVE | Build failure diagnostics |
| `vercel-build-test.js` | :white_check_mark: ACTIVE | Test Vercel build config |

### Verification Scripts
| Script | Status | Description |
|--------|--------|-------------|
| `verify-deployment.js` | :white_check_mark: ACTIVE | Post-deploy health check |
| `verify-deployment.sh` | :white_check_mark: ACTIVE | Shell version with more checks |
| `production-verify.js` | :no_entry: REDUNDANT | Use `verify-deployment.js` |
| `validate-production.js` | :no_entry: REDUNDANT | Use `verify-deployment.js` |
| `final-check.sh` | :warning: DEPRECATED | Use `verify-deployment.sh` |
| `verify-animations.js` | :warning: DEPRECATED | Specific to animation feature |

---

## Database Scripts

### Migration & Setup
| Script | Status | Description |
|--------|--------|-------------|
| `apply-migrations.js` | :white_check_mark: ACTIVE | Apply Prisma migrations |
| `setup-database.js` | :white_check_mark: ACTIVE | Initial DB setup |
| `setup-local-db.js` | :white_check_mark: ACTIVE | Local development DB |
| `migrate-oauth-accounts.ts` | :white_check_mark: ACTIVE | OAuth data migration |

### Backup & Restore
| Script | Status | Description |
|--------|--------|-------------|
| `backup.sh` | :white_check_mark: ACTIVE | Database backup |
| `restore.sh` | :white_check_mark: ACTIVE | Database restore |
| `backup-system.js` | :white_check_mark: ACTIVE | Full backup system (28KB) |
| `backup-verification.js` | :white_check_mark: ACTIVE | Verify backup integrity |
| `run-backup-verification.js` | :no_entry: REDUNDANT | Use `backup-verification.js` |
| `generate-backup-checksum.js` | :white_check_mark: ACTIVE | Checksum generation |
| `setup-backup-schedule.sh` | :white_check_mark: ACTIVE | Cron backup scheduling |

---

## Testing Scripts

### API Testing
| Script | Status | Description |
|--------|--------|-------------|
| `test-api-endpoint.js` | :warning: DEPRECATED | Single endpoint test |
| `test-api-endpoints.js` | :white_check_mark: ACTIVE | Multiple endpoint tests |
| `run-integration-tests.js` | :white_check_mark: ACTIVE | Integration test runner |
| `test-integrations.js` | :white_check_mark: ACTIVE | Platform integration tests |

### Auth Testing
| Script | Status | Description |
|--------|--------|-------------|
| `test-auth.js` | :warning: DEPRECATED | Basic auth test |
| `test-auth-complete.js` | :white_check_mark: ACTIVE | Complete auth flow test |
| `test-auth-flow.js` | :no_entry: REDUNDANT | Use `test-auth-complete.js` |
| `test-supabase-auth.js` | :white_check_mark: ACTIVE | Supabase auth test |

### Service Testing
| Script | Status | Description |
|--------|--------|-------------|
| `test-openrouter.js` | :white_check_mark: ACTIVE | OpenRouter API test |
| `test-email-api.js` | :white_check_mark: ACTIVE | Email service test |
| `test-production-email.js` | :no_entry: REDUNDANT | Use `test-email-api.js` |
| `test-resend.js` | :warning: DEPRECATED | Resend provider test |
| `test-stripe-connection.js` | :white_check_mark: ACTIVE | Stripe API test |
| `test-sentry.js` | :white_check_mark: ACTIVE | Sentry integration test |

### Other Tests
| Script | Status | Description |
|--------|--------|-------------|
| `test-build.js` | :white_check_mark: ACTIVE | Build process test |
| `test-bypass-token.js` | :construction: WIP | Auth bypass testing |
| `test-dashboard.mjs` | :white_check_mark: ACTIVE | Dashboard E2E test |
| `test-db-connection.js` | :white_check_mark: ACTIVE | Database connection test |
| `test-env-validator.js` | :white_check_mark: ACTIVE | Env validation test |
| `test-local-db.js` | :white_check_mark: ACTIVE | Local DB test |
| `test-login.mjs` | :white_check_mark: ACTIVE | Login flow test |
| `test-register-final.js` | :white_check_mark: ACTIVE | Registration test |
| `test-user-journey.js` | :white_check_mark: ACTIVE | Full user journey test |
| `test-xss-fixes.js` | :white_check_mark: ACTIVE | XSS security test |
| `test-beta-locally.js` | :warning: DEPRECATED | Beta feature testing |

---

## Setup & Configuration Scripts

### Environment Setup
| Script | Status | Description |
|--------|--------|-------------|
| `setup-production.js` | :white_check_mark: ACTIVE | Production env setup |
| `setup-production-env.ts` | :no_entry: REDUNDANT | Use `setup-production.js` |
| `set-production-env.sh` | :no_entry: REDUNDANT | Use `setup-production.js` |
| `setup-vercel-env.sh` | :white_check_mark: ACTIVE | Vercel env vars setup |

### Validation
| Script | Status | Description |
|--------|--------|-------------|
| `validate-env.js` | :warning: DEPRECATED | Basic env validation |
| `validate-env-enhanced.js` | :white_check_mark: ACTIVE | Full env validation (15KB) |
| `validate-claude-settings.js` | :white_check_mark: ACTIVE | Claude settings validation |

---

## Fix & Maintenance Scripts

### Code Fixes
| Script | Status | Description |
|--------|--------|-------------|
| `fix-import-paths.js` | :warning: DEPRECATED | One-time import fix |
| `fix-lint-issues.js` | :white_check_mark: ACTIVE | Auto-fix lint errors |
| `fix-lint-warnings.js` | :no_entry: REDUNDANT | Merged into `fix-lint-issues.js` |
| `fix-prisma-imports.js` | :warning: DEPRECATED | One-time Prisma fix |
| `fix-typescript-errors.js` | :white_check_mark: ACTIVE | TypeScript error fixer |
| `final-import-fix.js` | :warning: DEPRECATED | One-time fix |

### Production Fixes
| Script | Status | Description |
|--------|--------|-------------|
| `fix-production-deployment.js` | :warning: DEPRECATED | Emergency production fix |
| `fix-production-site.js` | :warning: DEPRECATED | Emergency site fix |

---

## Utility Scripts

### Cache Management
| Script | Status | Description |
|--------|--------|-------------|
| `clear-build-cache.sh` | :white_check_mark: ACTIVE | Clear build cache |
| `clear-build-cache.bat` | :white_check_mark: ACTIVE | Windows version |

### Documentation
| Script | Status | Description |
|--------|--------|-------------|
| `generate-env-docs.js` | :white_check_mark: ACTIVE | Generate env documentation |
| `generate-sbom.js` | :white_check_mark: ACTIVE | Software bill of materials |

### Security
| Script | Status | Description |
|--------|--------|-------------|
| `security-hardening.sh` | :white_check_mark: ACTIVE | Security hardening checks |
| `check-tls-cert.ps1` | :white_check_mark: ACTIVE | TLS certificate check |

### Misc
| Script | Status | Description |
|--------|--------|-------------|
| `fast-check.js` | :white_check_mark: ACTIVE | Quick health check |
| `enhanced-workflows.sh` | :white_check_mark: ACTIVE | MCP workflow scripts |
| `complete-integration.ts` | :warning: DEPRECATED | One-time integration |
| `staging-test.js` | :white_check_mark: ACTIVE | Staging environment test |
| `websocket-server.ts` | :construction: WIP | WebSocket dev server |
| `feature-activation.js` | :white_check_mark: ACTIVE | Feature flag management |

---

## Linear Integration Scripts

| Script | Status | Description |
|--------|--------|-------------|
| `fetch-linear.js` | :white_check_mark: ACTIVE | Fetch Linear tasks |
| `get-linear-task.js` | :white_check_mark: ACTIVE | Get specific task |
| `get-task-details.js` | :no_entry: REDUNDANT | Use `get-linear-task.js` |
| `list-linear-tasks.js` | :white_check_mark: ACTIVE | List all tasks |
| `update-linear-status.js` | :white_check_mark: ACTIVE | Update task status |

---

## Recommended Consolidation

### Phase 1: Remove Redundant Scripts (15 files)
```
rm scripts/deploy-production.js
rm scripts/stable-deploy.js
rm scripts/direct-deploy.js
rm scripts/smart-deploy.sh
rm scripts/smart-deploy.ps1
rm scripts/real-deploy-check.ts
rm scripts/ensure-build-success.js
rm scripts/production-verify.js
rm scripts/validate-production.js
rm scripts/run-backup-verification.js
rm scripts/test-auth-flow.js
rm scripts/test-production-email.js
rm scripts/setup-production-env.ts
rm scripts/set-production-env.sh
rm scripts/fix-lint-warnings.js
rm scripts/get-task-details.js
```

### Phase 2: Archive Deprecated Scripts (16 files)
```
mkdir -p scripts/archive
mv scripts/no-bullshit-deploy.ts scripts/archive/
mv scripts/deploy-staging-local.sh scripts/archive/
mv scripts/force-deploy.js scripts/archive/
mv scripts/emergency-deploy.js scripts/archive/
mv scripts/final-check.sh scripts/archive/
mv scripts/verify-animations.js scripts/archive/
mv scripts/test-api-endpoint.js scripts/archive/
mv scripts/test-auth.js scripts/archive/
mv scripts/test-resend.js scripts/archive/
mv scripts/test-beta-locally.js scripts/archive/
mv scripts/validate-env.js scripts/archive/
mv scripts/fix-import-paths.js scripts/archive/
mv scripts/fix-prisma-imports.js scripts/archive/
mv scripts/final-import-fix.js scripts/archive/
mv scripts/fix-production-deployment.js scripts/archive/
mv scripts/fix-production-site.js scripts/archive/
mv scripts/complete-integration.ts scripts/archive/
```

---

## Quick Reference Commands

```bash
# Deployment
node scripts/ultimate-deploy.ts          # Full production deploy
./scripts/deploy-v2.sh                    # Standard deploy
./scripts/deploy-staging.sh               # Staging deploy

# Pre-deploy
node scripts/pre-deploy-check.ts          # Run all checks
node scripts/deployment-check.js          # Verify config

# Database
node scripts/apply-migrations.js          # Apply migrations
node scripts/backup-system.js backup      # Create backup
node scripts/backup-system.js restore     # Restore backup

# Testing
node scripts/test-auth-complete.js        # Test auth flow
node scripts/run-integration-tests.js     # Integration tests
node scripts/test-api-endpoints.js        # API tests

# Utilities
node scripts/fast-check.js                # Quick health check
node scripts/validate-env-enhanced.js     # Validate env vars
node scripts/clear-build-cache.sh         # Clear caches
```

---

## Subdirectories

| Directory | Contents |
|-----------|----------|
| `scripts/data/` | Static data files for scripts |
| `scripts/db/` | Database-specific scripts |
