/**
 * WebSocket Provider component for managing global WebSocket connection
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocket, type UseWebSocketReturn } from '@/hooks/useWebSocket';
import { isWebSocketAvailable } from '@/lib/websocket/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from '@/components/icons';
import { toast } from '@/hooks/useToast';

// WebSocket Context
const WebSocketContext = createContext<UseWebSocketReturn | null>(null);

// Provider Props
interface WebSocketProviderProps {
  children: React.ReactNode;
  token?: string;
  autoConnect?: boolean;
  showConnectionStatus?: boolean;
}

// Connection Status Component
function ConnectionStatus({ 
  isConnected, 
  connectionState, 
  reconnectCount, 
  onReconnect 
}: {
  isConnected: boolean;
  connectionState: string;
  reconnectCount: number;
  onReconnect: () => void;
}) {
  const getStatusColor = () => {
    switch (connectionState) {
      case 'OPEN':
        return 'bg-green-500';
      case 'CONNECTING':
        return 'bg-yellow-500';
      case 'CLOSING':
        return 'bg-orange-500';
      case 'CLOSED':
      default:
        return 'bg-red-500';
    }
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <Wifi className="h-4 w-4" />;
    } else if (connectionState === 'CONNECTING') {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    } else {
      return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center space-x-2">
      <Badge 
        variant="outline" 
        className={`flex items-center space-x-2 ${isConnected ? 'border-green-500' : 'border-red-500'}`}
      >
        {getStatusIcon()}
        <span className="text-xs">
          {isConnected ? 'Connected' : connectionState}
        </span>
        {reconnectCount > 0 && (
          <span className="text-xs text-muted-foreground">
            (Retry {reconnectCount})
          </span>
        )}
      </Badge>
      
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      
      {!isConnected && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReconnect}
          disabled={connectionState === 'CONNECTING'}
        >
          <RefreshCw className={`h-4 w-4 ${connectionState === 'CONNECTING' ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}

// Main Provider Component
export function WebSocketProvider({
  children,
  token,
  autoConnect = true,
  showConnectionStatus = false,
}: WebSocketProviderProps) {
  const [connectionLost, setConnectionLost] = useState(false);
  const wsAvailable = typeof window !== 'undefined' && isWebSocketAvailable();

  const webSocketReturn = useWebSocket({
    autoConnect: autoConnect && wsAvailable,
    token,
    onConnect: () => {
      if (connectionLost) {
        toast.success('Connection Restored', 'Real-time notifications are now active');
        setConnectionLost(false);
      }
    },
    onDisconnect: (event) => {
      if (event.code !== 1000) {
        setConnectionLost(true);
        toast.warning('Connection Lost', 'Attempting to reconnect...');
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection Error', 'Failed to connect to real-time services');
    },
    onNotification: (notification) => {
      
      // Request browser notification permission if not granted
      if (notification.persistent && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    },
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
      });
    }
  }, []);

  // Subscribe to user-specific channel if token is available
  useEffect(() => {
    if (webSocketReturn.isConnected && token) {
      try {
        // Extract user ID from token (simple decode, not secure)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId || payload.id;
        
        if (userId) {
          webSocketReturn.subscribe(`user:${userId}`);
          webSocketReturn.subscribe('global');
        }
      } catch (error) {
        console.error('Failed to extract user ID from token:', error);
        // Subscribe to global channel only
        webSocketReturn.subscribe('global');
      }
    }
  }, [webSocketReturn.isConnected, token, webSocketReturn]);

  return (
    <WebSocketContext.Provider value={webSocketReturn}>
      {children}
      {showConnectionStatus && (
        <ConnectionStatus
          isConnected={webSocketReturn.isConnected}
          connectionState={webSocketReturn.connectionState}
          reconnectCount={webSocketReturn.reconnectCount}
          onReconnect={() => webSocketReturn.connect(token)}
        />
      )}
    </WebSocketContext.Provider>
  );
}

// Hook to use WebSocket context
export function useWebSocketContext(): UseWebSocketReturn {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  
  return context;
}

// Notification sender hook (for admin/testing)
export function useNotificationSender() {
  const ws = useWebSocketContext();
  
  const sendTestNotification = (type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const notifications = {
      info: {
        title: 'Info Notification',
        message: 'This is an informational message',
        type: 'info' as const,
      },
      success: {
        title: 'Success!',
        message: 'Operation completed successfully',
        type: 'success' as const,
      },
      warning: {
        title: 'Warning',
        message: 'Something needs your attention',
        type: 'warning' as const,
      },
      error: {
        title: 'Error Occurred',
        message: 'Something went wrong',
        type: 'error' as const,
      },
    };
    
    ws.sendNotification(notifications[type]);
  };
  
  const sendCustomNotification = (
    title: string,
    message: string,
    options?: {
      type?: 'info' | 'success' | 'warning' | 'error';
      actionUrl?: string;
      actionText?: string;
      persistent?: boolean;
    }
  ) => {
    ws.sendNotification({
      title,
      message,
      type: 'info',
      ...options,
    });
  };
  
  return {
    sendTestNotification,
    sendCustomNotification,
    isConnected: ws.isConnected,
  };
}

export default WebSocketProvider;