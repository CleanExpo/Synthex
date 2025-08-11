#!/usr/bin/env node

/**
 * Standalone WebSocket Server Script
 * Run this separately from your Next.js app for production WebSocket support
 * 
 * Usage:
 * npm run ws:dev    (development)
 * npm run ws:prod   (production)
 * 
 * Or directly:
 * npx tsx scripts/websocket-server.ts
 */

import { SynthexWebSocketServer } from '../lib/websocket/server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.WS_PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`🚀 Starting WebSocket server in ${NODE_ENV} mode...`);
console.log(`📡 Port: ${PORT}`);

// Create WebSocket server
const wsServer = new SynthexWebSocketServer(PORT);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  wsServer.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  wsServer.shutdown();
  process.exit(0);
});

// Example usage: Send periodic test notifications in development
if (NODE_ENV === 'development') {
  let notificationCount = 0;
  
  const testNotifications = [
    {
      title: '✅ Campaign Success',
      message: 'Your social media campaign has exceeded engagement targets!',
      type: 'success' as const,
    },
    {
      title: '⚠️ Budget Alert',
      message: 'Campaign "Summer Sale" has reached 80% of allocated budget.',
      type: 'warning' as const,
    },
    {
      title: '📈 New Analytics',
      message: 'Weekly performance report is now available.',
      type: 'info' as const,
    },
    {
      title: '🔴 API Error',
      message: 'Failed to sync data with Instagram. Please check your connection.',
      type: 'error' as const,
    },
  ];
  
  // Send test notification every 30 seconds in development
  const testInterval = setInterval(() => {
    const stats = wsServer.getStats();
    
    if (stats.connectedClients > 0) {
      const notification = testNotifications[notificationCount % testNotifications.length];
      
      console.log(`📢 Sending test notification: ${notification.title}`);
      
      wsServer.sendNotification(
        { channel: 'global' },
        notification
      );
      
      notificationCount++;
    }
  }, 30000); // Every 30 seconds

  // Clear interval on shutdown
  process.on('SIGINT', () => clearInterval(testInterval));
  process.on('SIGTERM', () => clearInterval(testInterval));
}

// Log server statistics every 5 minutes
const statsInterval = setInterval(() => {
  const stats = wsServer.getStats();
  console.log(`📊 WebSocket Stats: ${stats.connectedClients} clients, ${stats.channels} channels, ${stats.totalSubscriptions} subscriptions`);
}, 5 * 60 * 1000);

process.on('SIGINT', () => clearInterval(statsInterval));
process.on('SIGTERM', () => clearInterval(statsInterval));

console.log('✅ WebSocket server started successfully!');
console.log('💡 Connect your client to: ws://localhost:3001/ws');

if (NODE_ENV === 'development') {
  console.log('🧪 Development mode: Test notifications will be sent every 30 seconds');
  console.log('🔧 Use the WebSocket demo page to test real-time features');
}