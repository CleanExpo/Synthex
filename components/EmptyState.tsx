import React from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  BarChart3,
  Calendar,
  Users,
  Sparkles,
  Plus,
  Upload,
  Search,
  Inbox,
  Link2,
} from '@/components/icons';
import { MascotCard } from '@/components/mascots/MascotCard';
import { useMascot, type MascotContext } from '@/hooks/use-mascot';

// ---------------------------------------------------------------------------
// Inline SVG illustrations — amber-only palette, no cyan / green / blue
// ---------------------------------------------------------------------------

/** Analytics zero-data illustration: empty bar chart with amber accent */
function AnalyticsIllustration() {
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      fill="none"
      aria-hidden="true"
      className="mx-auto mb-2 opacity-60"
    >
      {/* Grid lines */}
      <line
        x1="10"
        y1="70"
        x2="110"
        y2="70"
        stroke="#D97706"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.3"
      />
      <line
        x1="10"
        y1="50"
        x2="110"
        y2="50"
        stroke="#D97706"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.2"
      />
      <line
        x1="10"
        y1="30"
        x2="110"
        y2="30"
        stroke="#D97706"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.15"
      />
      {/* Empty bar outlines — no data yet */}
      <rect
        x="15"
        y="40"
        width="18"
        height="30"
        rx="3"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
        strokeDasharray="4 3"
      />
      <rect
        x="40"
        y="55"
        width="18"
        height="15"
        rx="3"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
        strokeDasharray="4 3"
      />
      <rect
        x="65"
        y="30"
        width="18"
        height="40"
        rx="3"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
        strokeDasharray="4 3"
      />
      <rect
        x="90"
        y="45"
        width="18"
        height="25"
        rx="3"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
        strokeDasharray="4 3"
      />
      {/* Sparkle / "no data" dot */}
      <circle cx="60" cy="15" r="5" fill="#D97706" opacity="0.5" />
      <line
        x1="60"
        y1="8"
        x2="60"
        y2="4"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="60"
        y1="26"
        x2="60"
        y2="22"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="53"
        y1="15"
        x2="49"
        y2="15"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="71"
        y1="15"
        x2="67"
        y2="15"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}

/** No-platforms illustration: disconnected cloud with amber link indicator */
function PlatformsIllustration() {
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      fill="none"
      aria-hidden="true"
      className="mx-auto mb-2 opacity-60"
    >
      {/* Central cloud outline */}
      <path
        d="M42 55 Q35 55 35 47 Q35 40 42 39 Q42 28 52 26 Q60 22 68 30 Q76 24 82 32 Q90 32 90 41 Q90 49 82 50 Z"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.8"
        opacity="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Broken link indicator below cloud */}
      <line
        x1="60"
        y1="55"
        x2="60"
        y2="63"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <rect
        x="52"
        y="63"
        width="10"
        height="6"
        rx="2"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <line
        x1="62"
        y1="66"
        x2="67"
        y2="66"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.35"
        strokeDasharray="2 2"
      />
      <rect
        x="67"
        y="63"
        width="10"
        height="6"
        rx="2"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.4"
      />
      {/* Small platform dots — disconnected */}
      <circle
        cx="25"
        cy="65"
        r="7"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.3"
        strokeDasharray="3 2"
      />
      <circle
        cx="95"
        cy="65"
        r="7"
        fill="none"
        stroke="#D97706"
        strokeWidth="1.5"
        opacity="0.3"
        strokeDasharray="3 2"
      />
      <line
        x1="32"
        y1="65"
        x2="40"
        y2="66"
        stroke="#D97706"
        strokeWidth="1"
        opacity="0.25"
        strokeDasharray="2 3"
      />
      <line
        x1="80"
        y1="66"
        x2="88"
        y2="65"
        stroke="#D97706"
        strokeWidth="1"
        opacity="0.25"
        strokeDasharray="2 3"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Config map
// ---------------------------------------------------------------------------

/** Maps EmptyState type to the appropriate mascot context */
const EMPTY_MASCOT_CONTEXT: Record<string, MascotContext> = {
  content: 'empty-content',
  analytics: 'empty-analytics',
  campaigns: 'empty-campaigns',
  schedule: 'empty-schedule',
  search: 'empty-search',
  generic: 'empty-generic',
  platforms: 'empty-platforms',
};

interface EmptyStateProps {
  type:
    | 'content'
    | 'analytics'
    | 'campaigns'
    | 'schedule'
    | 'search'
    | 'generic'
    | 'platforms';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /** Show a mascot persona below the icon. Defaults to true. */
  showMascot?: boolean;
}

const emptyStateConfigs = {
  content: {
    icon: FileText,
    illustration: null,
    title: 'No content yet',
    description:
      'Start creating engaging content for your social media channels',
    actionLabel: 'Generate First Content',
    gradient: 'from-amber-500 to-orange-500',
  },
  analytics: {
    icon: BarChart3,
    illustration: AnalyticsIllustration,
    title: 'No analytics data yet',
    description:
      'Once you start posting content, your performance metrics will appear here',
    actionLabel: 'View Sample Dashboard',
    gradient: 'from-amber-500 to-amber-600',
  },
  campaigns: {
    icon: Users,
    illustration: null,
    title: 'No campaigns running',
    description: 'Launch your first marketing campaign to reach your audience',
    actionLabel: 'Create Campaign',
    gradient: 'from-amber-500 to-orange-600',
  },
  schedule: {
    icon: Calendar,
    illustration: null,
    title: 'Nothing scheduled',
    description:
      'Plan and schedule your content to maintain consistent posting',
    actionLabel: 'Schedule Content',
    gradient: 'from-amber-500 to-orange-500',
  },
  search: {
    icon: Search,
    illustration: null,
    title: 'No results found',
    description: 'Try adjusting your search terms or filters',
    actionLabel: 'Clear Filters',
    gradient: 'from-amber-600 to-amber-700',
  },
  generic: {
    icon: Inbox,
    illustration: null,
    title: 'Nothing here yet',
    description: 'Get started by adding your first item',
    actionLabel: 'Get Started',
    gradient: 'from-amber-500 to-orange-500',
  },
  platforms: {
    icon: Link2,
    illustration: PlatformsIllustration,
    title: 'No platforms connected',
    description:
      'Connect your social media accounts to start scheduling posts and tracking performance',
    actionLabel: 'Connect a Platform',
    gradient: 'from-amber-500 to-amber-600',
  },
};

// ---------------------------------------------------------------------------
// EmptyState component
// ---------------------------------------------------------------------------

function EmptyStateMascot({ type }: { type: string }) {
  const { persona, imageUrl } = useMascot(
    (EMPTY_MASCOT_CONTEXT[type] ?? 'empty-generic') as MascotContext
  );
  return (
    <div className="mt-6">
      <MascotCard persona={persona} imageUrl={imageUrl} variant="compact" />
    </div>
  );
}

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  showMascot = true,
}: EmptyStateProps) {
  const config = emptyStateConfigs[type];
  const Icon = config.icon;
  const Illustration = config.illustration;

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}
      role="status"
      aria-label="Empty state"
      data-testid="empty-state"
    >
      {/* SVG illustration — shown when available */}
      {Illustration && <Illustration />}

      {/* Icon container — shown when no illustration */}
      {!Illustration && (
        <div className="relative mb-6">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${config.gradient} rounded-full blur-2xl opacity-20`}
          />
          <div className="relative p-6 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
            <Icon className="w-12 h-12 text-amber-400/70" />
          </div>
        </div>
      )}

      {/* Icon with illustration — small icon below illustration */}
      {Illustration && (
        <div className="relative mb-4">
          <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20">
            <Icon className="w-8 h-8 text-amber-400/70" />
          </div>
        </div>
      )}

      {/* Text content */}
      <h3 className="text-xl font-semibold text-white mb-2">
        {title ?? config.title}
      </h3>
      <p className="text-gray-300 max-w-md mb-6">
        {description ?? config.description}
      </p>

      {/* Action button */}
      {(actionLabel ?? config.actionLabel) && (
        <Button
          onClick={onAction}
          className="bg-amber-600 hover:bg-amber-500 text-white border-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel ?? config.actionLabel}
        </Button>
      )}

      {/* Content-specific help tiles */}
      {type === 'content' && (
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <button className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none">
            <Upload className="w-5 h-5 text-amber-400 mb-2 mx-auto" />
            <span className="block text-white font-medium">Import Content</span>
            <span className="text-gray-300">From file or URL</span>
          </button>
          <button className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none">
            <Sparkles className="w-5 h-5 text-amber-400 mb-2 mx-auto" />
            <span className="block text-white font-medium">
              Use AI Assistant
            </span>
            <span className="text-gray-300">Generate with AI</span>
          </button>
        </div>
      )}

      {/* Mascot tip — contextual persona for this empty state */}
      {showMascot && <EmptyStateMascot type={type} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function EmptyStateLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="animate-pulse">
        <div className="w-24 h-24 bg-white/10 rounded-full mb-6" />
        <div className="h-6 w-48 bg-white/10 rounded mb-3 mx-auto" />
        <div className="h-4 w-64 bg-white/10 rounded mx-auto" />
      </div>
    </div>
  );
}
