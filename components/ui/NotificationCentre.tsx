'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
  X,
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { fetchWithCSRF } from '@/lib/csrf';

// ── Types matching the API response exactly ──────────────────────────────────

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  data: unknown;
  createdAt: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

export interface NotificationCentreProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── SWR fetcher (credentials: include, per project convention) ────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_LABELS: Record<NotificationItem['type'], string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

function TypeIcon({
  type,
  className,
}: {
  type: NotificationItem['type'];
  className?: string;
}) {
  const base = cn('h-4 w-4 shrink-0 mt-0.5', className);
  switch (type) {
    case 'success':
      return <CheckCircle className={cn(base, 'text-green-400')} />;
    case 'warning':
      return <AlertTriangle className={cn(base, 'text-yellow-400')} />;
    case 'error':
      return <XCircle className={cn(base, 'text-red-400')} />;
    default:
      return <Info className={cn(base, 'text-orange-400')} />;
  }
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="h-4 w-4 rounded-full bg-white/10 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/5 rounded bg-white/10" />
        <div className="h-3 w-4/5 rounded bg-white/[0.06]" />
        <div className="h-2 w-1/4 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ── Individual notification item ─────────────────────────────────────────────

interface NotificationRowProps {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
}

function NotificationRow({ item, onMarkRead }: NotificationRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-white/[0.05] transition-colors duration-150',
        item.read
          ? 'bg-transparent hover:bg-white/[0.02]'
          : 'bg-white/[0.04] hover:bg-white/[0.07]'
      )}
      onClick={() => {
        if (!item.read) onMarkRead(item.id);
      }}
    >
      <TypeIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            item.read ? 'text-gray-300' : 'text-white'
          )}
        >
          {item.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {item.message}
        </p>
        <p className="text-[10px] text-gray-600 mt-1">
          {relativeTime(item.createdAt)}
        </p>
      </div>
      {!item.read && (
        <span className="mt-1.5 h-2 w-2 rounded-full bg-orange-500 shrink-0 animate-pulse" />
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationCentre({
  isOpen,
  onClose,
}: NotificationCentreProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when panel opens (accessibility)
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(
    isOpen ? '/api/notifications?limit=50' : null,
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const notifications = data?.data ?? [];

  // Group by type — preserve insertion order for types that appear
  const grouped = notifications.reduce<Record<string, NotificationItem[]>>(
    (acc, n) => {
      if (!acc[n.type]) acc[n.type] = [];
      acc[n.type].push(n);
      return acc;
    },
    {}
  );

  const groupEntries = Object.entries(grouped) as [
    NotificationItem['type'],
    NotificationItem[],
  ][];

  const handleMarkRead = async (id: string) => {
    // Optimistic update
    mutate(
      prev => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map(n => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, (prev.unreadCount ?? 1) - 1),
        };
      },
      { revalidate: false }
    );

    try {
      await fetchWithCSRF(`/api/notifications/${id}/read`, { method: 'PATCH' });
      // Revalidate after server confirms
      mutate();
    } catch {
      // Rollback optimistic update on failure
      mutate();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notification Centre"
          className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-black/80 backdrop-blur-2xl border-l border-white/[0.06] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">
                Notifications
              </h2>
              {(data?.unreadCount ?? 0) > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                  {data?.unreadCount} unread
                </span>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="rounded-md p-1.5 text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              // Loading skeleton — 3 placeholder items
              <div>
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
              </div>
            ) : notifications.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-16">
                <Bell className="h-10 w-10 text-gray-600" />
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-xs text-gray-600">
                  We&apos;ll let you know when something happens.
                </p>
              </div>
            ) : (
              // Grouped list
              groupEntries.map(([type, items]) => (
                <div key={type}>
                  <div className="sticky top-0 z-10 px-4 py-2 bg-black/60 backdrop-blur-sm border-b border-white/[0.04]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {TYPE_LABELS[type]}
                    </span>
                  </div>
                  {items.map(item => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
