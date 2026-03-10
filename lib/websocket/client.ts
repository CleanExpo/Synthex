/**
 * WebSocket client for real-time notifications
 */

import { toast } from 'sonner';

export interface WebSocketMessage {
  type: 'notification' | 'update' | 'error' | 'ping' | 'pong' | 'subscribe' | 'unsubscribe';
  data?: unknown;
  channel?: string;
  id?: string;
  timestamp?: string;
  userId?: string;
}

export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  actionUrl?: string;
  actionText?: string;
  persistent?: boolean;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(token?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = token ? `${this.url}?token=${token}` : this.url;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.isReconnecting = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
    }
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle WebSocket open
   */
  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
    
    this.emit('connected');
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'notification':
          this.handleNotification(message.data as NotificationData);
          break;
          
        case 'update':
          this.emit('update', message.data);
          break;
          
        case 'error':
          console.error('WebSocket error:', message.data);
          this.emit('error', message.data);
          break;
          
        case 'ping':
          this.send({ type: 'pong' });
          break;
          
        case 'pong':
          // Heartbeat response received
          break;
          
        case 'subscribe':
          this.emit('subscribed', message.channel);
          break;
          
        case 'unsubscribe':
          this.emit('unsubscribed', message.channel);
          break;
          
        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle notifications
   */
  private handleNotification(data: NotificationData): void {
    const { title, message, type, actionUrl, actionText, persistent } = data;
    
    // Show toast notification
    const toastAction = actionUrl && actionText ? {
      altText: actionText,
      onClick: () => {
        window.open(actionUrl, '_blank');
      },
    } : undefined;

    switch (type) {
      case 'success':
        toast.success(`${title}: ${message}`);
        break;
        
      case 'error':
        toast.error(`${title}: ${message}`);
        break;
        
      case 'warning':
        toast.warning(`${title}: ${message}`);
        break;
        
      default:
        toast.info(`${title}: ${message}`);
    }

    // Show browser notification if persistent and permission granted
    if (persistent && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: `synthex-${Date.now()}`,
      });
    }
    
    this.emit('notification', data);
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(event: CloseEvent): void {
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.emit('disconnected', { code: event.code, reason: event.reason });
    
    // Attempt to reconnect unless it was a clean close
    if (event.code !== 1000 && !this.isReconnecting) {
      this.handleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.emit('error', event);
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    
    this.isReconnecting = true;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Get current connection state
   */
  public getState(): string {
    if (!this.ws) return 'CLOSED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Check if WebSocket is available in the current environment.
 * Returns false in production when no NEXT_PUBLIC_WS_URL is configured
 * (Vercel is serverless — no persistent WS server).
 */
export function isWebSocketAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  // In production, only connect if an explicit WS URL is set
  if (process.env.NODE_ENV === 'production' && !wsUrl) return false;
  return true;
}

/**
 * Get WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}

/**
 * Initialize WebSocket connection
 */
export function initializeWebSocket(token?: string): WebSocketClient {
  const client = getWebSocketClient();
  client.connect(token);
  return client;
}

export default WebSocketClient;