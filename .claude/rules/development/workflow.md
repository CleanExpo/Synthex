# Development Workflow Rules

## Project Commands

```bash
# Development
npm run dev                       # Start dev server (Turbo)
npm run dev:next                  # Next.js dev directly
npm run dev:full                  # Dev + WebSocket server

# Database
npx prisma db push                # Push schema to database
npm run db:migrate:dev            # Create development migration
npm run db:studio                 # Prisma Studio GUI

# Testing
npm test                          # Jest unit tests
npm run e2e                       # Playwright E2E tests

# Quality Checks
npm run type-check && npm run lint  # All checks
npm run release:check               # Full pre-release validation
```

## Conventions

### Naming
- React: `PascalCase.tsx`
- Utils: `kebab-case.ts`
- Skills: `SCREAMING-KEBAB.md`

### Commits
```bash
# Format: <type>(<scope>): <description>
feat(dashboard): add dark mode toggle
fix(api): resolve auth timeout
docs(planning): update roadmap
```

### Branching
- `main` - Production ready
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes

## Pre-PR Checklist

```bash
# Single command - all checks
npm run type-check && npm run lint && npm test && echo "Ready for PR"
```

## Architecture Layers

```
Pages:    app/ → Components → Hooks → lib/ services
API:      app/api/ → lib/ services → Prisma → Database
Database: Prisma schema → Migrations → Supabase PostgreSQL
```

**Rule**: No cross-layer imports. Each layer only imports from the layer directly below.
