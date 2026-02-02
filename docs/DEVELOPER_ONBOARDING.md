# SYNTHEX Developer Onboarding Guide

Welcome to the SYNTHEX development team! This guide will help you get up and running quickly.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Development Setup](#development-setup)
5. [Architecture Overview](#architecture-overview)
6. [Coding Standards](#coding-standards)
7. [Testing Guidelines](#testing-guidelines)
8. [Common Workflows](#common-workflows)
9. [Contribution Process](#contribution-process)
10. [Troubleshooting](#troubleshooting)
11. [Resources](#resources)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** v22.x ([Download](https://nodejs.org/))
- **npm** v10+ (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **VS Code** recommended ([Download](https://code.visualstudio.com/))
- **GitHub account** with repo access

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/CleanExpo/Synthex.git
cd Synthex

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values (see Environment Setup below)

# 4. Generate Prisma client
npx prisma generate

# 5. Start development server
npm run dev

# 6. Open in browser
# http://localhost:3000
```

### Environment Setup

Required environment variables (ask team lead for values):

```env
# Database
DATABASE_URL="your-database-url"
DIRECT_URL="your-direct-database-url"

# Authentication
JWT_SECRET="your-jwt-secret"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Services
OPENROUTER_API_KEY="your-openrouter-key"
ANTHROPIC_API_KEY="your-anthropic-key"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

---

## Project Structure

```
Synthex/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── api/               # API routes
│   │   ├── health/        # Health check endpoints
│   │   ├── ai/            # AI service endpoints
│   │   └── ...
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
│
├── components/            # React components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── forms/            # Form components
│   ├── dashboard/        # Dashboard-specific components
│   └── ...
│
├── lib/                   # Utility libraries
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # Authentication utilities
│   ├── redis-client.ts   # Redis/cache client
│   └── ...
│
├── src/                   # Source modules
│   ├── config/           # Configuration files
│   ├── middleware/       # Express/Next middleware
│   └── services/         # Business logic services
│
├── prisma/               # Database schema & migrations
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Migration files
│
├── scripts/              # Utility scripts
│   ├── db/              # Database scripts
│   └── data/            # Data management scripts
│
├── tests/                # Test files
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── e2e/             # End-to-end tests
│
├── docs/                 # Documentation
├── public/               # Static assets
└── ...
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| Next.js 14 | React framework | [Docs](https://nextjs.org/docs) |
| React 18 | UI library | [Docs](https://react.dev/) |
| TypeScript | Type safety | [Docs](https://www.typescriptlang.org/docs/) |
| Tailwind CSS | Styling | [Docs](https://tailwindcss.com/docs) |
| shadcn/ui | Component library | [Docs](https://ui.shadcn.com/) |
| Framer Motion | Animations | [Docs](https://www.framer.com/motion/) |
| React Three Fiber | 3D graphics | [Docs](https://docs.pmnd.rs/react-three-fiber) |

### Backend

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| Next.js API Routes | API endpoints | [Docs](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) |
| Prisma | ORM | [Docs](https://www.prisma.io/docs/) |
| PostgreSQL | Database | [Docs](https://www.postgresql.org/docs/) |
| Redis (Upstash) | Caching | [Docs](https://upstash.com/docs/redis/overall/getstarted) |
| NextAuth.js | Authentication | [Docs](https://next-auth.js.org/) |

### AI & External Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| OpenRouter | AI model routing | [Docs](https://openrouter.ai/docs) |
| Anthropic Claude | AI assistant | [Docs](https://docs.anthropic.com/) |
| Supabase | Auth & realtime | [Docs](https://supabase.com/docs) |
| Vercel | Deployment | [Docs](https://vercel.com/docs) |

### Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Jest | Unit testing |
| Playwright | E2E testing |
| Storybook | Component development |

---

## Development Setup

### VS Code Extensions

Recommended extensions (`.vscode/extensions.json`):

- **ES7+ React/Redux/React-Native snippets** - React snippets
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Prisma** - Schema highlighting
- **ESLint** - Linting integration
- **Prettier** - Code formatting
- **GitLens** - Git integration

### Local Services

For full local development:

```bash
# Start Supabase locally (optional)
supabase start

# Start Redis locally (optional)
docker run -d -p 6379:6379 redis:alpine
```

### Database Setup

```bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## Architecture Overview

### Request Flow

```
Browser → Vercel Edge → Next.js → API Routes → Services → Database
                                     ↓
                              Redis Cache
                                     ↓
                              AI Services
```

### Key Patterns

1. **Server Components by Default**
   - Use Server Components for data fetching
   - Client Components only when needed (interactivity)

2. **API Route Structure**
   ```
   app/api/[resource]/route.ts     → Collection operations (GET, POST)
   app/api/[resource]/[id]/route.ts → Item operations (GET, PUT, DELETE)
   ```

3. **Authentication**
   - NextAuth.js for session management
   - JWT tokens for API authentication
   - Middleware for protected routes

4. **Caching Strategy**
   - Redis for session/API response caching
   - Next.js ISR for static content
   - Memory fallback when Redis unavailable

5. **Error Handling**
   - Centralized error handling in API routes
   - Sentry for error tracking
   - Graceful degradation

---

## Coding Standards

### TypeScript

```typescript
// ✅ Use explicit types
interface User {
  id: string;
  email: string;
  name: string;
}

// ✅ Use type inference when obvious
const items = ['a', 'b', 'c']; // string[] inferred

// ❌ Avoid 'any'
const data: any = {}; // Bad
const data: unknown = {}; // Better
```

### React Components

```tsx
// ✅ Functional components with TypeScript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return (
    <button className={cn('btn', variant)} onClick={onClick}>
      {children}
    </button>
  );
}

// ✅ Use named exports
export { Button };

// ❌ Avoid default exports (harder to refactor)
export default Button;
```

### File Naming

```
components/
├── Button.tsx           # PascalCase for components
├── use-auth.ts          # kebab-case for hooks
├── auth-utils.ts        # kebab-case for utilities
└── types.ts             # lowercase for type files

app/api/
├── users/route.ts       # lowercase for routes
└── health/route.ts
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <description>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation
style:    Formatting (no code change)
refactor: Code restructuring
test:     Tests
chore:    Maintenance

# Examples
feat(auth): add OAuth login support
fix(api): handle null user in profile endpoint
docs(readme): update setup instructions
```

---

## Testing Guidelines

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Example unit test:

```typescript
// tests/unit/auth.test.ts
import { validateEmail } from '@/lib/auth';

describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### E2E Tests

```bash
# Run Playwright tests
npm run e2e

# Run with UI
npm run e2e:ui

# Run specific test
npx playwright test login.spec.ts
```

### Test Structure

```
tests/
├── unit/           # Unit tests (Jest)
│   ├── lib/       # Library tests
│   └── components/ # Component tests
├── integration/    # Integration tests
│   └── api/       # API route tests
└── e2e/           # End-to-end tests (Playwright)
    └── flows/     # User flow tests
```

---

## Common Workflows

### Creating a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Develop and test locally
npm run dev

# 3. Run quality checks
npm run type-check && npm run lint && npm test

# 4. Commit changes
git add .
git commit -m "feat(scope): description"

# 5. Push and create PR
git push -u origin feature/your-feature-name
# Create PR on GitHub
```

### Adding a New API Endpoint

1. Create route file: `app/api/[resource]/route.ts`
2. Add types: `types/[resource].ts`
3. Add service logic: `lib/services/[resource].ts`
4. Add tests: `tests/unit/[resource].test.ts`
5. Update API documentation

### Modifying the Database Schema

```bash
# 1. Edit prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name your-migration-name

# 3. Generate updated client
npx prisma generate

# 4. Update types if needed
```

### Running Storybook

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

---

## Contribution Process

### Branch Strategy

```
main          → Production-ready code
├── feature/* → New features
├── fix/*     → Bug fixes
└── hotfix/*  → Urgent production fixes
```

### Pull Request Process

1. **Create PR** with clear title and description
2. **Fill out PR template** (checklist, screenshots if UI)
3. **Request review** from at least one team member
4. **Address feedback** and resolve conversations
5. **Merge** after approval (squash preferred)

### Code Review Guidelines

When reviewing:
- Check for type safety
- Verify error handling
- Ensure tests are included
- Check for performance issues
- Validate security considerations

When being reviewed:
- Respond to all comments
- Explain your reasoning
- Be open to suggestions
- Request re-review after changes

---

## Troubleshooting

### Common Issues

#### "Module not found" Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npx prisma generate
```

#### Database Connection Issues

```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test connection
npx prisma db pull

# Check Supabase status
# https://status.supabase.com
```

#### TypeScript Errors

```bash
# Run type check to see all errors
npm run type-check

# Clear TypeScript cache
rm -rf .next
npm run dev
```

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

### Getting Help

1. **Check documentation** - This guide and `/docs` folder
2. **Search existing issues** - GitHub Issues
3. **Ask in Slack** - #dev-help channel
4. **Create issue** - For new bugs/questions

---

## Resources

### Internal Documentation

- [Production Deployment Runbook](./PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- [Database Migration Strategy](./DATABASE_MIGRATION_STRATEGY.md)
- [API Documentation](./API_DOCUMENTATION.md)

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

### Learning Resources

- [React Patterns](https://reactpatterns.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Next.js Learn Course](https://nextjs.org/learn)

---

## Checklist for Day 1

- [ ] Clone repository and install dependencies
- [ ] Set up environment variables
- [ ] Run development server successfully
- [ ] Explore project structure
- [ ] Run tests
- [ ] Open Prisma Studio and explore database
- [ ] Create a test branch and make a small change
- [ ] Review this documentation

## Questions?

Reach out to your team lead or post in #dev-help on Slack.

---

*Welcome to the team! 🚀*

*Last Updated: February 2026*
