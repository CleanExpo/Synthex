'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Bell } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { fetchWithCSRF } from '@/lib/csrf';
import { fetchJson } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import { NotificationCentre } from '@/components/ui/NotificationCentre';
import { logger } from '@/lib/logger';

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
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [centreOpen, setCentreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);

  // SWR handles fetching and polling — refreshes every 30 seconds
  const { data, mutate } = useSWR('/api/notifications', fetchJson, {
    refreshInterval: 30000,
  });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;

  // Animate the bell when unread count increases
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Click-outside handler to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetchWithCSRF(`/api/notifications/${id}/read`, { method: 'PATCH' });
      mutate(); // revalidate SWR data
    } catch (error) {
      logger.error('Failed to mark as read:', error);
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
        return 'border-orange-500/20 bg-orange-500/5';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'relative transition-all duration-300',
          isAnimating && 'animate-pulse scale-110'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell
          className={cn(
            'h-5 w-5 transition-all duration-300',
            isAnimating && 'animate-bounce'
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-[10px] font-medium text-white flex items-center justify-center animate-in zoom-in duration-300">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 max-h-96 overflow-hidden rounded-lg bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-300">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer',
                    !notification.read && 'bg-orange-500/5',
                    getTypeStyles(notification.type)
                  )}
                  onClick={() =>
                    !notification.read && markAsRead(notification.id)
                  }
                >
                  <div className="flex items-start space-x-3">
                    {notification.icon && (
                      <span className="text-2xl">{notification.icon}</span>
                    )}
                    <div className="flex-1">
                      <p
                        className={cn(
                          'text-sm',
                          notification.read ? 'text-gray-300' : 'text-white'
                        )}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </p>
                      {notification.action && (
                        <a
                          href={notification.action.url}
                          className="text-xs text-orange-400 hover:text-orange-300 mt-2 inline-block"
                        >
                          {notification.action.label} →
                        </a>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/10 flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 text-xs text-gray-300 hover:text-white"
                onClick={() => mutate({ notifications: [] }, false)}
              >
                Clear all
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-xs text-orange-400 hover:text-orange-300"
                onClick={() => {
                  setIsOpen(false);
                  setCentreOpen(true);
                }}
              >
                View all
              </Button>
            </div>
          )}

          {notifications.length === 0 && (
            <div className="p-3 border-t border-white/10">
              <Button
                variant="ghost"
                className="w-full text-xs text-orange-400 hover:text-orange-300"
                onClick={() => {
                  setIsOpen(false);
                  setCentreOpen(true);
                }}
              >
                View all
              </Button>
            </div>
          )}
        </div>
      )}

      <NotificationCentre
        isOpen={centreOpen}
        onClose={() => {
          setCentreOpen(false);
          mutate(); // refresh badge count after panel closes
        }}
      />
    </div>
  );
}
