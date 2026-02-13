# SYNTHEX — Claude Code Configuration

## Project
- **What:** AI-powered social media marketing platform
- **Stack:** Next.js 15, React 18, TypeScript 5.7, Prisma ORM, Supabase (PostgreSQL), Tailwind CSS
- **Deploy:** Vercel (serverless) — `vercel --prod --yes`
- **Auth:** JWT in httpOnly `auth-token` cookie. Helper: `getUserIdFromRequestOrCookies()`
- **AI:** OpenRouter API via `@/lib/ai/`

## Pricing (HARDCODED — DO NOT CHANGE)
| Plan | Price | Notes |
|------|-------|-------|
| Professional | $249/mo | 5 accounts, 100 posts/mo, 3 personas |
| Business | $399/mo | 10 accounts, unlimited posts, 10 personas, team collab |
| Custom | Contact Sales | Multi-business owners, enterprise |

### Custom Plan — Multi-Business Owners
- `isMultiBusinessOwner` flag on User model (admin-set only)
- Each child business = separate Organization, $249/mo via `BusinessOwnership` table
- `activeOrganizationId` on User tracks current business context
- `getEffectiveOrganizationId(userId)` scopes all dashboard queries
- BusinessSwitcher component in dashboard header

## Demo Credentials
| Account | Email | Password |
|---------|-------|----------|
| Demo | `demo@synthex.com` | `Rrw6qRd1IIIY5Br9!` |
| Admin | `admin@synthex.com` | `IBkxhZpGPQW3a5B2!` |

## Architecture

### Key Patterns
- **UI:** Dark theme (bg-gray-950, bg-[#0f172a]/80), cyan accents, glassmorphic cards
- **Icons:** All from `@/components/icons` barrel (lucide-react re-exports)
- **Components:** `'use client'` directive, `credentials: 'include'` on all fetches
- **API Routes:** Next.js App Router at `app/api/`. Auth via JWT from header or cookie
- **Database:** Prisma ORM. Post→Campaign→Organization chain (Post has no direct `organizationId`). Analytics stored as JSON on Post. `platformConnection` (not `socialMediaAccount`)

### Feature Gating
- GEO/E-E-A-T tools: Professional plan via `GEOFeatureGate` component
- Multi-business dashboard: `custom` plan + `isMultiBusinessOwner === true`
- SEO tools: Available on all paid plans

### Key Directories
```
app/              → Next.js pages + API routes
components/       → React components (business/, ui/, icons.tsx)
hooks/            → Custom React hooks (use-user, useActiveBusiness, etc.)
lib/              → Server utilities (prisma, multi-business/, ai/, security/)
prisma/           → Schema + migrations
```

## Environment Variables
Configured in Vercel dashboard — NEVER commit `.env` files.
```
DATABASE_URL          — PostgreSQL connection (CRITICAL)
SUPABASE_URL          — Supabase project URL
SUPABASE_ANON_KEY     — Supabase anonymous key
JWT_SECRET            — Token signing key (CRITICAL)
OPENROUTER_API_KEY    — AI service key (SECRET)
NEXT_PUBLIC_APP_URL   — Production URL
```

## Security Rules
1. Never expose SECRET/CRITICAL env vars to client components
2. Use `NEXT_PUBLIC_` prefix only for client-safe values
3. All API endpoints must authenticate via JWT
4. Never log sensitive values or include in API error responses
5. Use Prisma parameterized queries (never raw SQL with user input)
6. Validate all user input server-side

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npx tsc --noEmit     # Type check
npx prisma generate  # Regenerate Prisma client
npx prisma db push   # Push schema to database
vercel --prod --yes  # Deploy to production
```

## Rules
- **DO** what was asked — nothing more, nothing less
- **NEVER** create files unless absolutely necessary
- **ALWAYS** prefer editing existing files over creating new ones
- **NEVER** create documentation files unless explicitly requested
- **ALWAYS** run typecheck after code changes
- **NEVER** commit unless explicitly asked
- **ALWAYS** use TodoWrite for complex multi-step tasks
