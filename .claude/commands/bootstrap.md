---
description: Reference foundation setup for a NEW Synthex-style project (app/ + lib/ + Prisma + Supabase, npm). Synthex itself is already bootstrapped — run /verify here instead of /bootstrap.
allowed-tools: Read, Write, Edit, Bash
---

# Bootstrap Command

Foundation setup for a **new** Synthex-style project.

> ⚠️ **Synthex is already bootstrapped.** Do not run the scaffolding steps against
> this repo — they would create directories that conflict with the established
> structure. To check this repo's foundation, run `/verify` instead. Use the
> steps below only when standing up a fresh project on the same conventions.

> **Conventions:** App Router code at the repo root (`app/`, `components/`,
> `hooks/`, `lib/`) — no `src/` for app code. Package manager: **npm** (never
> pnpm). Database: **Prisma → Supabase**.

## 1. Create Directory Structure

```bash
mkdir -p app/api components/ui components/layout hooks lib/auth lib/api types prisma supabase/migrations .github/workflows
```

## 2. tsconfig.json path aliases

Match Synthex's root-based aliases (no `@/server/*`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"],
      "@/app/*": ["./app/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts", "next-env.d.ts"],
  "exclude": ["node_modules", ".next", "out", "dist"]
}
```

## 3. Install Dependencies (npm)

```bash
npm install next react react-dom zod @prisma/client @supabase/supabase-js
npm install -D typescript @types/node @types/react @types/react-dom eslint prettier prisma jest
```

## 4. Prisma + Supabase

```bash
npx prisma init
```

Point `DATABASE_URL` at Supabase. Define models in `prisma/schema.prisma`, then:

```bash
npx prisma validate
npx prisma generate
```

Apply migrations out of band via Supabase (`apply_migration`) — **never `prisma db push`**.

## 5. Typed route contract

Create `lib/api/define-route.ts` exporting `defineRoute` / `defineOrgRoute`
(auth + Zod validation + org-scope + `{ error, details? }` error shape baked in),
and `lib/auth/` for Supabase-only auth helpers
(`getUserIdFromRequestOrCookies`, `getEffectiveOrganizationId`).

## 6. package.json scripts

Mirror the Synthex gate:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "test": "jest",
    "db:validate": "npx prisma validate && npx prisma generate"
  }
}
```

## 7. CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test --if-present
      - run: npm run build
```

## 8. Verify Setup

```bash
npm run type-check && npm run lint && npm test
```

Report the real output (paste the `Tests:` line) or any issues found.
