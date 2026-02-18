/**
 * Chat Message Component
 *
 * @description Displays a single chat message with role-based styling.
 * Supports streaming indicator for assistant responses.
 */

'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/hooks/use-ai-chat';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 border',
          isUser
            ? 'bg-cyan-500/20 border-cyan-500/30 text-white'
            : 'bg-white/5 border-white/10 text-gray-100'
        )}
      >
        {/* Message content */}
        <div className="prose prose-invert prose-sm max-w-none">
          {message.content.split('\n').map((line, i) => (
            <p key={i} className="mb-1 last:mb-0 leading-relaxed">
              {line || '\u00A0'}
            </p>
          ))}
        </div>

        {/* Streaming indicator */}
        {isStreaming && isAssistant && (
          <span className="inline-flex items-center ml-1">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          </span>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs mt-2',
            isUser ? 'text-cyan-300/50' : 'text-gray-500'
          )}
        >
          {formatRelativeTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
