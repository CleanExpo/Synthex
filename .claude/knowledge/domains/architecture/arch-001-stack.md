---
id: arch-001
domain: architecture
title: Application Stack & Data Models
created: 2026-02-16
updated: 2026-02-16
freshness: current
confidence: 0.95
evidence: package.json, prisma/schema.prisma
tags: [prisma, express, typescript, postgresql]
---

# Application Stack & Data Models

## Summary
Express 4 + TypeScript 5 backend with Prisma ORM on PostgreSQL. Node 20.x runtime.

## Detail

### Stack
- **Runtime**: Node.js 20.x
- **Framework**: Express 4.18
- **Language**: TypeScript 5.9
- **ORM**: Prisma 6.13
- **Database**: PostgreSQL (Supabase-hosted)
- **Auth**: JWT + Google OAuth via Passport.js
- **Payments**: Stripe
- **AI**: OpenAI + Anthropic APIs

### Data Models
- **User**: Authentication (local + Google OAuth), API keys (encrypted), preferences, password reset flow, email verification
- **Campaign**: Multi-platform marketing campaigns with content, analytics, and platform-specific settings
- **Post**: Content lifecycle (draft -> scheduled -> published -> failed) with metadata and analytics
- **Project**: Marketing/content/analytics project containers
- **ApiUsage**: Per-request token consumption and cost tracking
- **Session**: Auth session token management

### Key Dependencies
- `express-rate-limit` for API rate limiting
- `express-validator` for input validation
- `bcryptjs` for password hashing
- `multer` for file uploads
- `ws` for WebSocket support
- `swagger-jsdoc` + `swagger-ui-express` for API docs

## Implications
- Prisma migrations required for schema changes (`npx prisma migrate dev`)
- TypeScript strict mode enforced via `tsc --noEmit`
- All API routes funnel through `api/vercel.js` in production
