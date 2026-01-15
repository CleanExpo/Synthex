---
paths: apps/web/**/*.{ts,tsx}
---

# Next.js Frontend Rules

## Framework Configuration

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19, shadcn/ui (new-york style)
- **Styling**: Tailwind CSS v4, CSS Variables
- **State**: React hooks, Server Components

## Component Patterns

### ✅ DO: Component Structure

```tsx
export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, ...props }, ref) => {
    // Implementation
  }
);
Component.displayName = "Component";

export { Component, componentVariants };
```

### ✅ DO: Custom Hook Pattern

```tsx
export function useExample() {
  const [state, setState] = useState<ExampleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getData();
      setState(data);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, loading, error, fetchData };
}
```

## Design System Rules

- Use semantic colors: `bg-brand-primary` not `bg-blue-500`
- Use CVA variants for component variants
- Import with `@/` prefix: `import { Button } from "@/components/ui/button"`
- Server Components by default, add `"use client"` only when needed
- Every async component needs loading/error/empty states

## Anti-Patterns

❌ No explicit types, using `any`, inline styles, raw colors instead of design tokens

## Key Commands

```bash
pnpm dev --filter=web              # Development server
pnpm turbo run type-check --filter=web  # Type checking
pnpm turbo run lint --filter=web   # Linting
pnpm build --filter=web           # Build for production
