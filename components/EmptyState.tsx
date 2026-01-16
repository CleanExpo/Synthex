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
  Inbox
} from '@/components/icons';

interface EmptyStateProps {
  type: 'content' | 'analytics' | 'campaigns' | 'schedule' | 'search' | 'generic';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const emptyStateConfigs = {
  content: {
    icon: FileText,
    title: "No content yet",
    description: "Start creating engaging content for your social media channels",
    actionLabel: "Generate First Content",
    gradient: "from-purple-500 to-pink-500"
  },
  analytics: {
    icon: BarChart3,
    title: "No analytics data",
    description: "Once you start posting content, your analytics will appear here",
    actionLabel: "View Sample Dashboard",
    gradient: "from-blue-500 to-cyan-500"
  },
  campaigns: {
    icon: Users,
    title: "No campaigns running",
    description: "Launch your first marketing campaign to reach your audience",
    actionLabel: "Create Campaign",
    gradient: "from-green-500 to-emerald-500"
  },
  schedule: {
    icon: Calendar,
    title: "Nothing scheduled",
    description: "Plan and schedule your content to maintain consistent posting",
    actionLabel: "Schedule Content",
    gradient: "from-orange-500 to-red-500"
  },
  search: {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search terms or filters",
    actionLabel: "Clear Filters",
    gradient: "from-gray-500 to-gray-600"
  },
  generic: {
    icon: Inbox,
    title: "Nothing here yet",
    description: "Get started by adding your first item",
    actionLabel: "Get Started",
    gradient: "from-indigo-500 to-purple-500"
  }
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}: EmptyStateProps) {
  const config = emptyStateConfigs[type];
  const Icon = config.icon;
  
  return (
    <div 
      className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}
      role="status"
      aria-label="Empty state"
    >
      {/* Icon Container */}
      <div className={`relative mb-6`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} rounded-full blur-2xl opacity-20`} />
        <div className="relative p-6 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
          <Icon className="w-12 h-12 text-white/60" />
        </div>
      </div>
      
      {/* Text Content */}
      <h3 className="text-xl font-semibold text-white mb-2">
        {title || config.title}
      </h3>
      <p className="text-gray-400 max-w-md mb-6">
        {description || config.description}
      </p>
      
      {/* Action Button */}
      {(actionLabel || config.actionLabel) && (
        <Button
          onClick={onAction}
          className="gradient-primary text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel || config.actionLabel}
        </Button>
      )}
      
      {/* Additional Help */}
      {type === 'content' && (
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <button className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
            <Upload className="w-5 h-5 text-purple-400 mb-2 mx-auto" />
            <span className="text-gray-400">Import Content</span>
          </button>
          <button className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
            <Sparkles className="w-5 h-5 text-purple-400 mb-2 mx-auto" />
            <span className="text-gray-400">Use AI Assistant</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Loading state while checking for data
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