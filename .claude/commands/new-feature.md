# New Feature Command

Scaffold a complete feature with all required files.

**Usage**: `/new-feature <name>`

Create a complete feature called '$ARGUMENTS':

## 1. API Routes

Create `src/app/api/$ARGUMENTS/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/server/errors';
import { $ARGUMENTSService } from '@/server/services';
import { $ARGUMENTSValidator } from '@/server/validators';

export async function GET(): Promise<NextResponse> {
  try {
    const result = await $ARGUMENTSService.list();
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const validated = $ARGUMENTSValidator.create.parse(body);
    const result = await $ARGUMENTSService.create(validated);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Create `src/app/api/$ARGUMENTS/[id]/route.ts` with GET, PUT, DELETE handlers.

## 2. Service

Create `src/server/services/$ARGUMENTS.service.ts`:

- `list()` - Return all items
- `getById(id)` - Return single item or throw NotFoundError
- `create(data)` - Create and return new item
- `update(id, data)` - Update and return item or throw NotFoundError
- `delete(id)` - Delete item or throw NotFoundError

The service should:
- Call the repository for data access
- Contain business logic
- Throw NotFoundError when item not found

## 3. Repository

Create `src/server/repositories/$ARGUMENTS.repository.ts`:

- `findAll()` - Query all from database
- `findById(id)` - Query by ID
- `create(data)` - Insert into database
- `update(id, data)` - Update in database
- `delete(id)` - Delete from database

Repository rules:
- Direct database calls only
- NO business logic
- Returns raw data or null

## 4. Validator

Create `src/server/validators/$ARGUMENTS.validator.ts`:

```typescript
import { z } from 'zod';

export const $ARGUMENTSValidator = {
  create: z.object({
    // Define create schema
  }),
  update: z.object({
    // Define update schema
  }),
  id: z.string().uuid(),
};

export type Create$ARGUMENTSInput = z.infer<typeof $ARGUMENTSValidator.create>;
export type Update$ARGUMENTSInput = z.infer<typeof $ARGUMENTSValidator.update>;
```

## 5. Types

Create `src/types/api/$ARGUMENTS.ts`:

- Import from `database.ts` if exists
- Define `$ARGUMENTS` interface
- Define `Create$ARGUMENTS` type
- Define `Update$ARGUMENTS` type

## 6. Component with ALL States

Create these files:

### `src/components/features/$ARGUMENTS/index.tsx`
```typescript
export { $ARGUMENTS } from './$ARGUMENTS';
export type { $ARGUMENTSProps } from './$ARGUMENTS.types';
```

### `src/components/features/$ARGUMENTS/$ARGUMENTS.tsx`
Main component with state handling

### `src/components/features/$ARGUMENTS/$ARGUMENTS.types.ts`
Props and type definitions

### `src/components/features/$ARGUMENTS/$ARGUMENTS.hooks.ts`
Custom hooks for data fetching

### `src/components/features/$ARGUMENTS/$ARGUMENTS.skeleton.tsx`
Loading skeleton state

### `src/components/features/$ARGUMENTS/$ARGUMENTS.error.tsx`
Error state component

### `src/components/features/$ARGUMENTS/$ARGUMENTS.empty.tsx`
Empty state component

## 7. Update Barrel Files

Add exports to:
- `src/server/services/index.ts`
- `src/server/repositories/index.ts`
- `src/server/validators/index.ts`
- `src/components/features/index.ts`

## 8. Verify

Run `npm run typecheck` to verify all types are correct.
