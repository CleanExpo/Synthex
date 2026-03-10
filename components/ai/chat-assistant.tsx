/**
 * Chat Assistant Component
 *
 * @description Main chat interface component with message list and input.
 * Handles streaming responses and auto-scroll behavior.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAIChatConversation } from '@/hooks/use-ai-chat';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Loader2, AlertTriangle, MessageSquare, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatAssistantProps {
  conversationId: string;
  onTitleUpdated?: () => void;
}

export function ChatAssistant({ conversationId, onTitleUpdated }: ChatAssistantProps) {
  const {
    conversation,
    messages,
    isLoading,
    error,
    sendMessage,
    streamingContent,
    isStreaming,
  } = useAIChatConversation(conversationId, { onTitleUpdated });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  // Loading state
  if (isLoading && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden="true" />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="p-3 rounded-full bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white mb-1">Unable to load chat</h3>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="bg-white/5 border-white/10 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const handleSend = async (content: string) => {
    await sendMessage(content);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Empty state */}
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="p-4 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <MessageSquare className="h-8 w-8 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-gray-400">
                  Ask about content strategy, get ideas for posts, or optimize your social media presence.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {[
                  'Help me brainstorm content ideas',
                  'Optimize my post for engagement',
                  'Content strategy for Instagram',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    disabled={isStreaming}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full',
                      'bg-white/5 border border-white/10 text-gray-300',
                      'hover:bg-white/10 hover:text-white',
                      'transition-colors duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              createdAt: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Streaming indicator without content yet */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error during chat (show but don't block) */}
        {error && messages.length > 0 && (
          <div className="flex justify-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-4 bg-surface-base/50 backdrop-blur-sm">
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          placeholder={
            conversation?.title === 'New Chat'
              ? 'Ask about content strategy, ideas, or optimization...'
              : `Continue the conversation...`
          }
        />
      </div>
    </div>
  );
}
