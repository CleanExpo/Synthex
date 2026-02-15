# Synthex

AI-powered marketing automation platform. Express + TypeScript backend deployed on Vercel.

## Project Identity

- **Name**: Synthex (formerly "Auto Marketing")
- **Stack**: Express 4, TypeScript 5, Prisma ORM, PostgreSQL
- **Deployment**: Vercel (serverless), `rootDirectory: "Synthex"`
- **Node**: 20.x
- **OS**: Windows 11 (PowerShell)

## Directory Structure

```
D:\Synthex\                      # Repository root
├── Synthex/                     # Application code (Vercel rootDirectory)
│   ├── src/                     # TypeScript source
│   │   ├── index.ts             # Express app entry point
│   │   ├── services/            # Business logic (analytics, social-media, seo, etc.)
│   │   ├── routes/              # API route handlers
│   │   └── middleware/          # Auth, rate limiting, validation
│   ├── prisma/                  # Database schema & migrations
│   ├── public/                  # Static assets (landing page, dashboard)
│   ├── api/vercel.js            # Vercel serverless adapter
│   └── platform_master_config.json  # 8-platform marketing config
├── .claude/                     # Claude Code integration layer
│   ├── skills/                  # 12 skill definitions (SKILL.md)
│   ├── agents/                  # 6 agent definitions (AGENT.md)
│   ├── hooks/                   # 7 PowerShell hook scripts
│   ├── knowledge/               # NotebookLM-style knowledge base
│   ├── checkpoints/             # Session state checkpoints
│   └── settings.local.json      # Permissions, hooks config
├── tools/claude-seo/            # SEO tooling (13 skills, 6 agents, hooks)
├── agents/build/                # Build orchestration agents
└── vercel.json                  # Vercel deployment config
```

## Commands

```bash
# Development
npm run dev                      # Start dev server (ts-node)
npm run dev:watch                # Dev with nodemon

# Build
npm run build                    # TypeScript compile
npm run build:prod               # Production build (no sourcemaps)

# Database
npx prisma generate              # Generate Prisma client
npx prisma db push               # Push schema changes
npx prisma migrate dev           # Create migration
npx prisma studio                # Database GUI

# Testing
npm test                         # Run Jest tests
npm run test:coverage            # Tests with coverage

# Type checking
npm run typecheck                # tsc --noEmit
```

## Data Models (Prisma)

- **User** -- auth (local + Google OAuth), API keys, preferences
- **Campaign** -- multi-platform marketing campaigns
- **Post** -- scheduled/published content per platform
- **Project** -- marketing/content/analytics projects
- **ApiUsage** -- token/cost tracking per API call
- **Session** -- auth session tokens

## Platforms (8)

YouTube, Instagram, TikTok, X (Twitter), Facebook, LinkedIn, Pinterest, Reddit.
Config in `Synthex/platform_master_config.json`.

## Architecture Notes

- All API routes go through `api/vercel.js` serverless adapter
- Rate limiting via `express-rate-limit`
- Auth: JWT + Google OAuth (Passport.js)
- Payments: Stripe integration
- AI: OpenAI + Anthropic APIs via OpenRouter

## Claude Code Integration

Skills, agents, hooks, and knowledge base live in `.claude/` -- outside the Vercel root directory, so they have zero deployment impact.

- **Skills** define structured workflows (SKILL.md with YAML frontmatter)
- **Agents** define specialist roles with tools and delegation protocols
- **Hooks** are PowerShell scripts that validate actions pre/post tool use
- **Knowledge base** is a structured "second brain" for persistent research

See `tools/claude-seo/` for the canonical pattern (13 skills, 6 agents).
