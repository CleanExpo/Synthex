'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Edit,
  Calendar,
  TrendingUp,
  Users,
  Sparkles,
  Camera,
  Mic,
  FileText,
  Link2,
  Hash,
  Image,
  Video,
  Send,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/notifications';
import { useRouter } from 'next/navigation';

interface FABAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // Detect mobile device — uses matchMedia instead of resize listener for performance
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // FAB Actions
  const actions: FABAction[] = [
    {
      id: 'create-post',
      label: 'Create Post',
      icon: Edit,
      color: 'bg-blue-500',
      onClick: () => {
        router.push('/dashboard/content');
        setIsOpen(false);
        notify.success('Opening post creator...');
      },
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: Calendar,
      color: 'bg-green-500',
      onClick: () => {
        router.push('/dashboard/schedule');
        setIsOpen(false);
        notify.success('Opening scheduler...');
      },
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      color: 'bg-orange-500',
      onClick: () => {
        router.push('/dashboard/analytics');
        setIsOpen(false);
      },
    },
    {
      id: 'ai-generate',
      label: 'AI Generate',
      icon: Sparkles,
      color: 'bg-orange-500',
      onClick: () => {
        router.push('/dashboard/content?ai=true');
        setIsOpen(false);
        notify.custom('✨ AI Assistant ready!');
      },
    },
    {
      id: 'quick-photo',
      label: 'Photo',
      icon: Camera,
      color: 'bg-orange-500',
      onClick: () => {
        router.push('/dashboard/content?type=photo');
        setIsOpen(false);
      },
    },
    {
      id: 'quick-video',
      label: 'Video',
      icon: Video,
      color: 'bg-red-500',
      onClick: () => {
        router.push('/dashboard/content?type=video');
        setIsOpen(false);
      },
    },
  ];

  // Quick compose actions (simplified for mobile)
  const quickActions = [
    { icon: FileText, action: 'text' },
    { icon: Image, action: 'image' },
    { icon: Video, action: 'video' },
    { icon: Link2, action: 'link' },
    { icon: Hash, action: 'hashtag' },
  ];

  // Don't render on desktop
  if (!isMobile) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Actions */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 space-y-3">
          {actions.map(action => (
            <div
              key={action.id}
              className="flex items-center justify-end gap-3"
            >
              <span className="text-sm font-medium text-white bg-black/70 px-3 py-1 rounded-full">
                {action.label}
              </span>
              <button
                onClick={action.onClick}
                aria-label={action.label}
                className={`
                  w-12 h-12 rounded-full ${action.color}
                  flex items-center justify-center shadow-lg
                  transform transition-transform active:scale-95
                `}
              >
                <action.icon className="h-5 w-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transform transition-all duration-200
          ${
            isOpen
              ? 'bg-red-500 rotate-45'
              : 'bg-gradient-to-r from-orange-500 to-orange-500'
          }
        `}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div>
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </div>
      </button>

      {/* Quick Compose Bar (Alternative compact design) */}
      {!isOpen && (
        <div className="fixed bottom-6 left-6 right-20 z-40 md:hidden">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2 flex items-center justify-around">
            {quickActions.map(action => (
              <button
                key={action.action}
                onClick={() => {
                  router.push(`/dashboard/content?type=${action.action}`);
                  notify.custom(`Opening ${action.action} creator...`);
                }}
                aria-label={`Create ${action.action} content`}
                className="p-2 text-gray-300 hover:text-white transition-colors"
              >
                <action.icon className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Mini FAB for specific pages
export function MiniFAB({
  icon: Icon = Plus,
  onClick,
  className = '',
}: {
  icon?: React.ElementType;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label="Open quick action"
      className={`
        fixed bottom-6 right-6 z-40
        w-12 h-12 rounded-full
        bg-orange-500 shadow-lg
        flex items-center justify-center
        md:hidden
        ${className}
      `}
      onClick={onClick}
    >
      <Icon className="h-5 w-5 text-white" />
    </button>
  );
}

// Context-aware FAB
export function SmartFAB({ context }: { context?: string }) {
  const [suggestion, setSuggestion] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Smart suggestions based on context
    const hour = new Date().getHours();

    if (context === 'dashboard') {
      if (hour < 12) {
        setSuggestion('Schedule morning posts');
      } else if (hour < 17) {
        setSuggestion('Check analytics');
      } else {
        setSuggestion('Plan tomorrow');
      }
    } else if (context === 'analytics') {
      setSuggestion('Create viral content');
    } else if (context === 'schedule') {
      setSuggestion('Fill content gaps');
    }
  }, [context]);

  if (!suggestion) return <FloatingActionButton />;

  return (
    <div className="fixed bottom-20 right-6 z-40 md:hidden">
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-full flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-orange-400" />
        <span className="text-sm text-white">{suggestion}</span>
      </div>
      <FloatingActionButton />
    </div>
  );
}

// Draggable FAB
export function DraggableFAB() {
  return (
    <div className="fixed bottom-20 right-20 z-50 md:hidden">
      <div
        className={`
        w-14 h-14 rounded-full
        bg-gradient-to-r from-orange-500 to-orange-500
        shadow-2xl flex items-center justify-center
        cursor-pointer
      `}
      >
        <Plus className="h-6 w-6 text-white" />
      </div>
    </div>
  );
}
