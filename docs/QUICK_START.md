# SYNTHEX Quick Start Guide

> Get up and running in 5 minutes

## Prerequisites

- Node.js 22.x
- npm 10+
- Git

## Setup

```bash
# Clone and install
git clone https://github.com/CleanExpo/Synthex.git
cd Synthex
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Initialize database
npx prisma generate
npx prisma db push

# Start development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Essential Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run e2e` | Run E2E tests |
| `npm run lint` | Lint code |
| `npm run type-check` | TypeScript check |

## Environment Variables

**Required:**
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

**Optional (for full features):**
```env
OPENROUTER_API_KEY=...       # AI features
UPSTASH_REDIS_REST_URL=...   # Caching
STRIPE_SECRET_KEY=...        # Payments
```

## Project Structure

```
app/                  # Next.js App Router pages
├── api/              # API routes
├── dashboard/        # Dashboard pages
└── (auth)/           # Auth pages

components/           # React components
├── ui/               # Shadcn/ui components
└── ...               # Feature components

lib/                  # Core libraries
├── data/             # Data validation
├── monitoring/       # Performance monitoring
├── scalability/      # Caching, rate limiting
└── testing/          # Test utilities

prisma/               # Database schema
tests/                # Test files
```

## Key APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/*` | * | Authentication |
| `/api/users` | GET/POST | User management |
| `/api/campaigns` | GET/POST | Campaign management |
| `/api/quotes` | GET/POST | Quote management |

## Next Steps

1. 📖 [Developer Onboarding](./DEVELOPER_ONBOARDING.md) - Full setup guide
2. 📚 [API Documentation](./API_DOCUMENTATION.md) - API reference
3. 🧪 [Testing Guide](./TESTING_GUIDE.md) - Testing practices
4. 🔧 [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

## Getting Help

- Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review existing [GitHub Issues](https://github.com/CleanExpo/Synthex/issues)
- Ask in team chat

---

*For detailed documentation, see [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md)*
