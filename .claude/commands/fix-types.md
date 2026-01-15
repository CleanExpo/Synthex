# Fix Types Command

Regenerate database types from Supabase.

## Steps

### 1. Generate Types from Supabase

Run:
```bash
supabase gen types typescript --local > src/types/database.ts
```

This will:
- Connect to your local Supabase instance
- Introspect the database schema
- Generate TypeScript types for all tables
- Output to `src/types/database.ts`

### 2. Verify Types

Run:
```bash
npm run typecheck
```

### 3. Update Imports

If new tables were added, update any services/repositories that need the new types:

```typescript
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type YourTable = Tables['your_table']['Row'];
type YourTableInsert = Tables['your_table']['Insert'];
type YourTableUpdate = Tables['your_table']['Update'];
```

## Common Issues

### Supabase Not Running

If you get a connection error:
```bash
supabase start
```

### Missing Tables

If generated types are missing tables:
1. Check your migrations are applied: `supabase db reset`
2. Verify table exists: `supabase db lint`

### Type Conflicts

If new types conflict with existing manual types:
1. Remove manual type definitions
2. Import from `database.ts` instead
3. Create derived types if needed:

```typescript
import type { Database } from '@/types/database';

// Use the generated type directly
type User = Database['public']['Tables']['users']['Row'];

// Or create a derived type with modifications
type UserWithPosts = User & {
  posts: Post[];
};
```

## Report

After completion, report:
- Number of tables typed
- Any type errors found
- Files that may need import updates
