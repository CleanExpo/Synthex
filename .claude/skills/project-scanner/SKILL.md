---
name: project-scanner
description: >
  Codebase analysis, dependency auditing, and architecture mapping for the
  Synthex platform. Scans file structure, dependency health, TypeScript
  errors, unused exports, security vulnerabilities, and documentation gaps.
  Use when user says "scan project", "audit dependencies", "check codebase",
  "architecture map", "security scan", or "code health".
---

# Project Scanner & Codebase Auditor

## Process

1. **Map file structure** -- traverse the Synthex codebase and catalog directories, files, and module boundaries
2. **Audit dependencies** -- analyze package.json for outdated, deprecated, or vulnerable packages
3. **Check TypeScript** -- run the TypeScript compiler in check mode to surface type errors
4. **Detect unused exports** -- identify exported symbols that have no internal consumers
5. **Scan for vulnerabilities** -- check for known CVEs in dependencies and insecure code patterns
6. **Assess architecture** -- verify module boundaries, circular dependencies, and layer violations
7. **Identify documentation gaps** -- flag undocumented APIs, missing JSDoc, and incomplete README sections
8. **Generate report** -- compile findings into a prioritized action plan

## Stack Reference

| Layer | Technology |
|-------|------------|
| Runtime | Node.js with Express |
| Language | TypeScript |
| ORM | Prisma (PostgreSQL) |
| Deployment | Vercel |
| Auth | JWT sessions + Google OAuth |
| AI Integration | Anthropic Claude, OpenRouter |

## Prisma Models
- User, Campaign, Post, Project, ApiUsage, Session
- Schema location: `Synthex/prisma/schema.prisma`

## Scan Categories

### 1. File Structure Analysis
- Total file/directory count by type (.ts, .tsx, .json, .md, .prisma)
- Module boundary identification (routes, controllers, services, models, utils)
- Configuration file inventory (.env variants, tsconfig, package.json)
- Untracked or orphaned files (files not imported anywhere)

### 2. Dependency Audit
```bash
npm audit                    # Known vulnerabilities
npm outdated                 # Version drift
npx depcheck                 # Unused dependencies
```
- Flag: critical/high CVEs requiring immediate action
- Flag: major version drift (>2 major versions behind)
- Flag: unused dependencies inflating bundle size
- Flag: missing peer dependencies

### 3. TypeScript Health
```bash
npx tsc --noEmit             # Type checking without output
```
- Count and categorize errors: type mismatches, missing types, implicit any
- Identify strictness gaps (files with `@ts-ignore` or `@ts-expect-error`)
- Check tsconfig.json for recommended strict settings
- Surface any `any` type usage that should be narrowed

### 4. Unused Export Detection
- Scan all `export` statements across the codebase
- Cross-reference with `import` statements to find unused exports
- Exclude entry points (route handlers, Prisma schema, config exports)
- Flag dead code candidates for removal

### 5. Security Scan
- **Dependencies**: `npm audit` for known CVEs
- **Secrets**: scan for hardcoded API keys, tokens, or credentials in source files
- **Environment**: verify `.env` files are in `.gitignore`
- **Auth patterns**: check JWT expiration, password hashing, session management
- **Input validation**: identify unvalidated user inputs in route handlers
- **SQL injection**: verify Prisma parameterized queries (no raw SQL with interpolation)

### 6. Architecture Assessment
- **Circular dependencies**: detect import cycles between modules
- **Layer violations**: ensure routes do not directly access Prisma (should go through services)
- **Separation of concerns**: verify controller/service/model boundaries
- **API consistency**: check route naming conventions and HTTP method usage
- **Error handling**: verify consistent error response format across endpoints

### 7. Documentation Gaps
- Missing or incomplete JSDoc on exported functions
- API endpoints without OpenAPI/Swagger documentation
- Prisma models without field-level comments
- Missing SKILL.md files for skill directories
- Outdated architecture documentation

## Output

### Health Score: XX/100

| Category | Score | Weight |
|----------|-------|--------|
| Dependency Health | XX/100 | 20% |
| TypeScript Strictness | XX/100 | 20% |
| Security Posture | XX/100 | 25% |
| Architecture Quality | XX/100 | 20% |
| Documentation Coverage | XX/100 | 15% |

### Issues Found

Categorized by severity:
- **Critical**: security vulnerabilities, exposed secrets, broken builds
- **High**: type errors, outdated critical dependencies, circular dependencies
- **Medium**: unused exports, missing documentation, inconsistent patterns
- **Low**: style inconsistencies, minor version drift, optional improvements

### Action Plan
- Prioritized list of fixes ordered by severity and effort
- Estimated effort per fix (quick fix, moderate, significant refactor)
- Grouped by category for batch resolution

## References

- Prisma schema: `Synthex/prisma/schema.prisma`
- Package manifest: `Synthex/package.json`
- TypeScript config: `Synthex/tsconfig.json`
- Environment config: `.env*` files (never commit, verify in .gitignore)
- Skill directories: `.claude/skills/`
