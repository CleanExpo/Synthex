/**
 * WebSocket Service for Real-time Features
 * Handles real-time notifications, live updates, and collaborative features
 */

import { Server } from 'socket.io';
import { redisService } from './redis.js';
import { verifyJWT } from './session.js';

// WebSocket configuration
const WS_CONFIG = {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://synthex.social', 'https://synthex.vercel.app']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
};

// Event types for real-time features
export const WS_EVENTS = {
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_ERROR: 'auth_error',
  
  // Notifications
  NOTIFICATION: 'notification',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_CLEAR: 'notification_clear',
  
  // Content optimization
  OPTIMIZATION_START: 'optimization_start',
  OPTIMIZATION_PROGRESS: 'optimization_progress',
  OPTIMIZATION_COMPLETE: 'optimization_complete',
  OPTIMIZATION_ERROR: 'optimization_error',
  
  // System status
  SYSTEM_STATUS: 'system_status',
  USER_COUNT: 'user_count',
  METRICS_UPDATE: 'metrics_update',
  
  // Collaboration
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_TYPING: 'user_typing',
  CONTENT_SHARED: 'content_shared',
  
  // Admin events
  DEPLOYMENT_STATUS: 'deployment_status',
  HEALTH_CHECK: 'health_check',
  ERROR_ALERT: 'error_alert'
};

class WebSocketService {
  constructor() {
    this.io = null;
    this.server = null;
    this.authenticatedUsers = new Map();
    this.userRooms = new Map();
    this.isInitialized = false;
  }

  // Initialize WebSocket server
  initialize(httpServer) {
    if (this.isInitialized) return this.io;

    this.server = httpServer;
    this.io = new Server(httpServer, WS_CONFIG);

    this.setupEventHandlers();
    this.setupRedisSubscriptions();
    this.isInitialized = true;

    console.log('WebSocket service initialized');
    return this.io;
  }

  // Set up main event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);

      // Handle authentication
      socket.on(WS_EVENTS.AUTHENTICATE, async (data) => {
        await this.handleAuthentication(socket, data);
      });

      // Handle notifications
      socket.on(WS_EVENTS.NOTIFICATION_READ, async (data) => {
        await this.handleNotificationRead(socket, data);
      });

      // Handle optimization events
      socket.on(WS_EVENTS.OPTIMIZATION_START, async (data) => {
        await this.handleOptimizationStart(socket, data);
      });

      // Handle user activity
      socket.on(WS_EVENTS.USER_TYPING, (data) => {
        this.handleUserTyping(socket, data);
      });

      // Handle content sharing
      socket.on(WS_EVENTS.CONTENT_SHARED, async (data) => {
        await this.handleContentSharing(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Send initial system status
      this.sendSystemStatus(socket);
    });
  }

  // Set up Redis subscriptions for cross-server communication
  async setupRedisSubscriptions() {
    if (!redisService.isConnected) return;

    // Subscribe to notification broadcasts
    await redisService.subscribe('notifications', (message) => {
      this.broadcastToUser(message.userId, WS_EVENTS.NOTIFICATION, message.data);
    });

    // Subscribe to system alerts
    await redisService.subscribe('system_alerts', (message) => {
      this.broadcast(WS_EVENTS.SYSTEM_STATUS, message);
    });

    // Subscribe to deployment updates
    await redisService.subscribe('deployment', (message) => {
      this.broadcastToAdmins(WS_EVENTS.DEPLOYMENT_STATUS, message);
    });

    console.log('WebSocket Redis subscriptions set up');
  }

  // Handle user authentication
  async handleAuthentication(socket, data) {
    try {
      const { token } = data;
      
      if (!token) {
        socket.emit(WS_EVENTS.AUTHENTICATION_ERROR, { message: 'Token required' });
        return;
      }

      const user = await verifyJWT(token, true);
      
      if (!user) {
        socket.emit(WS_EVENTS.AUTHENTICATION_ERROR, { message: 'Invalid token' });
        return;
      }

      // Store authenticated user
      this.authenticatedUsers.set(socket.id, {
        id: user.userId,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        plan: user.plan || 'free',
        permissions: user.permissions || [],
        connectedAt: new Date().toISOString()
      });

      // Join user-specific room
      const userRoom = `user:${user.userId}`;
      socket.join(userRoom);
      this.userRooms.set(socket.id, userRoom);

      // Join plan-specific room
      const planRoom = `plan:${user.plan || 'free'}`;
      socket.join(planRoom);

      // If admin, join admin room
      if (user.permissions?.includes('admin')) {
        socket.join('admins');
      }

      socket.emit(WS_EVENTS.AUTHENTICATED, {
        user: this.authenticatedUsers.get(socket.id),
        timestamp: new Date().toISOString()
      });

      // Broadcast user count update
      this.broadcastUserCount();
      
      console.log(`User authenticated: ${user.email} (${socket.id})`);

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      socket.emit(WS_EVENTS.AUTHENTICATION_ERROR, { message: 'Authentication failed' });
    }
  }

  // Handle notification read status
  async handleNotificationRead(socket, data) {
    const user = this.authenticatedUsers.get(socket.id);
    if (!user) return;

    try {
      const { notificationId } = data;
      
      // Mark notification as read in database
      // This would integrate with your notification system
      
      // Broadcast to user's other connections
      this.broadcastToUser(user.id, WS_EVENTS.NOTIFICATION_READ, {
        notificationId,
        readAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Failed to handle notification read:', error);
    }
  }

  // Handle optimization start
  async handleOptimizationStart(socket, data) {
    const user = this.authenticatedUsers.get(socket.id);
    if (!user) return;

    try {
      const { platform, content, requestId } = data;
      
      // Broadcast optimization start to user
      this.broadcastToUser(user.id, WS_EVENTS.OPTIMIZATION_START, {
        requestId,
        platform,
        status: 'started',
        timestamp: new Date().toISOString()
      });

      // You can integrate with your AI service here to track progress

    } catch (error) {
      console.error('Failed to handle optimization start:', error);
      this.sendToSocket(socket, WS_EVENTS.OPTIMIZATION_ERROR, {
        requestId: data.requestId,
        error: 'Failed to start optimization'
      });
    }
  }

  // Handle user typing indicator
  handleUserTyping(socket, data) {
    const user = this.authenticatedUsers.get(socket.id);
    if (!user) return;

    const { roomId, isTyping } = data;
    
    // Broadcast to room except sender
    socket.to(roomId).emit(WS_EVENTS.USER_TYPING, {
      userId: user.id,
      username: user.username,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }

  // Handle content sharing
  async handleContentSharing(socket, data) {
    const user = this.authenticatedUsers.get(socket.id);
    if (!user) return;

    try {
      const { content, platform, shareWith } = data;
      
      if (shareWith === 'public') {
        // Broadcast to all authenticated users
        this.broadcastToAuthenticated(WS_EVENTS.CONTENT_SHARED, {
          from: {
            id: user.id,
            username: user.username
          },
          content,
          platform,
          timestamp: new Date().toISOString()
        });
      } else if (Array.isArray(shareWith)) {
        // Send to specific users
        shareWith.forEach(userId => {
          this.broadcastToUser(userId, WS_EVENTS.CONTENT_SHARED, {
            from: {
              id: user.id,
              username: user.username
            },
            content,
            platform,
            timestamp: new Date().toISOString()
          });
        });
      }

    } catch (error) {
      console.error('Failed to handle content sharing:', error);
    }
  }

  // Handle disconnection
  handleDisconnection(socket) {
    const user = this.authenticatedUsers.get(socket.id);
    
    if (user) {
      console.log(`User disconnected: ${user.email} (${socket.id})`);
      
      // Clean up user data
      this.authenticatedUsers.delete(socket.id);
      this.userRooms.delete(socket.id);
      
      // Broadcast user count update
      this.broadcastUserCount();
      
      // Notify relevant rooms
      socket.broadcast.emit(WS_EVENTS.USER_LEFT, {
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`Unauthenticated client disconnected: ${socket.id}`);
    }
  }

  // Broadcast methods
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  broadcastToAuthenticated(event, data) {
    // Only send to authenticated users
    this.authenticatedUsers.forEach((user, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  broadcastToUser(userId, event, data) {
    const userRoom = `user:${userId}`;
    this.io.to(userRoom).emit(event, data);
  }

  broadcastToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  broadcastToAdmins(event, data) {
    this.io.to('admins').emit(event, data);
  }

  sendToSocket(socket, event, data) {
    socket.emit(event, data);
  }

  // Utility methods
  broadcastUserCount() {
    const authenticatedCount = this.authenticatedUsers.size;
    const totalConnections = this.io.sockets.sockets.size;
    
    this.broadcast(WS_EVENTS.USER_COUNT, {
      authenticated: authenticatedCount,
      total: totalConnections,
      timestamp: new Date().toISOString()
    });
  }

  async sendSystemStatus(socket) {
    try {
      // Get system health
      const redisHealth = await redisService.healthCheck();
      
      this.sendToSocket(socket, WS_EVENTS.SYSTEM_STATUS, {
        status: 'healthy',
        redis: redisHealth,
        connections: {
          total: this.io.sockets.sockets.size,
          authenticated: this.authenticatedUsers.size
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send system status:', error);
    }
  }

  // Notification helpers
  async sendNotification(userId, notification) {
    const notificationData = {
      id: notification.id || `notif_${Date.now()}`,
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      timestamp: new Date().toISOString(),
      read: false
    };

    // Send via WebSocket
    this.broadcastToUser(userId, WS_EVENTS.NOTIFICATION, notificationData);

    // Also publish to Redis for other server instances
    if (redisService.isConnected) {
      await redisService.publish('notifications', {
        userId,
        data: notificationData
      });
    }
  }

  // Optimization progress tracking
  updateOptimizationProgress(userId, requestId, progress) {
    this.broadcastToUser(userId, WS_EVENTS.OPTIMIZATION_PROGRESS, {
      requestId,
      progress: Math.min(Math.max(progress, 0), 100),
      timestamp: new Date().toISOString()
    });
  }

  completeOptimization(userId, requestId, result) {
    this.broadcastToUser(userId, WS_EVENTS.OPTIMIZATION_COMPLETE, {
      requestId,
      result,
      timestamp: new Date().toISOString()
    });
  }

  failOptimization(userId, requestId, error) {
    this.broadcastToUser(userId, WS_EVENTS.OPTIMIZATION_ERROR, {
      requestId,
      error: error.message || 'Optimization failed',
      timestamp: new Date().toISOString()
    });
  }

  // Admin features
  broadcastSystemAlert(alert) {
    this.broadcast(WS_EVENTS.SYSTEM_STATUS, {
      type: 'alert',
      level: alert.level || 'warning',
      message: alert.message,
      timestamp: new Date().toISOString()
    });
  }

  // Statistics
  getStats() {
    return {
      totalConnections: this.io?.sockets.sockets.size || 0,
      authenticatedUsers: this.authenticatedUsers.size,
      rooms: this.userRooms.size,
      initialized: this.isInitialized
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.io) {
      console.log('Shutting down WebSocket service...');
      
      // Notify all clients
      this.broadcast(WS_EVENTS.SYSTEM_STATUS, {
        type: 'maintenance',
        message: 'Server maintenance - reconnecting shortly',
        timestamp: new Date().toISOString()
      });

      // Close all connections
      this.io.close();
      this.isInitialized = false;
      
      console.log('WebSocket service shut down');
    }
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// Export convenience methods
export const {
  initialize,
  broadcast,
  broadcastToUser,
  sendNotification,
  updateOptimizationProgress,
  completeOptimization,
  failOptimization,
  getStats
} = webSocketService;

export default webSocketService;