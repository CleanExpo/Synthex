/**
 * WebSocket server for real-time notifications
 * This would typically run as a separate service or Next.js API route
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';

export interface WebSocketMessage {
  type: 'notification' | 'update' | 'error' | 'ping' | 'pong' | 'subscribe' | 'unsubscribe';
  data?: any;
  id?: string;
  timestamp?: string;
  userId?: string;
  channel?: string;
}

export interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
}

class SynthexWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private channels: Map<string, Set<WebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 3001) {
    this.wss = new WebSocketServer({
      port,
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    
    console.log(`WebSocket server running on port ${port}`);
  }

  /**
   * Verify client connection (authentication)
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        // Allow unauthenticated connections for now
        return true;
      }

      // Verify JWT token
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      jwt.verify(token, secret);
      
      return true;
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    console.log('New WebSocket connection');
    
    // Extract user ID from token if provided
    let userId: string | undefined;
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (token) {
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as any;
        userId = decoded.userId || decoded.id;
      }
    } catch (error) {
      console.error('Failed to extract user ID:', error);
    }

    // Register client
    const client: ConnectedClient = {
      ws,
      userId,
      subscriptions: new Set(),
      lastPing: new Date(),
    };
    
    this.clients.set(ws, client);

    // Set up event handlers
    ws.on('message', (data: Buffer) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleClose(ws));
    ws.on('error', (error) => this.handleError(ws, error));
    ws.on('pong', () => this.handlePong(ws));

    // Send welcome message
    this.sendToClient(ws, {
      type: 'notification',
      data: {
        title: 'Connected',
        message: 'Successfully connected to SYNTHEX real-time notifications',
        type: 'success',
      },
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const client = this.clients.get(ws);
      
      if (!client) return;

      switch (message.type) {
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(ws, { type: 'pong' });
          break;

        case 'subscribe':
          this.handleSubscribe(ws, message.channel);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.channel);
          break;

        default:
          console.log('Received message:', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  }

  /**
   * Handle client subscription to channel
   */
  private handleSubscribe(ws: WebSocket, channel?: string): void {
    if (!channel) return;

    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.add(channel);
    
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    
    this.channels.get(channel)!.add(ws);
    
    console.log(`Client subscribed to channel: ${channel}`);
  }

  /**
   * Handle client unsubscription from channel
   */
  private handleUnsubscribe(ws: WebSocket, channel?: string): void {
    if (!channel) return;

    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.delete(channel);
    this.channels.get(channel)?.delete(ws);
    
    console.log(`Client unsubscribed from channel: ${channel}`);
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(ws: WebSocket): void {
    console.log('WebSocket connection closed');
    const client = this.clients.get(ws);
    
    if (client) {
      // Remove from all channels
      client.subscriptions.forEach(channel => {
        this.channels.get(channel)?.delete(ws);
      });
    }
    
    this.clients.delete(ws);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(ws: WebSocket, error: Error): void {
    console.error('WebSocket error:', error);
    this.clients.delete(ws);
  }

  /**
   * Handle pong response
   */
  private handlePong(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      client.lastPing = new Date();
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client, ws) => {
      this.sendToClient(ws, message);
    });
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, message: WebSocketMessage): void {
    this.clients.forEach((client, ws) => {
      if (client.userId === userId) {
        this.sendToClient(ws, message);
      }
    });
  }

  /**
   * Send message to channel subscribers
   */
  public sendToChannel(channel: string, message: WebSocketMessage): void {
    const subscribers = this.channels.get(channel);
    if (subscribers) {
      subscribers.forEach(ws => {
        this.sendToClient(ws, message);
      });
    }
  }

  /**
   * Send notification to user or channel
   */
  public sendNotification(
    target: { userId?: string; channel?: string },
    notification: {
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      actionUrl?: string;
      actionText?: string;
      persistent?: boolean;
    }
  ): void {
    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        type: 'info',
        ...notification,
      },
    };

    if (target.userId) {
      this.sendToUser(target.userId, message);
    } else if (target.channel) {
      this.sendToChannel(target.channel, message);
    } else {
      this.broadcast(message);
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 60000; // 60 seconds

      this.clients.forEach((client, ws) => {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          console.log('Terminating dead connection');
          ws.terminate();
          this.clients.delete(ws);
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get server statistics
   */
  public getStats(): {
    connectedClients: number;
    channels: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    this.clients.forEach(client => {
      totalSubscriptions += client.subscriptions.size;
    });

    return {
      connectedClients: this.clients.size,
      channels: this.channels.size,
      totalSubscriptions,
    };
  }

  /**
   * Shutdown server
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach((client, ws) => {
      ws.close(1000, 'Server shutting down');
    });
    
    this.wss.close();
  }
}

// Export singleton instance for use in Next.js API routes
let wsServer: SynthexWebSocketServer | null = null;

export function getWebSocketServer(): SynthexWebSocketServer {
  if (!wsServer) {
    const port = parseInt(process.env.WS_PORT || '3001');
    wsServer = new SynthexWebSocketServer(port);
  }
  return wsServer;
}

export default SynthexWebSocketServer;