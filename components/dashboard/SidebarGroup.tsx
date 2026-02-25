'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from '@/components/icons';
import Link from 'next/link';

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

  // Auto-expand if any item in the group is active
  useEffect(() => {
    const isActiveGroup = items.some((item) => pathname === item.href || pathname.startsWith(item.href));
    if (isActiveGroup && !isOpen) {
      setIsOpen(true);
    }
  }, [pathname, items, isOpen]);

  // Persist state to localStorage
  useEffect(() => {
    const key = `sidebar-group-${id}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setIsOpen(stored === 'true');
    }
  }, [id]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem(`sidebar-group-${id}`, newState.toString());
  };

  return (
    <div className="space-y-1">
      {/* Group Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      {/* Group Items */}
      {isOpen && (
        <div className="space-y-0.5 pl-2 border-l border-gray-700/50 ml-2">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const ItemIcon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border-l border-cyan-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                }`}
              >
                <ItemIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
