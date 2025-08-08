/**
 * WebSocket Client Service
 * Handles client-side WebSocket connections and event management
 */

import { io } from 'socket.io-client';

// WebSocket client configuration
const WS_CONFIG = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  forceNew: false
};

// Event types (matching server)
export const WS_EVENTS = {
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_ERROR: 'auth_error',
  NOTIFICATION: 'notification',
  NOTIFICATION_READ: 'notification_read',
  OPTIMIZATION_START: 'optimization_start',
  OPTIMIZATION_PROGRESS: 'optimization_progress',
  OPTIMIZATION_COMPLETE: 'optimization_complete',
  OPTIMIZATION_ERROR: 'optimization_error',
  SYSTEM_STATUS: 'system_status',
  USER_COUNT: 'user_count',
  METRICS_UPDATE: 'metrics_update',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_TYPING: 'user_typing',
  CONTENT_SHARED: 'content_shared'
};

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.eventHandlers = new Map();
    this.authToken = null;
    this.user = null;
    
    // Auto-connect if token is available
    this.checkAndConnect();
  }

  // Initialize connection
  connect(token = null) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    this.authToken = token || this.getStoredToken();
    
    if (!this.authToken) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    const wsUrl = this.getWebSocketUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    this.socket = io(wsUrl, WS_CONFIG);
    this.setupEventHandlers();
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isAuthenticated = false;
    }
  }

  // Set up core event handlers
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Authenticate immediately after connection
      this.authenticate();
      
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.isAuthenticated = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.emit('connectionError', error);
    });

    // Authentication events
    this.socket.on(WS_EVENTS.AUTHENTICATED, (data) => {
      console.log('WebSocket authenticated', data.user);
      this.isAuthenticated = true;
      this.user = data.user;
      this.emit('authenticated', data);
    });

    this.socket.on(WS_EVENTS.AUTHENTICATION_ERROR, (error) => {
      console.error('WebSocket authentication error:', error);
      this.isAuthenticated = false;
      this.emit('authenticationError', error);
    });

    // Application events
    this.socket.on(WS_EVENTS.NOTIFICATION, (notification) => {
      console.log('Received notification:', notification);
      this.emit('notification', notification);
      this.handleNotification(notification);
    });

    this.socket.on(WS_EVENTS.OPTIMIZATION_PROGRESS, (data) => {
      this.emit('optimizationProgress', data);
    });

    this.socket.on(WS_EVENTS.OPTIMIZATION_COMPLETE, (data) => {
      console.log('Optimization completed:', data.requestId);
      this.emit('optimizationComplete', data);
    });

    this.socket.on(WS_EVENTS.OPTIMIZATION_ERROR, (data) => {
      console.error('Optimization error:', data);
      this.emit('optimizationError', data);
    });

    this.socket.on(WS_EVENTS.SYSTEM_STATUS, (status) => {
      this.emit('systemStatus', status);
    });

    this.socket.on(WS_EVENTS.USER_COUNT, (count) => {
      this.emit('userCount', count);
    });

    this.socket.on(WS_EVENTS.CONTENT_SHARED, (data) => {
      console.log('Content shared:', data);
      this.emit('contentShared', data);
    });
  }

  // Authenticate with server
  authenticate() {
    if (!this.socket || !this.authToken) {
      console.warn('Cannot authenticate - no socket or token');
      return;
    }

    this.socket.emit(WS_EVENTS.AUTHENTICATE, {
      token: this.authToken
    });
  }

  // Send optimization start event
  startOptimization(platform, content, requestId) {
    if (!this.isAuthenticated) {
      console.warn('Cannot start optimization - not authenticated');
      return false;
    }

    this.socket.emit(WS_EVENTS.OPTIMIZATION_START, {
      platform,
      content,
      requestId: requestId || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    return true;
  }

  // Mark notification as read
  markNotificationRead(notificationId) {
    if (!this.isAuthenticated) return false;

    this.socket.emit(WS_EVENTS.NOTIFICATION_READ, {
      notificationId
    });

    return true;
  }

  // Share content with others
  shareContent(content, platform, shareWith = 'public') {
    if (!this.isAuthenticated) return false;

    this.socket.emit(WS_EVENTS.CONTENT_SHARED, {
      content,
      platform,
      shareWith
    });

    return true;
  }

  // Send typing indicator
  sendTypingIndicator(roomId, isTyping) {
    if (!this.isAuthenticated) return false;

    this.socket.emit(WS_EVENTS.USER_TYPING, {
      roomId,
      isTyping
    });

    return true;
  }

  // Event handler management
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  // Handle incoming notifications
  handleNotification(notification) {
    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        data: notification.data
      });
    }

    // Store notification locally
    this.storeNotification(notification);
  }

  // Utility methods
  getWebSocketUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3000';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:3000';
    
    return `${protocol}//${host}`;
  }

  getStoredToken() {
    if (typeof window === 'undefined') return null;
    
    // Try to get token from localStorage
    return localStorage.getItem('synthex_token') || 
           localStorage.getItem('token') ||
           sessionStorage.getItem('synthex_token');
  }

  storeNotification(notification) {
    try {
      const notifications = JSON.parse(
        localStorage.getItem('synthex_notifications') || '[]'
      );
      
      notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (notifications.length > 50) {
        notifications.splice(50);
      }
      
      localStorage.setItem('synthex_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  getStoredNotifications() {
    try {
      return JSON.parse(localStorage.getItem('synthex_notifications') || '[]');
    } catch (error) {
      console.error('Failed to get stored notifications:', error);
      return [];
    }
  }

  clearStoredNotifications() {
    localStorage.removeItem('synthex_notifications');
  }

  // Auto-connection logic
  checkAndConnect() {
    if (typeof window === 'undefined') return;
    
    // Check if we have a token and should auto-connect
    const token = this.getStoredToken();
    const autoConnect = localStorage.getItem('synthex_ws_autoconnect') !== 'false';
    
    if (token && autoConnect) {
      setTimeout(() => {
        this.connect(token);
      }, 1000); // Small delay to ensure page is loaded
    }
  }

  // Connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      user: this.user,
      reconnectAttempts: this.reconnectAttempts,
      hasSocket: !!this.socket
    };
  }

  // Request browser notification permission
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  // Enable/disable auto-connection
  setAutoConnect(enabled) {
    localStorage.setItem('synthex_ws_autoconnect', enabled.toString());
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();

// Export convenience methods
export const {
  connect,
  disconnect,
  startOptimization,
  markNotificationRead,
  shareContent,
  sendTypingIndicator,
  on,
  off,
  getConnectionStatus,
  requestNotificationPermission,
  setAutoConnect
} = wsClient;

export default wsClient;