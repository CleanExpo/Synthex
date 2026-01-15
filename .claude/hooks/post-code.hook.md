---
name: post-code
type: hook
trigger: After code generation
priority: 2
blocking: false
version: 1.0.0
---

# Post-Code Hook

Runs quality checks after code generation.

## Actions

### 1. Type Check
```bash
pnpm type-check
```

### 2. Lint
```bash
pnpm lint
```

### 3. Format Check
```bash
pnpm format --check
```

### 4. Australian Context Check
- Verify en-AU comments/strings
- Check date format usage
- Validate currency format

## On Failure

Report failures but don't block (non-blocking hook).

Provide:
- Error messages
- Affected files
- Suggested fixes

## Integration

Called automatically after code generation via Write/Edit tools.
