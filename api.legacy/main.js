// Main API Handler for Vercel Deployment
// Routes all API requests through real endpoints for production

const express = require('express');
const cors = require('cors');
const realEndpoints = require('./real-endpoints');

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount real endpoints at /api
app.use('/api', realEndpoints);

// Handle 404 for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: {
      auth: ['/api/auth/login', '/api/auth/register', '/api/auth/verify'],
      dashboard: ['/api/dashboard/stats'],
      campaigns: ['/api/campaigns', '/api/campaigns/:id'],
      content: ['/api/content/generate', '/api/content/analyze'],
      posts: ['/api/posts', '/api/posts/schedule'],
      analytics: ['/api/analytics', '/api/analytics/platforms/:platform'],
      settings: ['/api/settings'],
      team: ['/api/team', '/api/team/invite'],
      notifications: ['/api/notifications']
    }
  });
});

// Export for Vercel
module.exports = app;