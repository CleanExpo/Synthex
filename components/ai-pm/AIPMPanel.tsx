'use client';

import { useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Sparkles, Loader2, Lock } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useAIPM, type AIConversation } from '@/hooks/useAIPM';
import AIPMChatThread from './AIPMChatThread';
import AIPMInput from './AIPMInput';

interface AIPMPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AIPMPanel({ open, onOpenChange }: AIPMPanelProps) {
  const {
    conversations,
    activeConversation,
    messages,
    isLoading,
    isSending,
    error,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    rateMessage,
    clearError,
  } = useAIPM();

  // Load conversations when panel opens
  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open, loadConversations]);

  const handleNewConversation = useCallback(async () => {
    await createConversation();
  }, [createConversation]);

  const handleBack = useCallback(() => {
    // Go back to conversation list (clear active)
    // Re-implemented by setting active to null through selectConversation
    loadConversations();
  }, [loadConversations]);

  // Upgrade required state
  if (error === 'upgrade_required') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full border-white/[0.08] bg-gray-950/95 backdrop-blur-xl sm:max-w-lg p-0"
        >
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 ring-1 ring-white/10">
              <Lock className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-white">AI Project Manager</h3>
            <p className="mt-3 text-sm text-gray-400">
              Your dedicated AI Senior Project Manager learns your business, proactively surfaces insights, and becomes your daily marketing advisor.
            </p>
            <p className="mt-4 text-sm text-gray-300">
              Available on the <span className="font-semibold text-cyan-400">Business plan</span> ($399/month)
            </p>
            <Button
              className="mt-6 bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400"
              onClick={() => {
                onOpenChange(false);
                // Navigate to settings/subscription
                window.location.href = '/dashboard/settings';
              }}
            >
              Upgrade to Business
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/[0.08] bg-gray-950/95 backdrop-blur-xl sm:max-w-lg p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            {activeConversation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              <SheetTitle className="text-white">
                {activeConversation
                  ? activeConversation.title.substring(0, 40) + (activeConversation.title.length > 40 ? '...' : '')
                  : 'AI Project Manager'}
              </SheetTitle>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white"
            onClick={handleNewConversation}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {/* Content */}
        {!activeConversation ? (
          // Conversation list
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
                <Sparkles className="mb-4 h-12 w-12 text-cyan-400/50" />
                <p className="text-sm text-gray-400">
                  No conversations yet. Start a new chat with your AI Project Manager.
                </p>
                <Button
                  className="mt-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                  onClick={handleNewConversation}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Conversation
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    onClick={() => selectConversation(conv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Active conversation
          <>
            <AIPMChatThread messages={messages} onRate={rateMessage} />
            <AIPMInput onSend={sendMessage} isSending={isSending} />
          </>
        )}

        {/* Error toast */}
        {error && error !== 'upgrade_required' && (
          <div className="absolute bottom-20 left-4 right-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {error}
            <button
              onClick={clearError}
              className="ml-2 text-red-300 underline hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ConversationItem({
  conversation,
  onClick,
}: {
  conversation: AIConversation;
  onClick: () => void;
}) {
  const timeAgo = getTimeAgo(conversation.lastMessageAt || conversation.createdAt);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
        <Sparkles className="h-4 w-4 text-cyan-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {conversation.title}
        </p>
        <p className="text-xs text-gray-500">
          {conversation.messageCount} messages · {timeAgo}
        </p>
      </div>
    </button>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
