/**
 * WebSocket integration exports
 */

// Client exports
export { 
  getWebSocketClient, 
  initializeWebSocket,
  type WebSocketMessage,
  type NotificationData 
} from './client';

// Server exports (for separate WebSocket server setup)
export { 
  getWebSocketServer,
  type ConnectedClient 
} from './server';

// Re-export default client
export { default as WebSocketClient } from './client';
export { default as SynthexWebSocketServer } from './server';