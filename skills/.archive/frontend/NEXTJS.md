---
name: nextjs
version: 1.0.0
description: Next.js 15 patterns and best practices
author: Your Team
priority: 3
triggers:
  - frontend
  - nextjs
  - react
  - page
---

# Next.js 15 Patterns

## App Router Structure

```
app/
  (auth)/           # Route group for auth pages
    login/
      page.tsx
    register/
      page.tsx
    layout.tsx      # Shared auth layout
  (dashboard)/      # Route group for dashboard
    dashboard/
      page.tsx
    settings/
      page.tsx
    layout.tsx      # Dashboard layout with sidebar
  api/
    route.ts        # API routes
  layout.tsx        # Root layout
  page.tsx          # Home page
```

## Server Components (Default)

```typescript
// app/users/page.tsx - Server Component
import { getUsers } from '@/lib/api';

export default async function UsersPage() {
  const users = await getUsers(); // Direct data fetching

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Client Components

```typescript
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

## Data Fetching

### Server-Side
```typescript
// In Server Components
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 } // Revalidate every hour
  });
  return res.json();
}
```

### Client-Side with SWR
```typescript
'use client';

import useSWR from 'swr';

export function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher
  );

  if (isLoading) return <Skeleton />;
  if (error) return <Error />;
  return <Profile user={data} />;
}
```

## Route Handlers

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  const users = await getUsers(query);

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate
  if (!body.email) {
    return NextResponse.json(
      { error: 'Email required' },
      { status: 400 }
    );
  }

  const user = await createUser(body);
  return NextResponse.json(user, { status: 201 });
}
```

## Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check auth
  const token = request.cookies.get('token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

## Loading & Error States

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />;
}

// app/dashboard/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Metadata

```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
  description: 'My application description',
};
```

## Verification

- [ ] `pnpm build` passes without errors
- [ ] No hydration mismatches
- [ ] Correct use of 'use client'
- [ ] Data fetching works correctly
- [ ] Loading states implemented
- [ ] Error boundaries in place
