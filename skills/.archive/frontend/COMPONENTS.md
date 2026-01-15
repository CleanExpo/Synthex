---
name: components
version: 1.0.0
description: Component patterns with shadcn/ui
author: Your Team
priority: 3
triggers:
  - component
  - ui
  - shadcn
---

# Component Patterns

## shadcn/ui Setup

The project uses shadcn/ui with the "new-york" style. Components are in `components/ui/`.

### Installing New Components
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

## Component Structure

```
components/
  ui/                 # shadcn/ui components
    button.tsx
    card.tsx
    ...
  auth/               # Feature-specific components
    login-form.tsx
    register-form.tsx
  chat/
    chat-interface.tsx
    message-list.tsx
  layout/
    header.tsx
    sidebar.tsx
```

## Component Patterns

### Basic Component
```typescript
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function FeatureCard({
  title,
  description,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn("rounded-lg border p-6", className)}
      {...props}
    >
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}
```

### Compound Components
```typescript
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children
}: {
  defaultValue: string;
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

Tabs.List = function TabsList({ children }) {
  return <div className="flex gap-2">{children}</div>;
};

Tabs.Trigger = function TabsTrigger({ value, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext)!;
  return (
    <button
      className={cn(activeTab === value && "bg-primary")}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
};

Tabs.Content = function TabsContent({ value, children }) {
  const { activeTab } = useContext(TabsContext)!;
  if (activeTab !== value) return null;
  return <div>{children}</div>;
};
```

### Form Components
```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    // Handle submit
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

## Accessibility

- Use semantic HTML elements
- Include aria labels where needed
- Ensure keyboard navigation works
- Test with screen readers
- Maintain focus management

```typescript
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

## State Management

### Local State
```typescript
const [isOpen, setIsOpen] = useState(false);
```

### Context for Shared State
```typescript
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Verification

- [ ] Component renders without errors
- [ ] Props are typed correctly
- [ ] Styling works as expected
- [ ] Component is accessible
- [ ] Edge cases handled (empty state, loading, error)
