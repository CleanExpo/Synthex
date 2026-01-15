---
name: pre-commit
type: hook
trigger: Before git commit
priority: 2
blocking: false
version: 1.0.0
---

# Pre-Commit Hook

Runs verification before git commit.

## Actions

### 0. Settings Validation
```bash
npm run validate:claude
```

### 1. Verification Check
```bash
pnpm turbo run type-check lint
```

### 2. Test Suite
```bash
pnpm turbo run test
```

### 3. Build Verification
```bash
pnpm turbo run build
```

### 4. Secret Scan
Check for exposed:
- API keys
- Passwords
- Tokens
- .env files

## On Failure

Report failures (non-blocking).

User decides whether to:
- Fix issues first (recommended)
- Commit anyway (not recommended)

## Integration

Works with Husky git hooks if configured.
