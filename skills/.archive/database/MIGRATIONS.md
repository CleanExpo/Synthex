---
name: migrations
version: 1.0.0
description: Database migration patterns
author: Your Team
priority: 3
triggers:
  - migration
  - schema
  - sql
---

# Database Migration Patterns

## Migration Structure

```
supabase/
  migrations/
    00000000000000_init.sql
    00000000000001_auth_schema.sql
    00000000000002_enable_pgvector.sql
    00000000000003_state_tables.sql
  seed.sql
  config.toml
```

## Creating Migrations

```bash
# Create a new migration
supabase migration new create_users_table

# This creates: supabase/migrations/[timestamp]_create_users_table.sql
```

## Migration Best Practices

### 1. Always Include Rollback
```sql
-- Up
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down (in comments or separate file)
-- DROP TABLE users;
```

### 2. Make Migrations Atomic
```sql
BEGIN;

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts(user_id);

COMMIT;
```

### 3. Handle Existing Data
```sql
-- Add column with default
ALTER TABLE users
ADD COLUMN status TEXT DEFAULT 'active';

-- Update existing rows
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Now make it NOT NULL
ALTER TABLE users
ALTER COLUMN status SET NOT NULL;
```

## Common Patterns

### Create Table with RLS
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own conversations"
ON conversations FOR ALL
USING (auth.uid() = user_id);
```

### Add Foreign Key
```sql
ALTER TABLE posts
ADD COLUMN category_id UUID REFERENCES categories(id);

CREATE INDEX idx_posts_category_id ON posts(category_id);
```

### Create Junction Table
```sql
CREATE TABLE post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

### Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE documents
ADD COLUMN embedding vector(1536);

CREATE INDEX idx_documents_embedding
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Create Function
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

## Running Migrations

```bash
# Apply all pending migrations
supabase db push

# Reset database and apply all migrations
supabase db reset

# Generate types from schema
supabase gen types typescript --local > types/supabase.ts
```

## Seeding Data

```sql
-- supabase/seed.sql
INSERT INTO categories (id, name) VALUES
  ('cat-1', 'Technology'),
  ('cat-2', 'Science'),
  ('cat-3', 'Art');

INSERT INTO settings (key, value) VALUES
  ('app_name', 'My App'),
  ('max_posts_per_user', '100');
```

## Verification

- [ ] Migration runs without errors
- [ ] Rollback works correctly
- [ ] RLS policies are correct
- [ ] Indexes created for foreign keys
- [ ] Triggers work as expected
