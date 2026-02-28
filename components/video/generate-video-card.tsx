'use client';

/**
 * Generate Video Card
 *
 * Dashboard entry point card for the video generation feature.
 * Sits alongside existing content creation cards on the content dashboard.
 */

import { Video, Sparkles, AlertTriangle } from '@/components/icons';

interface GenerateVideoCardProps {
  onClick: () => void;
  disabled?: boolean;
  hasApiKey?: boolean;
}

export function GenerateVideoCard({
  onClick,
  disabled = false,
  hasApiKey = true,
}: GenerateVideoCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
        <Video className="w-5 h-5 text-cyan-400" />
      </div>

      {/* Content */}
      <h3 className="text-white font-medium mb-1 flex items-center gap-2">
        Generate Video
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </h3>
      <p className="text-gray-400 text-sm line-clamp-2">
        Create AI-powered marketing videos — social reels, explainers, and how-to guides.
      </p>

      {/* API key warning */}
      {!hasApiKey && (
        <div className="mt-3 flex items-center gap-1.5 text-amber-400 text-xs">
          <AlertTriangle className="w-3 h-3" />
          <span>API key required</span>
        </div>
      )}
    </button>
  );
}
