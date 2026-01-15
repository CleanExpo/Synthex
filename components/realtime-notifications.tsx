'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, X, Check, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { realtimeService, RealtimeMessage } from '@/lib/realtime';
import toast from 'react-hot-toast';

// Simple auth hook replacement
function useUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  
  useEffect(() => {
    // For now, return a mock user or null
    // In production, this would check actual auth state
    const mockUser = typeof window !== 'undefined' && localStorage.getItem('user_id') 
      ? { id: localStorage.getItem('user_id')! }
      : null;
    setUser(mockUser);
  }, []);
  
  return user;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export default function RealtimeNotifications() {
  const user = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleNewNotification = useCallback((message: RealtimeMessage) => {
    const notification: Notification = {
      id: message.id,
      title: message.title || 'New Notification',
      message: message.content,
      type: (message.metadata?.type as any) || 'info',
      timestamp: message.timestamp,
      read: message.metadata?.read || false,
      actionUrl: message.metadata?.actionUrl
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification
      const toastMessage = `${notification.title}: ${notification.message}`;
      switch (notification.type) {
        case 'success':
          toast.success(toastMessage);
          break;
        case 'error':
          toast.error(toastMessage);
          break;
        case 'warning':
          toast(toastMessage, { icon: '⚠️' });
          break;
        default:
          toast(toastMessage);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to notifications channel
    const setupRealtime = async () => {
      const channel = await realtimeService.subscribeToChannel(
        `notifications:${user.id}`,
        {
          onMessage: handleNewNotification,
          onPresence: (presence) => {
            console.log('Presence update:', presence);
          }
        }
      );

      if (channel) {
        setIsConnected(true);
        
        // Subscribe to notification table changes
        realtimeService.subscribeToNotifications(user.id, (payload) => {
          if (payload.eventType === 'INSERT') {
            handleNewNotification({
              id: payload.new.id,
              type: 'notification',
              title: payload.new.title,
              content: payload.new.message,
              timestamp: new Date(payload.new.created_at),
              metadata: {
                type: payload.new.type,
                actionUrl: payload.new.action_url,
                read: payload.new.read
              }
            });
          }
        });

        // Get initial unread count
        const count = await realtimeService.getUnreadCount(user.id);
        setUnreadCount(count);
      }
    };

    setupRealtime();

    // Cleanup on unmount
    return () => {
      realtimeService.unsubscribe(`notifications:${user.id}`);
    };
  }, [handleNewNotification, user]);

  const markAsRead = async (notificationId: string) => {
    const success = await realtimeService.markNotificationsRead([notificationId]);
    if (success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    const success = await realtimeService.markNotificationsRead(unreadIds);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        {isConnected && (
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-h-[500px] glass-card z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAll}
                className="text-xs"
              >
                Clear all
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-white/5' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification.id);
                      }
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-white text-sm">
                            {notification.title}
                          </p>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1 break-words">
                          {notification.message}
                        </p>
                        {notification.actionUrl && (
                          <Button
                            size="sm"
                            variant="link"
                            className="p-0 h-auto text-purple-400 text-xs mt-2"
                          >
                            View details →
                          </Button>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
