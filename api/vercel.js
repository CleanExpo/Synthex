// Vercel serverless function handler
// This file serves as the entry point for Vercel serverless functions

const path = require('path');

let app;

try {
  // Load the compiled Express app
  const appModule = require('../dist/index.js');
  
  // Handle both default export and direct export
  app = appModule.default || appModule;
  
  if (typeof app !== 'function') {
    throw new Error('Invalid app export - expected Express app function');
  }
  
  console.log('✅ Successfully loaded Express app for Vercel');
  
} catch (error) {
  console.error('❌ Failed to load application:', error.message);
  console.error('Stack:', error.stack);
  
  // Fallback error handler
  app = (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: 'The application failed to start. Please check the build logs.',
      timestamp: new Date().toISOString(),
      details: {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  };
}

// Export for Vercel
module.exports = app;