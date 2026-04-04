# Audit Command

Perform a full architecture audit of the codebase.

## Audit Categories

### 1. LAYER VIOLATIONS (Critical)

Check for improper imports between layers:

- **Components importing from server/**: Components should NEVER import from `src/server/`
- **API routes importing from repositories/**: API routes must use services, not repositories directly
- **Repositories importing from services/**: Repositories should be independent of services

Search patterns:
```
src/components/**/*.{ts,tsx} -> import from '@/server/'
src/app/api/**/*.ts -> import from '@/server/repositories'
src/server/repositories/**/*.ts -> import from '@/server/services'
```

### 2. TYPE ISSUES (High)

- **Any type usage**: Search for `: any` or `as any`
- **Type assertions without validation**: Search for `as SomeType` without preceding validation
- **Missing return types**: Functions without explicit return types
- **Manual database types**: Types in `src/types/` that should be generated from Supabase

### 3. ASYNC ISSUES (High)

- **Unhandled promises**: Promises without `await` or `.catch()`
- **Async without await**: `async` functions that never use `await`

### 4. ERROR HANDLING (High)

- **Empty catch blocks**: `catch (e) {}` or `catch { }`
- **API routes without try/catch**: Route handlers missing error boundaries
- **Missing handleApiError**: API routes not using the standardized error handler

### 5. COMPONENT ISSUES (Medium)

For each component in `src/components/features/`:
- **Missing loading state**: No skeleton or loading indicator
- **Missing error state**: No error boundary or error display
- **Missing empty state**: No empty state handling

### 6. VALIDATION ISSUES (Medium)

- **API routes not validating input**: POST/PUT/PATCH handlers not using Zod
- **Missing validator files**: Features without corresponding validators

## Report Format

```
Architecture Audit Report
=========================

CRITICAL ISSUES:
- [Layer violations with file locations]

HIGH PRIORITY:
- [Type issues with file locations]
- [Async issues with file locations]
- [Error handling issues with file locations]

MEDIUM PRIORITY:
- [Component state issues]
- [Validation issues]

Summary:
- Critical: X issues
- High: X issues
- Medium: X issues
- Total: X issues
```

## Remediation

For each issue found, provide:
1. File path and line number
2. Description of the problem
3. Suggested fix
