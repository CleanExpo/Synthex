import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import { PrismaClient } from '@prisma/client';
import i18nMiddleware from './middleware/i18n';
import { cacheMiddleware } from './middleware/caching';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma
const prisma = new PrismaClient();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openrouter.ai", "https://*.supabase.co"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'synthex-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Internationalization middleware
app.use(i18nMiddleware);

// Caching middleware for GET requests (5 minute cache)
app.use(cacheMiddleware({ ttl: 300 }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API Routes - Core
app.use('/api/auth', require('./routes/auth').default);
app.use('/api/content', require('./routes/content').default);
app.use('/api/campaigns', require('./routes/campaigns').default);
app.use('/api/analytics', require('./routes/analytics').default);
app.use('/api/platforms', require('./routes/platforms').default);

// API Routes - New Features (Phase 1 Integration)
app.use('/api/ab-testing', require('./routes/ab-testing.routes').default);
app.use('/api/ai-content', require('./routes/ai-content.routes').default);
app.use('/api/competitor', require('./routes/competitor.routes').default);
app.use('/api/library', require('./routes/library.routes').default);
app.use('/api/mobile', require('./routes/mobile.routes').default);
app.use('/api/reporting', require('./routes/reporting.routes').default);
app.use('/api/scheduler', require('./routes/scheduler.routes').default);
app.use('/api/team', require('./routes/team.routes').default);
app.use('/api/white-label', require('./routes/white-label.routes').default);

// API Routes - Utilities
app.use('/api/dashboard', require('./routes/dashboard').default);
app.use('/api/email', require('./routes/email').default);
app.use('/api/mcp', require('./routes/mcp').default);
app.use('/api/performance', require('./routes/performance').default);
app.use('/api/posts', require('./routes/posts').default);
app.use('/api/projects', require('./routes/projects').default);
app.use('/api/team-management', require('./routes/team').default);
app.use('/api/two-factor', require('./routes/twoFactor').default);
app.use('/api/user-management', require('./routes/userManagement').default);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server (only if not in Next.js environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SYNTHEX API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;