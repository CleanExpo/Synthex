/**
 * Main Application Entry Point
 * Bootstrap the complete 3-tier SYNTHEX application
 */

import app from './presentation/app';

// Start the application
if (require.main === module) {
  app.start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default app;