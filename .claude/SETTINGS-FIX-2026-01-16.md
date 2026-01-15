# Claude Settings Validation Fix - 2026-01-16

## Problem

Settings validation errors in `.claude/settings.json`:
```
C:\Synthex\.claude\settings.json
  └ hooks
    ├ onMigration: Invalid key in record
    ├ preCommit: Invalid key in record
    └ prePush: Invalid key in record

Files with errors are skipped entirely, not just the invalid settings.
```

## Root Cause

The `hooks` section was defined directly in `settings.json`:
```json
"hooks": {
  "preCommit": ["typecheck", "lint-staged"],
  "prePush": ["test", "build"],
  "onMigration": ["db:types"]
}
```

This is **INVALID** in Claude Code v1.3+. Hooks must be defined as separate `.hook.md` files in `.claude/hooks/`.

## Solution Applied

### 1. Removed Invalid Hooks Section
- ✅ Deleted the `hooks` object from `.claude/settings.json` (lines 186-190)
- ✅ Verified JSON is now valid
- ✅ Settings validation now passes

### 2. Created Validation Infrastructure

**Created Files:**
- `.claude/HOOKS-README.md` - Documentation on correct hook configuration
- `scripts/validate-claude-settings.js` - Automated validation script

**Updated Files:**
- `package.json` - Added validation scripts:
  - `npm run validate:claude` - Validate Claude settings
  - `npm run validate:all` - Validate env + Claude settings
- `.claude/hooks/pre-commit.hook.md` - Added settings validation step

### 3. Testing & Verification

```bash
# Test validation script
npm run validate:claude
# Output: ✅ VALIDATION PASSED - Settings are valid

# Verify JSON syntax
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8')); console.log('Valid');"
# Output: Valid

# Check global settings (no issues found)
cat ~/.claude/settings.json
# Output: Valid global config without hooks section
```

## Prevention Measures

### Automatic Checks
1. **Pre-commit Hook**: Validates settings before every commit
2. **Package Script**: `npm run validate:claude` can be run anytime
3. **CI Integration**: Can be added to CI workflows if needed

### Documentation
- `.claude/HOOKS-README.md` - Explains correct hook configuration
- Validation script provides clear error messages with fix instructions

### Future Protection
The validation script will catch if someone accidentally adds:
- Invalid `hooks` section to settings.json
- Invalid top-level hook keys (preCommit, postDeploy, etc.)
- Any other common misconfigurations

## How Hooks Should Be Defined

**CORRECT ✅**: Separate `.hook.md` files
```
.claude/
  └── hooks/
      ├── pre-commit.hook.md
      ├── pre-deploy.hook.md
      ├── post-code.hook.md
      └── ...
```

Each hook file has YAML frontmatter:
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
...
```

**WRONG ❌**: In settings.json
```json
{
  "hooks": { ... }  // This causes validation errors!
}
```

## Verification Commands

```bash
# Validate Claude settings
npm run validate:claude

# Validate all project settings
npm run validate:all

# Manual JSON check
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8')); console.log('✅ Valid');"

# List existing hooks
ls -la .claude/hooks/
```

## Files Modified

1. `.claude/settings.json` - Removed invalid hooks section
2. `package.json` - Added validation scripts
3. `.claude/hooks/pre-commit.hook.md` - Added settings validation step

## Files Created

1. `.claude/HOOKS-README.md` - Hook configuration guide
2. `scripts/validate-claude-settings.js` - Validation script
3. `.claude/SETTINGS-FIX-2026-01-16.md` - This document

## Status

✅ **FIXED AND PREVENTED**

- Local settings.json is now valid
- Global settings.json was already valid (no action needed)
- Validation infrastructure in place to prevent recurrence
- Pre-commit hook will catch any future issues
- Documentation created for team reference

## Next Steps

1. Commit these changes to prevent issue from returning
2. Run `npm run validate:claude` periodically
3. Refer to `.claude/HOOKS-README.md` for hook configuration guidance

---

**Issue Closed**: 2026-01-16
**Resolution**: Permanent fix with validation infrastructure
