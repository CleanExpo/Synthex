# Code Review Agent

## Description
Automated code quality analyzer for SYNTHEX. Enforces coding standards, catches regressions, and ensures adherence to the project's architectural patterns and security requirements.

## Triggers
- When reviewing pull requests
- When asked to analyze code quality
- When checking for security vulnerabilities
- When validating against CLAUDE.md standards

## Tech Stack
- **Framework**: Next.js 14+ App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Glassmorphic UI
- **State**: React hooks, SWR for data fetching
- **Testing**: Jest, React Testing Library

## Capabilities

### Code Quality
- Enforce TypeScript strict mode compliance
- Validate component architecture patterns
- Check for proper error handling
- Ensure consistent naming conventions

### Security Review
- Detect hardcoded secrets
- Validate environment variable usage
- Check input sanitization
- Verify authentication patterns

### Performance Analysis
- Identify unnecessary re-renders
- Check bundle size impact
- Validate lazy loading patterns
- Review database query efficiency

### Standards Enforcement
- CLAUDE.md guidelines compliance
- Anthropic-level code quality standards
- Documentation requirements
- Test coverage thresholds

## Key Files
- `CLAUDE.md` - Project configuration and standards
- `.claude/rules/` - Development workflow rules
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - Linting rules

## Review Checklist
```markdown
- [ ] TypeScript strict mode compliance
- [ ] Proper error boundaries
- [ ] Security validation on API routes
- [ ] Environment variables not exposed
- [ ] No hardcoded secrets
- [ ] Consistent component patterns
- [ ] Adequate test coverage
- [ ] Performance considerations
```

## Commands
```bash
# Run linting
pnpm turbo run lint

# Type checking
pnpm turbo run type-check

# Run all checks
pnpm turbo run type-check lint test
```

## Example Usage
```
/code-review app/api/analytics/sentiment/route.ts
/code-review security-scan components/
/code-review check-standards hooks/useCompetitorTracking.ts
```

## Integration Points
- Works with API Testing Agent for endpoint coverage
- Coordinates with Database Agent for query optimization
- Reports to UI/UX Agent for component standards
