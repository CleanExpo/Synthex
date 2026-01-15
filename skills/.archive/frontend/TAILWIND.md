---
name: tailwind
version: 1.0.0
description: Tailwind CSS v4 patterns and best practices
author: Your Team
priority: 3
triggers:
  - tailwind
  - css
  - styling
---

# Tailwind CSS v4 Patterns

## CSS-First Configuration

Tailwind v4 uses CSS for configuration:

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.7 0.15 250);
  --color-secondary: oklch(0.6 0.1 200);

  --font-display: "Inter", sans-serif;

  --radius-lg: 0.75rem;
  --radius-md: 0.5rem;
  --radius-sm: 0.25rem;
}
```

## Color System

### Using CSS Variables
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
  }
}
```

### In Components
```tsx
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
</div>
```

## Responsive Design

```tsx
<div className="
  grid
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  gap-4
">
  {items.map(item => (
    <Card key={item.id} />
  ))}
</div>
```

## Common Patterns

### Container
```tsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8">
  Content
</div>
```

### Flexbox Centering
```tsx
<div className="flex items-center justify-center min-h-screen">
  Centered content
</div>
```

### Card
```tsx
<div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
  Card content
</div>
```

### Button Variants
```tsx
// Primary
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
  Primary
</button>

// Outline
<button className="border border-input bg-background hover:bg-accent px-4 py-2 rounded-md">
  Outline
</button>

// Ghost
<button className="hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md">
  Ghost
</button>
```

## Using cn() Helper

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  className
)}>
```

## Animation Classes

```tsx
// Fade in
<div className="animate-in fade-in duration-300">

// Slide in
<div className="animate-in slide-in-from-bottom-4 duration-500">

// Spin
<div className="animate-spin">
```

## Dark Mode

```tsx
// Component that adapts to theme
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>

// Toggle implementation
<button onClick={() => document.documentElement.classList.toggle('dark')}>
  Toggle theme
</button>
```

## Best Practices

1. **Use semantic class groups**: Group related utilities
2. **Prefer CSS variables**: For theming and consistency
3. **Mobile-first**: Start with base styles, add responsive modifiers
4. **Extract components**: Don't repeat long class strings
5. **Use cn()**: For conditional classes

## Verification

- [ ] Styles render correctly
- [ ] Responsive breakpoints work
- [ ] Dark mode functions
- [ ] No unused custom classes
- [ ] Colors match design system
