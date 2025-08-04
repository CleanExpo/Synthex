// Vercel serverless function handler
// This file serves as the entry point for Vercel serverless functions

let app;

try {
  // Try to load the compiled version
  app = require('../dist/index.js');
} catch (error) {
  console.error('Failed to load dist/index.js:', error.message);
  
  // Fallback error handler
  app = (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: 'The application failed to start. Please check the build logs.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  };
}

module.exports = app;