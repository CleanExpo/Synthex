/**
 * Unified Notifications Hook
 *
 * @description Real-time notifications with automatic fallback
 * - Tries WebSocket first (best for dedicated servers)
 * - Falls back to SSE (works on serverless like Vercel)
 * - Gracefully degrades to polling if both fail
 *
 * Usage:
 * ```tsx
 * const { notifications, unreadCount, isConnected, markAsRead } = useNotifications({
 *   onNotification: (n) => console.log('New:', n),
 * });
 * ```
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'mention' | 'engagement' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  expiresAt?: Date;
  read: boolean;
  actionUrl?: string;
}

export type ConnectionMethod = 'websocket' | 'sse' | 'polling' | 'none';

export interface UseNotificationsOptions {
  /**
   * Auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;

  /**
   * JWT token for authentication
   */
  token?: string;

  /**
   * Filter by notification types
   */
  types?: Notification['type'][];

  /**
   * Minimum priority to receive
   */
  minPriority?: 'low' | 'normal' | 'high' | 'urgent';

  /**
   * Show toast notifications automatically
   * @default true
   */
  showToasts?: boolean;

  /**
   * Enable browser notifications
   * @default false
   */
  browserNotifications?: boolean;

  /**
   * Polling interval when falling back to polling (ms)
   * @default 30000
   */
  pollingInterval?: number;

  /**
   * Callback when a notification is received
   */
  onNotification?: (notification: Notification) => void;

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (method: ConnectionMethod, connected: boolean) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

export interface UseNotificationsReturn {
  // State
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  connectionMethod: ConnectionMethod;

  // Actions
  connect: () => void;
  disconnect: () => void;
  markAsRead: (notificationId: string | 'all') => Promise<void>;
  clearNotifications: () => void;
  refreshNotifications: () => Promise<void>;

  // Status
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    autoConnect = true,
    token,
    types,
    minPriority,
    showToasts = true,
    browserNotifications = false,
    pollingInterval = 30000,
    onNotification,
    onConnectionChange,
    onError,
  } = options;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(true);

  // Build SSE URL with query params
  const buildSSEUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (types?.length) params.set('types', types.join(','));
    if (minPriority) params.set('minPriority', minPriority);

    const queryString = params.toString();
    return `/api/notifications/stream${queryString ? `?${queryString}` : ''}`;
  }, [types, minPriority]);

  // Handle incoming notification
  const handleNotification = useCallback(
    (notification: Notification) => {
      if (!mountedRef.current) return;

      // Add to state
      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === notification.id);
        if (exists) return prev;
        return [notification, ...prev].slice(0, 100); // Keep last 100
      });

      // Update unread count
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }

      // Show toast
      if (showToasts) {
        const toastFn = {
          success: toast.success,
          error: toast.error,
          warning: toast.warning,
          info: toast.info,
          mention: toast.info,
          engagement: toast.success,
          system: toast.info,
        }[notification.type] || toast.info;

        toastFn(`${notification.title}: ${notification.message}`);
      }

      // Show browser notification
      if (
        browserNotifications &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new window.Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
        });
      }

      // Call callback
      onNotification?.(notification);
    },
    [showToasts, browserNotifications, onNotification]
  );

  // Connect via SSE
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) return;
    if (typeof window === 'undefined') return;

    try {
      const url = buildSSEUrl();
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionMethod('sse');
        setError(null);
        onConnectionChange?.('sse', true);
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const notification = JSON.parse(event.data) as Notification;
          // Parse date strings to Date objects
          notification.createdAt = new Date(notification.createdAt);
          if (notification.expiresAt) {
            notification.expiresAt = new Date(notification.expiresAt);
          }
          handleNotification(notification);
        } catch (err) {
          console.error('Failed to parse SSE notification:', err);
        }
      };

      eventSource.onerror = (err) => {
        if (!mountedRef.current) return;
        console.error('SSE error:', err);
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        onConnectionChange?.('sse', false);

        // Fall back to polling
        startPolling();
      };

      // Handle connected event
      eventSource.addEventListener('connected', () => {
        // Connection established — no action needed
      });
    } catch (err) {
      console.error('Failed to create SSE connection:', err);
      setError(err as Error);
      onError?.(err as Error);

      // Fall back to polling
      startPolling();
    }
  }, [buildSSEUrl, handleNotification, onConnectionChange, onError]);

  // Fetch notifications via polling
  const fetchNotifications = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const response = await fetch('/api/notifications', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }

      const data = await response.json();

      if (!mountedRef.current) return;

      if (data.notifications) {
        setNotifications(
          data.notifications.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined,
          }))
        );
      }

      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err as Error);
    }
  }, []);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setConnectionMethod('polling');
    onConnectionChange?.('polling', true);

    // Initial fetch
    fetchNotifications();

    // Set up interval
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, pollingInterval);
  }, [fetchNotifications, pollingInterval, onConnectionChange]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect (tries SSE, falls back to polling)
  const connect = useCallback(() => {
    if (isConnectingRef.current || isConnected) return;
    isConnectingRef.current = true;

    // Request browser notification permission if enabled
    if (
      browserNotifications &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }

    // Try SSE (WebSocket would be used via useWebSocket hook separately)
    connectSSE();

    isConnectingRef.current = false;
  }, [isConnected, browserNotifications, connectSSE]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Close SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Stop polling
    stopPolling();

    setIsConnected(false);
    setConnectionMethod('none');
    onConnectionChange?.('none', false);
  }, [stopPolling, onConnectionChange]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string | 'all') => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          notificationId,
          action: 'markRead',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state
      if (notificationId === 'all') {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      setError(err as Error);
    }
  }, []);

  // Clear all notifications (local only)
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Refresh notifications from server
  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
    setIsLoading(false);
  }, [fetchNotifications]);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect]); // Only depend on autoConnect to avoid reconnection loops

  // Reconnect on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && autoConnect) {
        connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, autoConnect, connect]);

  // Initial notification fetch
  useEffect(() => {
    if (autoConnect) {
      refreshNotifications();
    }
  }, []); // Only on mount

  return {
    // State
    notifications,
    unreadCount,
    isConnected,
    connectionMethod,

    // Actions
    connect,
    disconnect,
    markAsRead,
    clearNotifications,
    refreshNotifications,

    // Status
    isLoading,
    error,
  };
}

export default useNotifications;
