# SYNTHEX Dependencies Documentation

**Generated:** 2026-02-05
**Phase:** Discovery (G1)
**Swarm Build System:** v1.0

---

## Overview

| Category | Count |
|----------|-------|
| Production Dependencies | 110 |
| Development Dependencies | 50 |
| Total Packages | 160 |
| Known Vulnerabilities | 4 |

---

## Core Framework Dependencies

### Next.js & React

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.2.31 | React framework with App Router |
| `react` | ^18.2.0 | UI library |
| `react-dom` | ^18.2.0 | React DOM renderer |
| `typescript` | ^5.7.2 | Type system |

### Build & Package Management

| Package | Version | Purpose |
|---------|---------|---------|
| `turbo` | ^2.8.1 | Monorepo build system |
| `pnpm` | 9.15.0 | Package manager (workspaces) |

---

## AI & Machine Learning

| Package | Version | Purpose |
|---------|---------|---------|
| `@ai-sdk/anthropic` | ^3.0.14 | Anthropic Claude SDK |
| `@ai-sdk/google` | ^3.0.9 | Google AI SDK |
| `@anthropic-ai/sdk` | ^0.20.0 | Anthropic direct SDK |
| `openai` | ^4.104.0 | OpenAI SDK |
| `ai` | ^6.0.37 | Vercel AI SDK |

---

## Database & ORM

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | 6.14.0 | Database ORM |
| `@prisma/client` | 6.14.0 | Prisma client |
| `@supabase/supabase-js` | ^2.55.0 | Supabase client |
| `@supabase/ssr` | ^0.6.1 | Supabase SSR helpers |
| `@auth/prisma-adapter` | ^1.6.0 | Auth Prisma adapter |

---

## Caching & Queue

| Package | Version | Purpose |
|---------|---------|---------|
| `redis` | ^5.8.1 | Redis client |
| `ioredis` | ^5.9.2 | Advanced Redis client |
| `@upstash/redis` | ^1.35.3 | Upstash Redis (serverless) |
| `bullmq` | ^5.67.2 | Job queue system |

---

## Authentication

| Package | Version | Purpose |
|---------|---------|---------|
| `next-auth` | ^4.24.11 | NextAuth.js |
| `jsonwebtoken` | ^9.0.2 | JWT handling |
| `bcryptjs` | ^3.0.2 | Password hashing |

---

## UI Framework

### Core UI

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4.0 | Utility-first CSS |
| `tailwind-merge` | ^2.2.0 | Tailwind class merging |
| `tailwindcss-animate` | ^1.0.7 | Tailwind animations |
| `class-variance-authority` | ^0.7.0 | Component variants |
| `clsx` | ^2.1.0 | Class name utility |
| `framer-motion` | ^12.23.12 | Animation library |

### Radix UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-accordion` | ^1.2.0 | Accordion |
| `@radix-ui/react-avatar` | ^1.1.10 | Avatar |
| `@radix-ui/react-checkbox` | ^1.3.2 | Checkbox |
| `@radix-ui/react-dialog` | ^1.1.14 | Modal dialogs |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | Dropdown menus |
| `@radix-ui/react-icons` | ^1.3.0 | Icon set |
| `@radix-ui/react-label` | ^2.1.7 | Form labels |
| `@radix-ui/react-popover` | ^1.1.14 | Popovers |
| `@radix-ui/react-progress` | ^1.0.3 | Progress bars |
| `@radix-ui/react-radio-group` | ^1.3.7 | Radio groups |
| `@radix-ui/react-scroll-area` | ^1.2.9 | Scroll areas |
| `@radix-ui/react-select` | ^2.2.5 | Select dropdowns |
| `@radix-ui/react-separator` | ^1.1.7 | Separators |
| `@radix-ui/react-slider` | ^1.3.5 | Sliders |
| `@radix-ui/react-slot` | ^1.2.3 | Slot utility |
| `@radix-ui/react-switch` | ^1.2.5 | Toggle switches |
| `@radix-ui/react-tabs` | ^1.1.12 | Tab panels |
| `@radix-ui/react-toast` | ^1.2.14 | Toast notifications |
| `@radix-ui/react-tooltip` | ^1.2.8 | Tooltips |

### Icons

| Package | Version | Purpose |
|---------|---------|---------|
| `@heroicons/react` | ^2.2.0 | Heroicons |
| `lucide-react` | ^0.563.0 | Lucide icons |
| `react-icons` | ^5.5.0 | Icon collection |

---

## Data Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | ^2.10.3 | Charts library |
| `@react-three/fiber` | ^8.15.12 | 3D graphics (React Three) |
| `@react-three/drei` | ^9.88.17 | Three.js helpers |
| `three` | ^0.159.0 | 3D graphics engine |

---

## Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.48.0 | Form handling |
| `@hookform/resolvers` | ^3.3.0 | Form validation resolvers |
| `zod` | ^3.25.76 | Schema validation |
| `express-validator` | ^7.2.1 | Express validation |

---

## Rich Text & Content

| Package | Version | Purpose |
|---------|---------|---------|
| `@tiptap/react` | ^2.1.0 | Rich text editor |
| `@tiptap/starter-kit` | ^2.1.0 | TipTap starter |
| `react-markdown` | ^9.0.0 | Markdown rendering |
| `dompurify` | ^3.0.0 | HTML sanitization |

---

## Data Fetching & State

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | ^5.17.0 | Data fetching |
| `@tanstack/react-table` | ^8.11.0 | Table components |
| `swr` | ^2.2.0 | SWR data fetching |
| `axios` | ^1.11.0 | HTTP client |
| `zustand` | ^4.4.0 | State management |

---

## Payments

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | ^18.4.0 | Stripe server SDK |
| `@stripe/stripe-js` | ^7.8.0 | Stripe browser SDK |

---

## Email

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^7.0.12 | Email sending |
| `@sendgrid/mail` | ^8.1.5 | SendGrid integration |

---

## Monitoring & Error Tracking

| Package | Version | Purpose |
|---------|---------|---------|
| `@sentry/nextjs` | ^7.120.4 | Sentry error tracking |

---

## Social Media

| Package | Version | Purpose |
|---------|---------|---------|
| `twitter-api-v2` | ^1.24.0 | Twitter/X API |
| `@mendable/firecrawl-js` | ^4.11.0 | Web scraping |

---

## Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^3.0.0 | Date utilities |
| `uuid` | ^13.0.0 | UUID generation |
| `chalk` | ^5.5.0 | Terminal styling |
| `dotenv` | ^17.2.1 | Environment variables |
| `canvas-confetti` | ^1.9.4 | Celebration effects |
| `jspdf` | ^4.0.0 | PDF generation |
| `jspdf-autotable` | ^5.0.7 | PDF tables |
| `cmdk` | ^0.2.0 | Command palette |

---

## Server & Middleware

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.1.0 | Express server |
| `express-rate-limit` | ^8.0.1 | Rate limiting |
| `express-session` | ^1.18.2 | Session management |
| `helmet` | ^8.1.0 | Security headers |
| `cors` | ^2.8.5 | CORS handling |
| `multer` | ^2.0.2 | File uploads |
| `ws` | ^8.14.0 | WebSocket server |

---

## Development Dependencies

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Unit testing |
| `jest-environment-jsdom` | ^29.7.0 | DOM environment |
| `@testing-library/react` | ^14.1.0 | React testing |
| `@testing-library/jest-dom` | ^6.1.0 | DOM matchers |
| `@playwright/test` | ^1.40.0 | E2E testing |
| `playwright` | ^1.54.2 | Browser automation |
| `supertest` | ^7.2.2 | HTTP testing |

### Storybook

| Package | Version | Purpose |
|---------|---------|---------|
| `storybook` | ^8.6.15 | Component documentation |
| `@storybook/nextjs` | ^8.6.15 | Next.js integration |
| `@storybook/react` | ^8.6.15 | React integration |
| `@storybook/addon-*` | ^8.6.15 | Various addons |

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| `@babel/preset-env` | ^7.28.6 | Babel presets |
| `@babel/preset-react` | ^7.28.5 | React preset |
| `@next/bundle-analyzer` | ^14.0.4 | Bundle analysis |
| `tsx` | ^4.0.0 | TypeScript execution |
| `ts-node` | ^10.9.2 | TS execution |

### Code Quality

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^8.57.1 | Linting |
| `eslint-config-next` | 14.0.4 | Next.js ESLint config |
| `prettier` | ^3.1.1 | Code formatting |
| `husky` | ^8.0.0 | Git hooks |
| `lint-staged` | ^15.2.0 | Staged file linting |

---

## Engine Requirements

```json
{
  "engines": {
    "node": "22.x",
    "npm": ">=10 <12"
  },
  "packageManager": "pnpm@9.15.0"
}
```

---

## Known Vulnerabilities

Per `npm audit`:
- **4 vulnerabilities** reported in dev dependencies
- Run `npm audit` for current details
- Run `npm audit fix` for automatic fixes

---

## Version Compatibility Notes

1. **Next.js 14.2.31** - Latest stable App Router
2. **Prisma 6.14.0** - Requires Node.js 18.18+ or 20+
3. **TypeScript 5.7** - Strict mode enabled
4. **React 18.2** - Concurrent features enabled
5. **Express 5.1** - New async error handling
