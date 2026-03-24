/**
 * Unified Notifications Hook
 *
 * @description Notifications with SWR-style polling.
 * Polls /api/notifications at a configurable interval (default 5s).
 * This is reliable on Vercel Lambda — the previous SSE+in-memory approach
 * was silently broken because each Lambda invocation has isolated memory.
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
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'mention'
    | 'engagement'
    | 'system';
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
   * Polling interval for notification refresh (ms)
   * @default 5000
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
    pollingInterval = 5000,
    onNotification,
    onConnectionChange,
    onError,
  } = options;

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] =
    useState<ConnectionMethod>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(true);

  // Handle incoming notification
  const handleNotification = useCallback(
    (notification: Notification) => {
      if (!mountedRef.current) return;

      // Add to state
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        return [notification, ...prev].slice(0, 100); // Keep last 100
      });

      // Update unread count
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }

      // Show toast
      if (showToasts) {
        const toastFn =
          {
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

      if (data.data) {
        setNotifications(
          data.data.map((n: any) => ({
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

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setIsConnected(true);
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
    setIsConnected(false);
  }, []);

  // Connect via polling
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

    startPolling();

    isConnectingRef.current = false;
  }, [isConnected, browserNotifications, startPolling]);

  // Disconnect
  const disconnect = useCallback(() => {
    stopPolling();
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
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      } else {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
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
  // `connect` and `disconnect` are intentionally excluded — including them would trigger
  // reconnection on every render cycle, causing an infinite reconnect loop.
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

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

  // Initial notification fetch — intentionally runs only on mount; adding `autoConnect` or
  // `refreshNotifications` would cause repeated fetches on every connection state change.
  useEffect(() => {
    if (autoConnect) {
      refreshNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
