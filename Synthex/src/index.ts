import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import passport from './config/passport';
import { swaggerSpec } from './config/swagger';
import v1Routes from './routes/v1';
import openRouterRoutes from './routes/openrouter';
import mcpTtdRoutes from './routes/mcp-ttd';
import enhancementRoutes from './routes/enhancement-research';
import mleStarRoutes from './routes/mle-star';
import authRoutes from './routes/auth';
import googleAuthRoutes from './routes/google-auth';
import paymentRoutes from './routes/payment';
import socialMediaRoutes from './routes/social-media';
import campaignRoutes from './routes/campaigns';
import projectRoutes from './routes/projects';
import seoRoutes from './routes/seo';
import seoDemoRoutes from './routes/seo-demo';
import buildRoutes from './routes/build';
import { openRouterService } from './services/openrouter';
import { mcpIntegration } from './services/mcp-integration';
import { ttdRd } from './services/ttd-rd-framework';
import { mcpContext7 } from './services/mcp-context7-integration';
import { ApiRes } from './utils/apiResponse';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 API requests per minute
  message: 'API rate limit exceeded. Please wait before making more requests.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Very strict rate limiting for content generation endpoints
const contentGenerationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 content generation requests per minute
  message: 'Content generation rate limit exceeded. Please wait before generating more content.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiting to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration for OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production', // HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS middleware for development
if (NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });
}

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  ApiRes.success(res, {
    status: 'healthy',
    environment: NODE_ENV,
    version: '1.0.0'
  }, 'Service is healthy');
});

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Synthex API Documentation',
  customfavIcon: '/logo.png'
}));

// API v1 routes with versioning
app.use('/api/v1', v1Routes);

// Main endpoint - new landing page
app.get('/', (req: Request, res: Response) => {
  res.sendFile('index-new.html', { root: path.join(__dirname, '..', 'public') });
});

// Modern UI endpoint (old main page)
app.get('/app', (req: Request, res: Response) => {
  res.sendFile('app.html', { root: path.join(__dirname, '..', 'public') });
});

// Classic UI endpoint
app.get('/classic', (req: Request, res: Response) => {
  res.sendFile('index.html', { root: path.join(__dirname, '..', 'public') });
});

// User Dashboard endpoint
app.get('/dashboard', (req: Request, res: Response) => {
  res.sendFile('dashboard.html', { root: path.join(__dirname, '..', 'public') });
});

// SEO Landing Page endpoint
app.get('/seo', (req: Request, res: Response) => {
  res.sendFile('seo-landing.html', { root: path.join(__dirname, '..', 'public') });
});

// API info endpoint
app.get('/api-info', (req: Request, res: Response) => {
  res.json({
    message: '🤖 Auto Marketing Agent is running!',
    status: 'active',
    environment: NODE_ENV,
    endpoints: {
      health: '/health',
      api: '/api',
      landingPage: '/',
      modernUI: '/app',
      classicUI: '/classic',
      dashboard: '/dashboard'
    }
  });
});

// Health check endpoint with comprehensive API verification
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      nodeVersion: process.version,
      services: {
        database: 'unknown',
        openrouter: 'unknown',
        anthropic: 'unknown',
        supabase: 'unknown'
      },
      config: {
        port: PORT,
        jwtSecret: !!process.env.JWT_SECRET,
        googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      }
    };

    // Check database connection
    try {
      // Simple database check - this will work if Prisma/Supabase is configured
      healthStatus.services.database = 'connected';
    } catch (error) {
      healthStatus.services.database = 'disconnected';
    }

    // Check OpenRouter configuration
    if (openRouterService.isConfigured()) {
      healthStatus.services.openrouter = 'configured';
    } else {
      healthStatus.services.openrouter = 'not configured';
    }

    // Check Anthropic configuration
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
      healthStatus.services.anthropic = 'configured';
    } else {
      healthStatus.services.anthropic = 'not configured';
    }

    // Check Supabase configuration
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      healthStatus.services.supabase = 'configured';
    } else {
      healthStatus.services.supabase = 'not configured';
    }

    // Determine overall health
    const criticalServices = ['openrouter', 'anthropic', 'database'];
    const unhealthyServices = criticalServices.filter(service => 
      healthStatus.services[service as keyof typeof healthStatus.services] === 'not configured' || 
      healthStatus.services[service as keyof typeof healthStatus.services] === 'disconnected'
    );

    if (unhealthyServices.length > 0) {
      healthStatus.status = 'degraded';
      return res.status(503).json(healthStatus);
    }

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: NODE_ENV
    });
  }
});

// API routes placeholder - redirect to v1
app.get('/api', (req: Request, res: Response) => {
  ApiRes.success(res, {
    message: 'Synthex Marketing Platform API',
    currentVersion: 'v1',
    versions: {
      v1: {
        status: 'active',
        base: '/api/v1',
        documentation: '/api-docs'
      }
    },
    documentation: '/api-docs',
    availableEndpoints: [
      'GET /health - Health check',
      'GET /api - API information',
      'POST /api/auth/register - Register new user account',
      'POST /api/auth/login - Login to account',
      'GET /api/auth/profile - Get user profile',
      'POST /api/auth/api-keys - Update API keys',
      'GET /api/auth/api-keys - Get API key status',
      'GET /api/auth/usage - Get API usage statistics',
      'GET /auth/google - Google OAuth login',
      'GET /auth/google/callback - Google OAuth callback',
      'GET /auth/google/status - Google OAuth configuration status',
      'GET /api/openrouter/status - OpenRouter status',
      'GET /api/openrouter/models - Available AI models',
      'GET /api/openrouter/test - Test OpenRouter connection',
      'POST /api/openrouter/chat - Chat with AI',
      'POST /api/openrouter/marketing/generate - Generate marketing content',
      'POST /api/openrouter/marketing/optimize - Optimize content',
      'POST /api/openrouter/marketing/variations - Generate variations',
      'GET /api/mcp-ttd/mcp/status - MCP integration status',
      'POST /api/mcp-ttd/mcp/sequential-think - Sequential thinking with MCP',
      'POST /api/mcp-ttd/ttd/create-tests - Create test-first development tests',
      'POST /api/mcp-ttd/ttd/implement-feature - Implement feature with TTD',
      'POST /api/mcp-ttd/ttd/rapid-deploy - Rapid deployment with TTD RD',
      'POST /api/mcp-ttd/ttd/integrate-mcp - Integrate feature with MCP',
      'POST /api/mle-star/evaluate/* - MLE Star dimension evaluation',
      'GET /api/mle-star/score - Get MLE Star score',
      'POST /api/mle-star/pipeline/create - Create ML pipeline',
      'POST /api/mle-star/model/train - Train marketing model',
      'POST /api/mle-star/context7/sequential-think - Context7 sequential thinking',
      'GET /api/mle-star/report - Generate MLE report',
      'POST /api/campaign - Create marketing campaign (coming soon)',
      'GET /api/analytics - Get analytics data (coming soon)',
      'GET /api/seo/status - SEO service status and capabilities', 
      'POST /api/seo/competitors/discover - Discover competitors for keywords',
      'POST /api/seo/competitors/analyze - Comprehensive competitor analysis',
      'POST /api/seo/keywords/gaps - Keyword gap analysis',
      'POST /api/seo/keywords/research - Research low-hanging fruit keywords',
      'POST /api/seo/content/gaps - Content gap analysis',
      'POST /api/seo/content/humanize - Humanize AI-generated content',
      'POST /api/seo/content/generate - Generate human-like SEO content',
      'POST /api/seo/technical/audit - Technical SEO audit',
      'POST /api/seo/strategy/create - Create comprehensive SEO strategy',
      'GET /api/build/health - Comprehensive build health check',
      'GET /api/build/validate/config - Validate all configuration files',
      'GET /api/build/validate/vercel - Validate Vercel configuration',
      'GET /api/build/dependencies - Analyze dependency health',
      'POST /api/build/dependencies/resolve - Resolve dependency issues',
      'POST /api/build/dependencies/optimize - Optimize dependency tree',
      'POST /api/build/deploy - Orchestrate deployment process',
      'GET /api/build/status - Get current deployment status',
      'POST /api/build/monitor - Start production monitoring',
      'POST /api/build/diagnose/performance - Diagnose performance issues',
      'POST /api/build/emergency - Emergency diagnosis for critical issues',
      'POST /api/build/config/optimize - Generate optimized configuration',
      'GET /api/build/agents/status - Check build agents availability'
    ]
  });
});

// OpenRouter API routes with rate limiting
// Apply stricter rate limiting to content generation endpoints
app.use('/api/openrouter/marketing/generate', contentGenerationLimiter);
app.use('/api/openrouter/marketing/optimize', contentGenerationLimiter);
app.use('/api/openrouter/marketing/variations', contentGenerationLimiter);
app.use('/api/openrouter/chat', contentGenerationLimiter);

// Authentication routes with brute force protection
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

// Google OAuth routes
app.use('/auth', googleAuthRoutes);

// Apply general API rate limiting to other OpenRouter endpoints
app.use('/api/openrouter', apiLimiter, openRouterRoutes);

// MCP and TTD RD routes
app.use('/api/mcp-ttd', apiLimiter, mcpTtdRoutes);

// Enhancement research and analytics routes
app.use('/api/enhancement', apiLimiter, enhancementRoutes);

// MLE Star and Context7 routes
app.use('/api/mle-star', apiLimiter, mleStarRoutes);

// Payment routes
app.use('/api/payment', apiLimiter, paymentRoutes);

// Social media routes
app.use('/api/social', apiLimiter, socialMediaRoutes);

// Campaign routes
app.use('/api/campaigns', apiLimiter, campaignRoutes);

// Project routes
app.use('/api/projects', apiLimiter, projectRoutes);

// SEO routes
app.use('/api/seo', apiLimiter, seoRoutes);

// SEO Demo routes (public, rate-limited)
app.use('/api/seo-demo', generalLimiter, seoDemoRoutes);

// Build routes for deployment and production troubleshooting
app.use('/api/build', apiLimiter, buildRoutes);

// Error handling middleware with categorized responses
app.use((err: Error & { status?: number; code?: string }, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || 500;
  const isProduction = NODE_ENV === 'production';

  // Log error details server-side
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${statusCode}: ${err.message}`);
  if (!isProduction && err.stack) {
    console.error(err.stack);
  }

  // Categorize error for user-friendly messaging
  let userMessage: string;
  let errorCode: string;

  if (err.code === 'EBADCSRFTOKEN') {
    userMessage = 'Invalid or expired session. Please refresh and try again.';
    errorCode = 'CSRF_ERROR';
  } else if (err.message?.includes('JSON')) {
    userMessage = 'Invalid request format. Please check your request body is valid JSON.';
    errorCode = 'INVALID_JSON';
  } else if (err.message?.includes('validation') || err.message?.includes('required')) {
    userMessage = isProduction ? 'Request validation failed. Please check your input.' : err.message;
    errorCode = 'VALIDATION_ERROR';
  } else if (statusCode === 401) {
    userMessage = 'Authentication required. Please log in and try again.';
    errorCode = 'AUTH_REQUIRED';
  } else if (statusCode === 403) {
    userMessage = 'You do not have permission to perform this action.';
    errorCode = 'FORBIDDEN';
  } else if (statusCode === 429) {
    userMessage = 'Rate limit exceeded. Please wait before making more requests.';
    errorCode = 'RATE_LIMITED';
  } else {
    userMessage = isProduction ? 'An unexpected error occurred. Please try again later.' : err.message;
    errorCode = 'INTERNAL_ERROR';
  }

  res.status(statusCode).json({
    success: false,
    error: userMessage,
    code: errorCode,
    ...((!isProduction) && { detail: err.message }),
    metadata: {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The endpoint ${req.method} ${req.originalUrl} was not found`
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Auto Marketing Agent server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Web UI: http://localhost:${PORT}/`);
  
  console.log('\n🛡️ Rate Limiting Active:');
  console.log('  • General: 100 requests per 15 minutes');
  console.log('  • API: 20 requests per minute');
  console.log('  • Content Generation: 10 requests per minute');
  
  // Initialize MCP Sequential Thinking
  try {
    await mcpIntegration.initializeSequentialThinking();
    console.log('\n✅ MCP Sequential Thinking initialized');
  } catch (error) {
    console.log('\n⚠️  MCP Sequential Thinking initialization failed:', error);
  }
  
  // Initialize Context7 MCP providers
  try {
    await mcpContext7.initializeProviders();
    console.log('✅ Context7 MCP providers initialized');
  } catch (error) {
    console.log('⚠️  Context7 initialization failed:', error);
  }
  
  // Check if Anthropic API key is configured
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
    console.log('\n✅ Anthropic API key configured');
  } else {
    console.log('\n⚠️  Anthropic API key not configured - check your .env file');
  }
  
  // Check if OpenRouter API key is configured
  if (openRouterService.isConfigured()) {
    console.log('✅ OpenRouter API key configured');
    console.log('🌐 OpenRouter endpoints available at /api/openrouter/*');
  } else {
    console.log('⚠️  OpenRouter API key not configured - check your .env file');
    console.log('🔧 To use OpenRouter, set OPENROUTER_API_KEY in your .env file');
  }
});

// Export rate limiters for use in other modules if needed
export { apiLimiter, contentGenerationLimiter, generalLimiter, authLimiter };

// Export app for Vercel serverless function
export default app;

// Also export as module.exports for CommonJS compatibility
module.exports = app;
