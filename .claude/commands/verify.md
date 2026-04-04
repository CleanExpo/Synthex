# Verify Command

Verify that the foundation architecture is intact.

## Checks to Perform

### 1. TypeScript Configuration

Verify `tsconfig.json` has ALL strict options enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 2. Directory Structure

Verify these directories exist:
- `src/server/services/`
- `src/server/repositories/`
- `src/server/validators/`
- `src/server/errors/`
- `src/components/ui/`
- `src/components/features/`
- `src/types/`
- `src/hooks/`
- `src/lib/`

### 3. Barrel Files

Verify `index.ts` exists in each module directory:
- `src/server/services/index.ts`
- `src/server/repositories/index.ts`
- `src/server/validators/index.ts`
- `src/components/ui/index.ts`
- `src/components/features/index.ts`
- `src/hooks/index.ts`
- `src/types/index.ts`

### 4. Error Handling

Verify `src/server/errors/index.ts` exists and exports:
- `AppError`
- `NotFoundError`
- `ValidationError`
- `UnauthorizedError`
- `ForbiddenError`
- `handleApiError`

### 5. Circular Dependencies

Run:
```bash
npx madge --circular --extensions ts,tsx src/
```

Report any circular dependencies found.

### 6. Type Check

Run:
```bash
npm run typecheck
```

Report any type errors.

## Report Format

```
Foundation Verification Report
==============================

TypeScript Config: [PASS/FAIL]
Directory Structure: [PASS/FAIL]
Barrel Files: [PASS/FAIL]
Error Handling: [PASS/FAIL]
Circular Dependencies: [PASS/FAIL]
Type Check: [PASS/FAIL]

Overall: [PASS/FAIL]

Issues Found:
- [List any issues]
```
