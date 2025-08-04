// Vercel Serverless Function Handler for Synthex
// This properly handles the Express app in Vercel's serverless environment

const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let app;

try {
  // Load the Express app
  app = require('../dist/index.js');
  
  // Vercel expects a default export function for serverless
  if (typeof app === 'object' && app.handle) {
    // Express app detected
    module.exports = (req, res) => {
      // Handle the request with Express
      app(req, res);
    };
  } else if (typeof app === 'function') {
    // Already a function, use as-is
    module.exports = app;
  } else {
    throw new Error('Invalid app export from dist/index.js');
  }
} catch (error) {
  console.error('Failed to initialize app:', error);
  
  // Fallback handler for errors
  module.exports = (req, res) => {
    const errorDetails = {
      error: 'Server Initialization Failed',
      message: 'The application failed to start properly.',
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    };
    
    // Add detailed error in development
    if (process.env.NODE_ENV === 'development') {
      errorDetails.details = error.message;
      errorDetails.stack = error.stack;
    }
    
    res.status(500).json(errorDetails);
  };
}