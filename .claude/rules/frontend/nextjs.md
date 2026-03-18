---
paths: app/**/*.{ts,tsx}, components/**/*.{ts,tsx}
---

# Next.js Frontend Rules

## Framework

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19 + Radix UI primitives
- **Component library**: shadcn/ui components in `components/ui/`
- **Styling**: Tailwind CSS + CSS Variables
- **State**: React hooks + Server Components (no Redux/Zustand)
- **Package manager**: npm (not pnpm — use `npm run ...` for all commands)

## Component Patterns

### Server vs Client split

```tsx
// Default: Server Component (no directive needed)
export default function DashboardPage() {
  return <DashboardClient />;
}

// Only add 'use client' when you need: hooks, event handlers, browser APIs
'use client';
export function DashboardClient() { ... }
```

- Server Components by default — add `'use client'` only when genuinely needed
- Pass server-fetched data as props into client subtrees
- Every async component needs loading/error/empty states

### Component structure

```tsx
export interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  loading?: boolean;
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('...', className)} {...props} />;
  }
);
Component.displayName = 'Component';

export { Component };
```

## Design System Rules

- Import components with `@/` alias: `import { Button } from "@/components/ui/button"`
- Use Tailwind utilities directly — no inline styles
- Use design tokens (`text-cyan-400`, `bg-surface-dark`) over raw colours

## Key Commands

```bash
npm run dev              # Start dev server (Turbopack, port 3000)
npm run type-check       # TypeScript check
npm run lint             # ESLint
npm run build            # Production build
```

## Anti-Patterns

- ❌ `any` types — use proper TypeScript
- ❌ Inline styles (`style={{...}}`) — use Tailwind
- ❌ Raw `fetch()` in client components — use SWR (see CLAUDE.md data fetching rules)
- ❌ `'use client'` without a reason — check if Server Component works first
