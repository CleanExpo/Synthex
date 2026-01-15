# Development Workflow Rules

## Project Commands

```bash
# Development
pnpm dev                          # All services
pnpm dev --filter=web             # Frontend only
cd apps/backend && uv run uvicorn src.api.main:app --reload  # Backend only

# Database
supabase start                    # Start local Supabase
supabase db push                  # Apply migrations
supabase db reset                 # Reset database (destructive)

# Testing
pnpm turbo run test               # All tests
pnpm test --filter=web            # Frontend unit tests
cd apps/backend && uv run pytest  # Backend unit tests

# Quality Checks
pnpm turbo run type-check lint    # All checks
.\scripts\health-check.ps1        # Comprehensive system health check
```

## Conventions

### Naming
- React: `PascalCase.tsx`
- Utils: `kebab-case.ts`
- Python: `snake_case.py`
- Skills: `SCREAMING-KEBAB.md`

### Commits
```bash
# Format: <type>(<scope>): <description>
feat(web): add dark mode toggle
fix(backend): resolve agent timeout
docs(skills): update orchestrator guide
```

### Branching
- `main` - Production ready
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes

## Pre-PR Checklist

```bash
# Single command - all checks
pnpm turbo run type-check lint test && echo "✅ Ready for PR"
```

## Architecture Layers

```
Frontend: Components → Hooks → API Routes → Services
Backend:  API → Agents → Tools → Graphs → State
Database: Tables → RLS → Functions → Triggers
```

**Rule**: No cross-layer imports. Each layer only imports from the layer directly below.
