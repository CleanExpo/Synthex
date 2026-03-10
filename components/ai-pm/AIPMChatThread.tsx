'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Sparkles, User } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { AIMessage } from '@/hooks/useAIPM';
import { useState } from 'react';

interface AIPMChatThreadProps {
  messages: AIMessage[];
  onRate: (messageId: string, rating: number) => void;
}

function ActionItemsCard({ items }: { items: AIMessage['actionItems'] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs font-medium text-cyan-400"
      >
        <span>Action Items ({items.length})</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
              <span
                className={cn(
                  'mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full',
                  item.priority === 'high' ? 'bg-red-400' :
                  item.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                )}
              />
              <div>
                <span className="font-medium text-white">{item.title}</span>
                <p className="text-gray-400">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionsCard({ items }: { items: AIMessage['suggestions'] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs font-medium text-purple-400"
      >
        <span>Suggestions ({items.length})</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-gray-300">
              <span className="mr-1 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                {item.type}
              </span>
              <span className="font-medium text-white">{item.title}</span>
              <p className="mt-0.5 text-gray-400">{item.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AIPMChatThread({ messages, onRate }: AIPMChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 ring-1 ring-white/10">
          <Sparkles className="h-8 w-8 text-cyan-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Your AI Project Manager</h3>
        <p className="mt-2 max-w-sm text-sm text-gray-400">
          I know your business, your metrics, and your goals. Ask me anything about your marketing strategy, content performance, or what to focus on next.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {['Weekly Summary', 'Content Ideas', 'Performance Review', 'Growth Tips'].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            'flex gap-3',
            msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              msg.role === 'user'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-white'
            )}
          >
            {msg.role === 'user' ? (
              <User className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>

          {/* Message bubble */}
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-cyan-500/20 text-white'
                : 'bg-white/5 text-gray-200 ring-1 ring-white/5'
            )}
          >
            {/* Content with typing indicator */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
              {msg.isStreaming && (
                <span className="ml-1 inline-flex">
                  <span className="animate-pulse">▊</span>
                </span>
              )}
            </div>

            {/* Action items (assistant only) */}
            {msg.role === 'assistant' && !msg.isStreaming && (
              <>
                <ActionItemsCard items={msg.actionItems} />
                <SuggestionsCard items={msg.suggestions} />
              </>
            )}

            {/* Rating buttons (assistant only, not streaming) */}
            {msg.role === 'assistant' && !msg.isStreaming && !msg.id.startsWith('temp') && (
              <div className="mt-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rate response helpful"
                  className={cn(
                    'h-6 w-6',
                    msg.rating === 5 ? 'text-green-400' : 'text-gray-500 hover:text-green-400'
                  )}
                  onClick={() => onRate(msg.id, 5)}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rate response unhelpful"
                  className={cn(
                    'h-6 w-6',
                    msg.rating === 1 ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                  )}
                  onClick={() => onRate(msg.id, 1)}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
