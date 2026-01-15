---
paths: supabase/**/*.sql
---

# Supabase Database Rules

## Database Configuration

- **Database**: PostgreSQL 15
- **Platform**: Supabase
- **Extensions**: pgvector, uuid-ossp
- **Security**: Row Level Security (RLS)

## Migration Patterns

### ✅ DO: Migration Structure

```sql
-- migrations/YYYYMMDDHHMMSS_feature_name.sql

-- =============================================================================
-- Migration: Feature Name
-- Description: What this migration does
-- =============================================================================

-- Create table
create table if not exists public.example (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    data jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.example enable row level security;

-- RLS Policies
create policy "Users can view own data"
    on public.example for select
    using (auth.uid() = user_id);

-- Indexes
create index if not exists example_user_id_idx on public.example(user_id);

-- Updated at trigger
create trigger example_updated_at
    before update on public.example
    for each row execute function public.handle_updated_at();
```

## RLS Patterns

```sql
-- User-owned data
create policy "Users own data"
    on public.user_data for all
    using (auth.uid() = user_id);

-- Service role bypass (for backend)
create policy "Service role access"
    on public.admin_data for all
    using (auth.role() = 'service_role');

-- Public read, auth write
create policy "Public read" on public.posts for select using (true);
create policy "Auth write" on public.posts for insert with check (auth.uid() is not null);
```

## Critical Rules

- **RLS Required**: Every table with user data needs RLS enabled
- **UUID Primary Keys**: Use `uuid default gen_random_uuid()` not serial
- **Foreign Key Constraints**: Always use `on delete cascade` for user-owned data
- **Indexes**: Add indexes for frequently queried columns
- **Migration Order**: Never modify applied migrations, use timestamp prefixes

## Anti-Patterns

❌ No RLS on user data, missing foreign keys, no indexes on query columns, using serial instead of uuid

## Key Commands

```bash
supabase start                    # Start local Supabase
supabase db push                  # Apply migrations
supabase db reset                 # Reset database (destructive)
supabase migration new <name>     # Create new migration
supabase gen types typescript --local > ../apps/web/types/database.ts  # Generate types
