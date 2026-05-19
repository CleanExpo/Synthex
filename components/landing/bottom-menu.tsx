'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Home, BarChart2, Zap, Settings, Bell } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  badge?: number;
}

interface BottomMenuProps {
  items?: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

const defaultItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart2 className="w-5 h-5" />,
  },
  { id: 'campaigns', label: 'Campaigns', icon: <Zap className="w-5 h-5" /> },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <Bell className="w-5 h-5" />,
    badge: 3,
  },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const BottomMenu = ({
  items = defaultItems,
  activeId,
  onSelect,
  className,
}: BottomMenuProps) => {
  const [active, setActive] = React.useState<string>(
    activeId || items[0]?.id || ''
  );

  const handleSelect = (id: string) => {
    setActive(id);
    onSelect?.(id);
  };

  return (
    <nav
      role="navigation"
      aria-label="Bottom navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-center justify-around',
        'h-16 px-2',
        'bg-charcoal-800/90 backdrop-blur-md',
        'border-t border-white/[0.06]',
        className
      )}
    >
      {items.map(item => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            aria-label={item.label}
            title={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1',
              'h-12 w-14 rounded-sm',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50',
              isActive ? 'text-orange-400' : 'text-white/40 hover:text-white/70'
            )}
          >
            {/* Active background glow */}
            {isActive && (
              <span
                className={cn(
                  'absolute inset-0 rounded-sm',
                  'bg-orange-500/[0.08] border-[0.5px] border-orange-500/20'
                )}
              />
            )}

            {/* Icon with badge */}
            <span className="relative z-10">
              {item.icon}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    'absolute -top-1 -right-1',
                    'flex items-center justify-center',
                    'min-w-[14px] h-[14px] px-0.5',
                    'rounded-full text-[9px] font-bold leading-none',
                    'bg-orange-500 text-charcoal-900'
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>

            {/* Label */}
            <span
              className={cn(
                'relative z-10 text-[10px] font-medium tracking-wide',
                'transition-opacity duration-200',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
              )}
            >
              {item.label}
            </span>

            {/* Active dot indicator */}
            {isActive && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

BottomMenu.displayName = 'BottomMenu';

export { BottomMenu };
export type { NavItem, BottomMenuProps };
export default BottomMenu;
