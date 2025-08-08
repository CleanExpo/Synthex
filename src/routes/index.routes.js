/**
 * Main Routes Index
 * Combines all application routes
 */

const express = require('express');
const router = express.Router();

// Import all route modules
const analyticsRoutes = require('./analytics.routes');
const abTestingRoutes = require('./ab-testing.routes');
const aiContentRoutes = require('./ai-content.routes');
const teamRoutes = require('./team.routes');
const schedulerRoutes = require('./scheduler.routes');
const libraryRoutes = require('./library.routes');
const mobileRoutes = require('./mobile.routes');
const whiteLabelRoutes = require('./white-label.routes');
const reportingRoutes = require('./reporting.routes');
const competitorRoutes = require('./competitor.routes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    version: '2.0.0',
    endpoints: {
      analytics: '/api/analytics',
      abTesting: '/api/ab-testing',
      aiContent: '/api/ai-content',
      teams: '/api/teams',
      scheduler: '/api/scheduler',
      library: '/api/library',
      mobile: '/api/mobile',
      whiteLabel: '/api/white-label',
      reporting: '/api/reporting',
      competitors: '/api/competitors'
    },
    documentation: 'https://docs.synthex.app/api'
  });
});

// Mount all route modules
router.use('/analytics', analyticsRoutes);
router.use('/ab-testing', abTestingRoutes);
router.use('/ai-content', aiContentRoutes);
router.use('/teams', teamRoutes);
router.use('/scheduler', schedulerRoutes);
router.use('/library', libraryRoutes);
router.use('/mobile', mobileRoutes);
router.use('/white-label', whiteLabelRoutes);
router.use('/reporting', reportingRoutes);
router.use('/competitors', competitorRoutes);

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
router.use((err, req, res, next) => {
  console.error('API Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;