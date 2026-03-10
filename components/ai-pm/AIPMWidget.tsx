'use client';

import { useEffect } from 'react';
import { Sparkles, ArrowRight, Zap } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAIPM } from '@/hooks/useAIPM';
import { cn } from '@/lib/utils';

interface AIPMWidgetProps {
  onOpenChat: () => void;
}

export default function AIPMWidget({ onOpenChat }: AIPMWidgetProps) {
  const { greeting, dashboardSuggestions, loadDashboardSuggestions } = useAIPM();

  useEffect(() => {
    loadDashboardSuggestions();
  }, [loadDashboardSuggestions]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Project Manager</h3>
            <p className="text-[10px] text-gray-500">Personalized insights</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-cyan-400 hover:text-cyan-300"
          onClick={onOpenChat}
        >
          Chat
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {/* Greeting */}
      {greeting && (
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          {greeting}
        </p>
      )}

      {/* Suggestions */}
      {dashboardSuggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          {dashboardSuggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => {
                if (suggestion.actionUrl) {
                  window.location.href = suggestion.actionUrl;
                } else {
                  onOpenChat();
                }
              }}
              className="flex w-full items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-left transition-colors hover:border-cyan-500/20 hover:bg-cyan-500/5"
            >
              <Zap className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                suggestion.type === 'content' ? 'text-purple-400' :
                suggestion.type === 'growth' ? 'text-green-400' :
                suggestion.type === 'optimization' ? 'text-yellow-400' :
                'text-cyan-400'
              )} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">{suggestion.title}</p>
                <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2">{suggestion.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Fallback if no data yet */}
      {!greeting && dashboardSuggestions.length === 0 && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            Your AI PM is analyzing your account...
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
            onClick={onOpenChat}
          >
            Start a conversation
          </Button>
        </div>
      )}
    </div>
  );
}
