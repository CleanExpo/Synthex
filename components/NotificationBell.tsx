'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  icon?: string;
  action?: {
    label: string;
    url: string;
  };
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load initial notifications
  useEffect(() => {
    loadNotifications();
    
    // Set up polling for new notifications
    const interval = setInterval(checkForNewNotifications, 30000);
    
    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        updateUnreadCount(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Use mock data for now
      const mockNotifications: Notification[] = [
        {
          id: '1',
          message: 'Your content reached 10K views!',
          type: 'success',
          timestamp: new Date(),
          read: false,
          icon: '🎉'
        },
        {
          id: '2',
          message: 'New team member joined',
          type: 'info',
          timestamp: new Date(Date.now() - 3600000),
          read: false,
          icon: '👤'
        },
        {
          id: '3',
          message: 'Schedule optimized for peak engagement',
          type: 'success',
          timestamp: new Date(Date.now() - 7200000),
          read: true,
          icon: '📈'
        }
      ];
      setNotifications(mockNotifications);
      updateUnreadCount(mockNotifications);
    }
  };

  const checkForNewNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?unread=true');
      if (response.ok) {
        const data = await response.json();
        if (data.hasNew) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 1000);
          await loadNotifications();
        }
      }
    } catch (error) {
      console.error('Failed to check notifications:', error);
    }
  };

  const updateUnreadCount = (notifs: Notification[]) => {
    const count = notifs.filter(n => !n.read).length;
    setUnreadCount(count);
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      updateUnreadCount(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getTypeStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'border-green-500/20 bg-green-500/5';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'error':
        return 'border-red-500/20 bg-red-500/5';
      default:
        return 'border-purple-500/20 bg-purple-500/5';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative transition-all duration-300",
          isAnimating && "animate-pulse scale-110"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className={cn(
          "h-5 w-5 transition-all duration-300",
          isAnimating && "animate-bounce"
        )} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-purple-500 text-[10px] font-medium text-white flex items-center justify-center animate-in zoom-in duration-300">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 max-h-96 overflow-hidden rounded-lg glass-card border border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-400">{unreadCount} unread</span>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer",
                    !notification.read && "bg-purple-500/5",
                    getTypeStyles(notification.type)
                  )}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    {notification.icon && (
                      <span className="text-2xl">{notification.icon}</span>
                    )}
                    <div className="flex-1">
                      <p className={cn(
                        "text-sm",
                        notification.read ? "text-gray-400" : "text-white"
                      )}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </p>
                      {notification.action && (
                        <a
                          href={notification.action.url}
                          className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block"
                        >
                          {notification.action.label} →
                        </a>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <Button 
                variant="ghost" 
                className="w-full text-xs text-gray-400 hover:text-white"
                onClick={() => setNotifications([])}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}