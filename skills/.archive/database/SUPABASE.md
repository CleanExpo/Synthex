---
name: supabase
version: 1.0.0
priority: 3
triggers:
  - supabase
  - database
  - auth
---

# Supabase Patterns

## Client Setup

```typescript
// Browser: createBrowserClient(SUPABASE_URL, ANON_KEY)
// Server: createServerClient(URL, KEY, { cookies: { getAll, setAll } })
```

## Auth

```typescript
supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.getUser()
supabase.auth.signOut()
```

## Queries

```typescript
// Select with relations
supabase.from('posts').select('id, title, author:users(name)').eq('status', 'active').limit(10)

// Insert
supabase.from('posts').insert({ title, user_id }).select().single()

// Update
supabase.from('posts').update({ title }).eq('id', postId).select().single()

// Delete
supabase.from('posts').delete().eq('id', postId)
```

## RLS Policies

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON posts FOR SELECT USING (true);
CREATE POLICY "insert_own" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON posts FOR DELETE USING (auth.uid() = user_id);
```

## Realtime & Storage

```typescript
// Realtime
supabase.channel('posts').on('postgres_changes', { event: '*', table: 'posts' }, handler).subscribe()

// Storage
supabase.storage.from('avatars').upload(path, file)
supabase.storage.from('avatars').getPublicUrl(path)
```

See: `lib/supabase/`, `supabase/migrations/`
