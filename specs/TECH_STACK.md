# SYNTHEX Technology Stack Documentation

**Generated:** 2026-02-05
**Phase:** Discovery (G1)
**Swarm Build System:** v1.0

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  Next.js 14 (App Router) │ React 18 │ Tailwind CSS │ Radix UI  │
├─────────────────────────────────────────────────────────────────┤
│                         API LAYER                               │
│  Next.js API Routes (143) │ Express 5 │ WebSocket (ws)          │
├─────────────────────────────────────────────────────────────────┤
│                       SERVICE LAYER                             │
│  AI Services │ Auth │ Payments │ Email │ Social Media APIs      │
├─────────────────────────────────────────────────────────────────┤
│                       DATA LAYER                                │
│  Prisma ORM │ PostgreSQL (Supabase) │ Redis (Upstash)          │
├─────────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                               │
│  Vercel (Hosting) │ Supabase (Database) │ Sentry (Monitoring)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.31 | React framework with App Router |
| **React** | 18.2.0 | UI component library |
| **TypeScript** | 5.7.2 | Type-safe JavaScript |

### Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 3.4.0 | Utility-first CSS framework |
| **tailwind-merge** | 2.2.0 | Merge Tailwind classes |
| **tailwindcss-animate** | 1.0.7 | Animation utilities |
| **Framer Motion** | 12.23.12 | Animation library |

### UI Components

| Technology | Version | Purpose |
|------------|---------|---------|
| **Radix UI** | Various | Accessible component primitives |
| **Lucide React** | 0.563.0 | Icon library |
| **cmdk** | 0.2.0 | Command palette |
| **react-hot-toast** | 2.4.1 | Toast notifications |
| **sonner** | 1.3.0 | Toast alternative |

### Data Visualization

| Technology | Version | Purpose |
|------------|---------|---------|
| **Recharts** | 2.10.3 | Chart library |
| **Three.js** | 0.159.0 | 3D graphics |
| **@react-three/fiber** | 8.15.12 | React Three bindings |
| **@react-three/drei** | 9.88.17 | Three.js helpers |

### State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 4.4.0 | Lightweight state management |
| **TanStack Query** | 5.17.0 | Server state management |
| **SWR** | 2.2.0 | Data fetching (alternative) |

### Forms

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Hook Form** | 7.48.0 | Form handling |
| **Zod** | 3.25.76 | Schema validation |

---

## Backend Stack

### API Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js API Routes** | 14.2.31 | Serverless API endpoints |
| **Express** | 5.1.0 | Traditional server (optional) |
| **WebSocket (ws)** | 8.14.0 | Real-time communication |

### Database

| Technology | Version | Purpose |
|------------|---------|---------|
| **Prisma** | 6.14.0 | ORM and database client |
| **PostgreSQL** | Latest | Primary database (via Supabase) |
| **Supabase** | 2.55.0 | Database-as-a-service |

### Caching

| Technology | Version | Purpose |
|------------|---------|---------|
| **Redis** | 5.8.1 | In-memory cache |
| **Upstash Redis** | 1.35.3 | Serverless Redis |
| **ioredis** | 5.9.2 | Advanced Redis client |

### Queue System

| Technology | Version | Purpose |
|------------|---------|---------|
| **BullMQ** | 5.67.2 | Job queue (Redis-backed) |

---

## Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| **NextAuth.js** | 4.24.11 | Authentication framework |
| **Supabase Auth** | 2.55.0 | Alternative auth provider |
| **JWT** | 9.0.2 | Token-based auth |
| **bcryptjs** | 3.0.2 | Password hashing |

### OAuth Providers Supported

- Google OAuth
- Twitter/X OAuth
- Custom email/password
- Magic links (via email)

---

## AI Services

| Service | Package | Purpose |
|---------|---------|---------|
| **OpenAI** | openai ^4.104.0 | GPT models |
| **Anthropic Claude** | @anthropic-ai/sdk ^0.20.0 | Claude models |
| **Google AI** | @ai-sdk/google ^3.0.9 | Gemini models |
| **OpenRouter** | API integration | Model routing |
| **Vercel AI SDK** | ai ^6.0.37 | Unified AI interface |

### AI Features

- Content generation
- Hashtag generation
- Sentiment analysis
- Writing assistance
- Persona management
- Predictive analytics

---

## Payment Processing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Stripe** | 18.4.0 | Payment processing |
| **@stripe/stripe-js** | 7.8.0 | Browser SDK |

### Features

- Subscription management
- Billing portal
- Checkout sessions
- Webhook handling

---

## Email Services

| Technology | Version | Purpose |
|------------|---------|---------|
| **Nodemailer** | 7.0.12 | Email sending |
| **SendGrid** | 8.1.5 | Email API |

### Templates

- Welcome emails
- Password reset
- Notifications
- Marketing campaigns

---

## Social Media Integration

| Platform | Technology | Status |
|----------|------------|--------|
| **Twitter/X** | twitter-api-v2 | Implemented |
| **Facebook** | Graph API | Planned |
| **Instagram** | Graph API | Planned |
| **LinkedIn** | LinkedIn API | Planned |
| **TikTok** | TikTok API | Planned |

---

## Infrastructure

### Hosting

| Service | Purpose |
|---------|---------|
| **Vercel** | Primary hosting (serverless) |
| **Supabase** | Database hosting |
| **Upstash** | Redis hosting |

### Monitoring

| Service | Version | Purpose |
|---------|---------|---------|
| **Sentry** | 7.120.4 | Error tracking |
| **Custom Monitoring** | - | Health checks, metrics |

### CDN & Assets

| Service | Purpose |
|---------|---------|
| **Vercel Edge** | CDN delivery |
| **Next.js Image** | Image optimization |

---

## Development Tools

### Build System

| Tool | Version | Purpose |
|------|---------|---------|
| **Turborepo** | 2.8.1 | Monorepo management |
| **pnpm** | 9.15.0 | Package management |
| **SWC** | Bundled | Fast compilation |

### Testing

| Tool | Version | Purpose |
|------|---------|---------|
| **Jest** | 29.7.0 | Unit testing |
| **Playwright** | 1.54.2 | E2E testing |
| **Testing Library** | 14.1.0 | Component testing |
| **Storybook** | 8.6.15 | Component documentation |

### Code Quality

| Tool | Version | Purpose |
|------|---------|---------|
| **ESLint** | 8.57.1 | Linting |
| **Prettier** | 3.1.1 | Formatting |
| **Husky** | 8.0.0 | Git hooks |
| **lint-staged** | 15.2.0 | Pre-commit checks |

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "target": "ES2018",
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

**Key Settings:**
- ✅ Strict mode enabled
- ✅ No implicit any
- ✅ Strict null checks
- ✅ Force consistent casing

---

## Security Features

| Feature | Implementation |
|---------|----------------|
| **Environment Validation** | Custom env-validator |
| **API Security** | APISecurityChecker |
| **Rate Limiting** | express-rate-limit |
| **CORS** | Configured per-origin |
| **Helmet** | Security headers |
| **Input Sanitization** | DOMPurify |
| **SQL Injection Protection** | Prisma ORM |
| **XSS Protection** | Content-Security-Policy |

---

## File Storage

| Service | Purpose |
|---------|---------|
| **Supabase Storage** | User uploads |
| **Vercel Blob** | Static assets |
| **Local (multer)** | Upload handling |

---

## Real-Time Features

| Technology | Purpose |
|------------|---------|
| **WebSocket (ws)** | Real-time updates |
| **Server-Sent Events** | Live notifications |
| **TanStack Query** | Polling & refetching |

---

## Performance Optimizations

| Feature | Implementation |
|---------|----------------|
| **Bundle Splitting** | Next.js dynamic imports |
| **Image Optimization** | Next.js Image with AVIF/WebP |
| **Compression** | Gzip enabled |
| **Caching** | Redis + HTTP cache headers |
| **Package Optimization** | optimizePackageImports |
| **Tree Shaking** | SWC bundler |

---

## Architectural Patterns

1. **App Router** - File-based routing with layouts
2. **Server Components** - Default for non-interactive UI
3. **API Routes** - Serverless functions
4. **Repository Pattern** - Data access abstraction
5. **Service Layer** - Business logic encapsulation
6. **Environment Validation** - Startup checks
