# SYNTHEX Troubleshooting Guide

> Solutions to common issues and debugging tips

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Database Issues](#database-issues)
3. [Build Issues](#build-issues)
4. [Runtime Errors](#runtime-errors)
5. [Authentication Issues](#authentication-issues)
6. [API Issues](#api-issues)
7. [Performance Issues](#performance-issues)
8. [Deployment Issues](#deployment-issues)
9. [Debugging Tools](#debugging-tools)

---

## Installation Issues

### `npm install` fails with peer dependency errors

**Solution:**
```bash
# Use legacy peer deps
npm install --legacy-peer-deps

# Or clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### `prisma generate` fails

**Error:** `Environment variable not found: DATABASE_URL`

**Solution:**
```bash
# Ensure .env.local exists and has DATABASE_URL
cp .env.example .env.local
# Edit .env.local with your database URL

# Then run
npx prisma generate
```

### Node.js version mismatch

**Error:** `The engine "node" is incompatible with this module`

**Solution:**
```bash
# Check version
node -v

# Install Node.js 22.x
# Using nvm:
nvm install 22
nvm use 22
```

---

## Database Issues

### Cannot connect to database

**Error:** `Can't reach database server`

**Solutions:**

1. **Check DATABASE_URL format:**
   ```
   postgresql://user:password@host:port/database
   ```

2. **For Supabase:**
   - Use port `6543` for pooled connections (PgBouncer)
   - Use port `5432` for direct connections
   ```
   DATABASE_URL=postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://...@db.xxx.supabase.co:5432/postgres
   ```

3. **Check network access:**
   - Verify IP is whitelisted in database settings
   - Check firewall rules

### Prisma migration fails

**Error:** `Migration failed to apply`

**Solution:**
```bash
# Check migration status
node scripts/db/migrate.js status --verbose

# Reset to clean state (CAUTION: destroys data)
npx prisma migrate reset

# Or apply pending migrations
npx prisma migrate deploy
```

### Connection pool exhausted

**Error:** `PrismaClientKnownRequestError: Pool timeout`

**Solution:**
```bash
# Increase pool size in DATABASE_URL
?connection_limit=20&pool_timeout=20

# Or set env variables
DATABASE_POOL_SIZE=20
DATABASE_POOL_TIMEOUT=20
```

---

## Build Issues

### TypeScript errors during build

**Error:** `Type error: Cannot find module`

**Solutions:**

1. **Regenerate types:**
   ```bash
   npx prisma generate
   npm run type-check
   ```

2. **Clear cache:**
   ```bash
   npm run clean:cache
   rm -rf .next
   npm run build
   ```

3. **Check tsconfig.json paths:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

### Build timeout on Vercel

**Error:** Build exceeds time limit

**Solutions:**

1. **Optimize build:**
   ```bash
   # Add to vercel.json
   {
     "buildCommand": "prisma generate && next build"
   }
   ```

2. **Exclude unnecessary files:**
   ```json
   // .vercelignore
   tests/
   docs/
   *.test.ts
   ```

3. **Check for circular imports:**
   ```bash
   npm run build 2>&1 | grep -i circular
   ```

### ESLint errors blocking build

**Solution:**
```bash
# Fix auto-fixable issues
npm run lint -- --fix

# Or temporarily skip lint
ESLINT_NO_DEV_ERRORS=true npm run build
```

---

## Runtime Errors

### `NEXT_PUBLIC_*` undefined in client

**Cause:** Environment variable not prefixed with `NEXT_PUBLIC_`

**Solution:**
```bash
# For client-side access, use NEXT_PUBLIC_ prefix
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Server-only variables (no prefix needed)
DATABASE_URL=...
```

### Hydration mismatch error

**Error:** `Text content does not match server-rendered HTML`

**Solutions:**

1. **Wrap dynamic content:**
   ```tsx
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return null;
   ```

2. **Use `suppressHydrationWarning`:**
   ```tsx
   <time suppressHydrationWarning>{new Date().toLocaleString()}</time>
   ```

### Memory leak in development

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev

# Or in package.json
"dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev"
```

---

## Authentication Issues

### NextAuth session not persisting

**Solutions:**

1. **Check NEXTAUTH_SECRET:**
   ```bash
   # Generate new secret
   openssl rand -base64 32
   ```

2. **Check NEXTAUTH_URL:**
   ```
   NEXTAUTH_URL=http://localhost:3000  # Development
   NEXTAUTH_URL=https://your-domain.com  # Production
   ```

3. **Verify cookies:**
   - Open DevTools > Application > Cookies
   - Check for `next-auth.session-token`

### OAuth callback error

**Error:** `OAuthAccountNotLinked`

**Solution:**
- User trying to sign in with different provider for same email
- Implement account linking or use same provider consistently

### JWT token expired

**Error:** `TokenExpiredError`

**Solution:**
```typescript
// Increase token expiry in auth config
jwt: {
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

---

## API Issues

### 429 Too Many Requests

**Cause:** Rate limit exceeded

**Solution:**
```bash
# Check rate limit headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-02-02T12:00:00Z

# Wait until reset time, or adjust rate limits
```

### CORS errors

**Error:** `Access-Control-Allow-Origin`

**Solution:**
```typescript
// In API route
return NextResponse.json(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  },
});
```

### API returns 500

**Debug steps:**

1. **Check server logs:**
   ```bash
   npm run dev
   # Watch terminal for errors
   ```

2. **Check API route:**
   ```typescript
   try {
     // Your code
   } catch (error) {
     console.error('API Error:', error);
     return NextResponse.json({ error: error.message }, { status: 500 });
   }
   ```

3. **Test with curl:**
   ```bash
   curl -v http://localhost:3000/api/endpoint
   ```

---

## Performance Issues

### Slow page loads

**Debug steps:**

1. **Check metrics:**
   ```bash
   curl http://localhost:3000/api/performance/metrics
   ```

2. **Analyze bundle:**
   ```bash
   npm run analyze
   ```

3. **Check for N+1 queries:**
   ```typescript
   // Enable query logging
   PRISMA_LOG_QUERIES=true npm run dev
   ```

### High memory usage

**Solutions:**

1. **Check for memory leaks:**
   ```bash
   node --inspect npm run dev
   # Open chrome://inspect
   ```

2. **Optimize queries:**
   ```typescript
   // Use pagination
   const users = await prisma.user.findMany({
     take: 20,
     skip: offset,
   });
   ```

### Database queries slow

**Solutions:**

1. **Add indexes:**
   ```prisma
   model User {
     email String @unique
     @@index([createdAt])
   }
   ```

2. **Use query batching:**
   ```typescript
   import { createLoader } from '@/lib/scalability';
   ```

---

## Deployment Issues

### Vercel deployment fails

**Debug steps:**

1. **Check build logs in Vercel dashboard**

2. **Test build locally:**
   ```bash
   npm run build
   ```

3. **Check environment variables in Vercel**

4. **Verify Prisma schema:**
   ```bash
   npx prisma validate
   ```

### Environment variables not working in production

**Solutions:**

1. **Add to Vercel dashboard:**
   - Settings > Environment Variables
   - Add for Production/Preview/Development

2. **Redeploy after adding:**
   ```bash
   vercel --prod
   ```

### Static generation errors

**Error:** `Error occurred prerendering page`

**Solution:**
```typescript
// Mark page as dynamic
export const dynamic = 'force-dynamic';

// Or use generateStaticParams
export async function generateStaticParams() {
  return [];
}
```

---

## Debugging Tools

### Enable debug logging

```bash
# Prisma queries
DEBUG=prisma:query npm run dev

# All debug logs
DEBUG=* npm run dev
```

### Check health status

```bash
# Liveness check
curl http://localhost:3000/api/health/live

# Readiness check
curl http://localhost:3000/api/health/ready

# Full health status
curl http://localhost:3000/api/health
```

### Database diagnostics

```bash
# Check integrity
node scripts/data/data-integrity-check.js --verbose

# Migration status
node scripts/db/migrate.js status
```

### Performance diagnostics

```bash
# Get metrics
curl http://localhost:3000/api/monitoring/performance?view=report

# Check alerts
curl http://localhost:3000/api/monitoring/performance?view=alerts
```

---

## Still Stuck?

1. **Search existing issues:** [GitHub Issues](https://github.com/CleanExpo/Synthex/issues)
2. **Check documentation:** [docs/](./README.md)
3. **Review recent commits:** `git log --oneline -20`
4. **Ask the team** with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version)

---

*Last updated: 2026-02-02*
