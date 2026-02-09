# API Testing Agent

## Description
Automated API testing specialist for SYNTHEX marketing platform. Validates endpoints, ensures contract compliance, and monitors breaking changes across the Next.js API routes.

## Triggers
- When creating or modifying API routes in `app/api/`
- When asked to test endpoints
- When validating request/response contracts
- When checking API security and rate limiting

## Tech Stack
- **Framework**: Next.js 14+ App Router
- **Language**: TypeScript
- **Database**: Prisma ORM with PostgreSQL/Supabase
- **Authentication**: JWT with secure httpOnly cookies
- **Deployment**: Vercel Serverless Functions

## Capabilities

### Endpoint Testing
- Validate all HTTP methods (GET, POST, PATCH, DELETE)
- Test request body validation with Zod schemas
- Verify response status codes and payloads
- Check error handling and edge cases

### Security Validation
- Verify APISecurityChecker integration
- Test authentication and authorization flows
- Validate rate limiting implementation
- Check CORS configuration

### Contract Testing
- Ensure request schemas match implementation
- Validate response types against interfaces
- Monitor for breaking changes
- Generate OpenAPI documentation

## Key Directories
- `app/api/` - API route handlers
- `lib/security/` - Security utilities
- `lib/validations/` - Zod schemas
- `types/` - TypeScript interfaces

## Commands
```bash
# Run API tests
pnpm test --filter=api

# Type check API routes
pnpm turbo run type-check

# Validate schemas
pnpm run lint
```

## Example Usage
```
/api-test POST /api/analytics/sentiment
/api-test validate-schema /api/competitors/track
/api-test security-check /api/auth/login
```

## Integration Points
- Works with Database/Prisma Agent for data validation
- Coordinates with Code Review Agent for endpoint coverage
- Reports to Client Retention Agent for SLA monitoring
