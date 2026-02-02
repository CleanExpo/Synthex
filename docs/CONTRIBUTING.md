# Contributing to SYNTHEX

Thank you for your interest in contributing to SYNTHEX! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help others learn and grow

---

## Getting Started

### Prerequisites

- Node.js 22.x
- npm 10+
- Git

### Setup

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Synthex.git
cd Synthex

# Add upstream remote
git remote add upstream https://github.com/CleanExpo/Synthex.git

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Start development
npm run dev
```

---

## Development Workflow

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 2. Make Changes

- Write code following [Coding Standards](#coding-standards)
- Add tests for new functionality
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run all checks
npm run type-check
npm run lint
npm test
npm run test:integration
```

### 4. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional message
git commit -m "feat(component): add new feature"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
# Create Pull Request on GitHub
```

---

## Coding Standards

### TypeScript

```typescript
// ✅ Use explicit types
function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Avoid `any`
function getUser(id: any): any {
  // ...
}
```

### React Components

```tsx
// ✅ Use functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ❌ Avoid class components
class Button extends React.Component { ... }
```

### File Organization

```
// ✅ One component per file
components/
  Button/
    Button.tsx
    Button.test.tsx
    index.ts

// ✅ Feature-based organization
features/
  campaigns/
    components/
    hooks/
    api/
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase with `use` | `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `UserData` |

### Import Order

```typescript
// 1. External libraries
import { useState } from 'react';
import { NextRequest } from 'next/server';

// 2. Internal aliases
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';

// 3. Relative imports
import { helper } from './helper';

// 4. Types (last)
import type { User } from '@/types';
```

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Build process, dependencies |

### Examples

```bash
# Feature
git commit -m "feat(auth): add Google OAuth support"

# Bug fix
git commit -m "fix(api): handle null response from external API"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Breaking change
git commit -m "feat(api)!: change response format for /users endpoint

BREAKING CHANGE: Response now returns { data: users } instead of users array"
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] Documentation updated if needed
- [ ] No console.log statements left
- [ ] No commented-out code
- [ ] Branch is up-to-date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested this

## Screenshots (if UI changes)

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Documentation updated
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by at least one maintainer
3. **Approval** before merge
4. **Squash and merge** to main

---

## Testing Requirements

### Unit Tests

- Test business logic in isolation
- Mock external dependencies
- Aim for >70% coverage

```typescript
describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Integration Tests

- Test API endpoints
- Use test database
- Clean up after tests

```typescript
describe('POST /api/users', () => {
  it('creates user', async () => {
    const response = await POST(createTestRequest('POST', '/api/users', {
      body: { email: 'test@example.com' },
    }));
    expect(response.status).toBe(201);
  });
});
```

### E2E Tests

- Test critical user flows
- Run against staging environment

```typescript
test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

---

## Documentation

### When to Update Docs

- New feature added
- API changed
- Configuration changed
- New dependency added

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `QUICK_START.md` | Quick setup guide |
| `DEVELOPER_ONBOARDING.md` | Full onboarding |
| `API_DOCUMENTATION.md` | API reference |
| `TROUBLESHOOTING.md` | Common issues |

### Documentation Style

- Use clear, simple language
- Include code examples
- Keep up-to-date with code changes
- Add screenshots for UI features

---

## Questions?

- Open an issue for discussion
- Review existing documentation
- Ask in team chat

Thank you for contributing! 🎉

---

*Last updated: 2026-02-02*
