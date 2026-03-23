'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from '@/components/icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

interface SidebarGroupProps {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: SidebarItem[];
  defaultOpen?: boolean;
}

export function SidebarGroup({
  id,
  icon: Icon,
  label,
  items,
  defaultOpen = false,
}: SidebarGroupProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Auto-expand when navigating to a page inside this group
  useEffect(() => {
    const isActiveGroup = items.some(
      item => pathname === item.href || pathname.startsWith(item.href + '/')
    );
    if (isActiveGroup && !isOpen) setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Persist open/closed state
  useEffect(() => {
    const key = `sidebar-group-${id}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) setIsOpen(stored === 'true');
  }, [id]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(`sidebar-group-${id}`, next.toString());
  };

  const hasActiveItem = items.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <div className="py-0.5">
      {/* Group header */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-sm transition-colors',
          'text-[9px] uppercase tracking-[0.25em] font-medium',
          hasActiveItem ? 'text-white/70' : 'text-white/55',
          'hover:text-white/60 hover:bg-white/[0.02]'
        )}
        aria-expanded={isOpen}
        aria-label={`${label} section`}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'w-3.5 h-3.5',
              hasActiveItem ? 'text-orange-400/70' : 'text-white/55'
            )}
          />
          <span>{label}</span>
        </div>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform text-white/55',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Group items */}
      {isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {items.map(item => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            const ItemIcon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-sm transition-all duration-150',
                  isActive
                    ? 'bg-white/[0.05] text-white border-[0.5px] border-white/[0.08]'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/[0.03]'
                )}
              >
                {/* Active indicator dot */}
                {isActive ? (
                  <div className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                ) : (
                  <ItemIcon className="w-3.5 h-3.5 flex-shrink-0 text-white/55" />
                )}
                <span className="truncate tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
