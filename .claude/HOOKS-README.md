# Claude Code Hooks - Important Configuration Guide

## ⚠️ CRITICAL: Do NOT Define Hooks in settings.json

**WRONG ❌** - This will cause validation errors:
```json
{
  "hooks": {
    "preCommit": ["typecheck", "lint-staged"],
    "prePush": ["test", "build"],
    "onMigration": ["db:types"]
  }
}
```

**CORRECT ✅** - Define hooks as separate `.hook.md` files:

## How to Define Hooks

Hooks must be created as individual markdown files in `.claude/hooks/` with YAML frontmatter:

```markdown
---
name: pre-commit
type: hook
trigger: Before git commit
priority: 2
blocking: false
version: 1.0.0
---

# Pre-Commit Hook

Description of what this hook does.

## Actions

### 1. Action Name
\```bash
command to run
\```
```

## Existing Hooks in This Project

- `pre-commit.hook.md` - Runs before git commits
- `pre-deploy.hook.md` - Runs before deployments
- `pre-publish.hook.md` - Runs before publishing
- `pre-response.hook.md` - Runs before AI responses
- `pre-agent-dispatch.hook.md` - Runs before agent dispatch
- `pre-seo-task.hook.md` - Runs before SEO tasks
- `post-code.hook.md` - Runs after code changes
- `post-session.hook.md` - Runs after sessions
- `post-skill-load.hook.md` - Runs after skills load
- `post-verification.hook.md` - Runs after verification

## Why This Matters

1. **Settings Validation**: Claude Code v1.3+ validates settings.json and rejects invalid keys
2. **File Skipping**: Files with validation errors are skipped entirely, breaking functionality
3. **Proper Hook System**: Hooks defined as `.hook.md` files are properly loaded and executed

## If You See Hook Validation Errors

Run this command to check your settings:
```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8')); console.log('✅ Valid');"
```

If you see `hooks` in settings.json, remove that entire section.

## Issue Fixed

**Date**: 2026-01-16
**Issue**: `settings.json` contained invalid `hooks` section causing validation errors
**Solution**: Removed hooks from `settings.json` - they're properly defined in `.claude/hooks/*.hook.md` files
**Prevention**: This document + validation script below

## Validation Script

Add this to your workflow to catch this issue early:

```bash
# Check for invalid hooks in settings.json
if grep -q '"hooks"' .claude/settings.json 2>/dev/null; then
    echo "❌ ERROR: Invalid 'hooks' section found in settings.json"
    echo "Hooks must be defined in .claude/hooks/*.hook.md files"
    exit 1
fi
echo "✅ Settings.json validation passed"
```
