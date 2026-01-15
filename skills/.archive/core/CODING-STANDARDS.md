---
name: coding-standards
version: 1.0.0
description: Code quality and style standards
author: Your Team
priority: 2
---

# Coding Standards

## General Principles

1. **Clarity over Cleverness**: Write code that's easy to understand
2. **Consistency**: Follow established patterns in the codebase
3. **Simplicity**: Don't over-engineer; solve the problem at hand
4. **Testability**: Write code that's easy to test

## TypeScript/JavaScript

### Naming Conventions
- `camelCase` for variables and functions
- `PascalCase` for classes and components
- `UPPER_SNAKE_CASE` for constants
- Use descriptive names: `getUserById` not `getUser`

### File Organization
```
components/
  ComponentName/
    index.ts          # Re-export
    ComponentName.tsx # Component
    ComponentName.test.tsx
    types.ts          # Component-specific types
```

### React Best Practices
```typescript
// Prefer functional components
export function UserCard({ user }: UserCardProps) {
  // Hooks at the top
  const [isOpen, setIsOpen] = useState(false);

  // Event handlers
  const handleClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Early returns for edge cases
  if (!user) return null;

  // Main render
  return <div>...</div>;
}
```

### Type Safety
- Always define prop types
- Avoid `any` - use `unknown` if necessary
- Use type guards for runtime type checking
- Prefer interfaces for object shapes

## Python

### Naming Conventions
- `snake_case` for variables and functions
- `PascalCase` for classes
- `UPPER_SNAKE_CASE` for constants
- Prefix private methods with `_`

### Type Hints
```python
def process_task(
    task_id: str,
    options: dict[str, Any] | None = None,
) -> TaskResult:
    """Process a task and return the result."""
    ...
```

### Error Handling
```python
# Be specific about exceptions
try:
    result = await risky_operation()
except ConnectionError as e:
    logger.error("Connection failed", error=str(e))
    raise ServiceUnavailable("Backend service unavailable")
except ValueError as e:
    raise ValidationError(str(e))
```

### Async Patterns
```python
# Use async/await consistently
async def fetch_all(ids: list[str]) -> list[Item]:
    tasks = [fetch_one(id) for id in ids]
    return await asyncio.gather(*tasks)
```

## Git Practices

### Commit Messages
```
type(scope): short description

Longer description if needed.

Closes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming
- `feature/short-description`
- `fix/issue-number-description`
- `refactor/component-name`

## Code Review Checklist

- [ ] Code follows naming conventions
- [ ] Types are properly defined
- [ ] Error handling is appropriate
- [ ] Tests are included
- [ ] No console.log or debug code
- [ ] No hardcoded secrets
- [ ] Comments explain "why" not "what"
