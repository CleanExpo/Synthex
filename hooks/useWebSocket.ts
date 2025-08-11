/**
 * React hook for WebSocket integration
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketClient, type WebSocketMessage, type NotificationData } from '@/lib/websocket/client';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  token?: string;
  onConnect?: () => void;
  onDisconnect?: (event: { code: number; reason: string }) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onNotification?: (notification: NotificationData) => void;
  onError?: (error: any) => void;
}

export interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  connectionState: string;
  reconnectCount: number;
  
  // Actions
  connect: (token?: string) => void;
  disconnect: () => void;
  send: (message: Omit<WebSocketMessage, 'timestamp'>) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  
  // Utilities
  sendNotification: (notification: NotificationData) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    token,
    onConnect,
    onDisconnect,
    onMessage,
    onNotification,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('CLOSED');
  const [reconnectCount, setReconnectCount] = useState(0);
  
  const wsClient = useRef(getWebSocketClient());
  const subscriptions = useRef(new Set<string>());

  // Update connection state
  const updateConnectionState = useCallback(() => {
    const state = wsClient.current.getState();
    setConnectionState(state);
    setIsConnected(state === 'OPEN');
  }, []);

  // Connect to WebSocket
  const connect = useCallback((authToken?: string) => {
    try {
      wsClient.current.connect(authToken || token);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      onError?.(error);
    }
  }, [token, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    try {
      subscriptions.current.clear();
      wsClient.current.disconnect();
      setIsConnected(false);
      setConnectionState('CLOSED');
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
    }
  }, []);

  // Send message
  const send = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    try {
      wsClient.current.send(message as WebSocketMessage);
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }, []);

  // Subscribe to channel
  const subscribe = useCallback((channel: string) => {
    if (!subscriptions.current.has(channel)) {
      subscriptions.current.add(channel);
      send({
        type: 'subscribe',
        channel,
      });
    }
  }, [send]);

  // Unsubscribe from channel
  const unsubscribe = useCallback((channel: string) => {
    if (subscriptions.current.has(channel)) {
      subscriptions.current.delete(channel);
      send({
        type: 'unsubscribe',
        channel,
      });
    }
  }, [send]);

  // Send notification (for testing/admin purposes)
  const sendNotification = useCallback((notification: NotificationData) => {
    send({
      type: 'notification',
      data: notification,
    });
  }, [send]);

  // Set up event listeners
  useEffect(() => {
    const client = wsClient.current;

    // Connection events
    const handleConnect = () => {
      updateConnectionState();
      setReconnectCount(0);
      onConnect?.();
    };

    const handleDisconnect = (event: { code: number; reason: string }) => {
      updateConnectionState();
      if (event.code !== 1000) {
        setReconnectCount(prev => prev + 1);
      }
      onDisconnect?.(event);
    };

    const handleMessage = (message: WebSocketMessage) => {
      onMessage?.(message);
    };

    const handleNotification = (notification: NotificationData) => {
      onNotification?.(notification);
    };

    const handleError = (error: any) => {
      updateConnectionState();
      onError?.(error);
    };

    // Add event listeners
    client.on('connected', handleConnect);
    client.on('disconnected', handleDisconnect);
    client.on('message', handleMessage);
    client.on('notification', handleNotification);
    client.on('error', handleError);

    // Auto-connect if enabled
    if (autoConnect && !client.isConnected()) {
      connect();
    }

    // Update initial state
    updateConnectionState();

    // Cleanup function
    return () => {
      client.off('connected', handleConnect);
      client.off('disconnected', handleDisconnect);
      client.off('message', handleMessage);
      client.off('notification', handleNotification);
      client.off('error', handleError);
    };
  }, [autoConnect, connect, updateConnectionState, onConnect, onDisconnect, onMessage, onNotification, onError]);

  // Auto-reconnect on page focus
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && autoConnect) {
        connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptions.current.clear();
      // Don't disconnect on unmount in case other components are using the same connection
    };
  }, []);

  return {
    // State
    isConnected,
    connectionState,
    reconnectCount,
    
    // Actions
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    
    // Utilities
    sendNotification,
  };
}

export default useWebSocket;