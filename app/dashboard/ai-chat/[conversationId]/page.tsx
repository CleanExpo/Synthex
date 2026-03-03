/**
 * AI Chat Conversation Page
 *
 * @description Two-column layout with conversation sidebar and active conversation.
 * The active conversation is determined by the URL param, so the selection
 * persists across page reloads and browser history works correctly.
 *
 * Features:
 * - URL-based conversation selection (persists on reload)
 * - Sidebar search (client-side, filters by title)
 * - Archive toggle (soft-delete to archived status)
 * - Auto-title: sidebar refreshes after first response renames the conversation
 */

'use client';

import { use, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAIChat } from '@/hooks/use-ai-chat';
import { ChatAssistant } from '@/components/ai/chat-assistant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Plus,
  Trash2,
  Archive,
  Loader2,
  AlertTriangle,
  Sparkles,
  Crown,
} from '@/components/icons';
import { cn } from '@/lib/utils';

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'No messages';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function AIConversationPage({ params }: PageProps) {
  const { conversationId } = use(params);
  const router = useRouter();
  const pathname = usePathname();

  const {
    conversations,
    isLoading,
    error,
    upgradeRequired,
    createConversation,
    deleteConversation,
    archiveConversation,
    refreshConversations,
  } = useAIChat();

  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateConversation = useCallback(async () => {
    setIsCreating(true);
    try {
      const newConversation = await createConversation();
      if (newConversation) {
        router.push(`/dashboard/ai-chat/${newConversation.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  }, [createConversation, router]);

  const handleDeleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDeletingId(id);
      try {
        await deleteConversation(id);
        // If deleting the active conversation, route to next available or index
        if (pathname === `/dashboard/ai-chat/${id}`) {
          const remaining = conversations.filter((c) => c.id !== id);
          if (remaining.length > 0) {
            router.replace(`/dashboard/ai-chat/${remaining[0].id}`);
          } else {
            router.replace('/dashboard/ai-chat');
          }
        }
      } finally {
        setDeletingId(null);
      }
    },
    [deleteConversation, pathname, conversations, router]
  );

  const handleArchiveConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setArchivingId(id);
      try {
        await archiveConversation(id);
        // If archiving the active conversation, route to next available or index
        if (pathname === `/dashboard/ai-chat/${id}`) {
          const remaining = conversations.filter((c) => c.id !== id);
          if (remaining.length > 0) {
            router.replace(`/dashboard/ai-chat/${remaining[0].id}`);
          } else {
            router.replace('/dashboard/ai-chat');
          }
        }
      } finally {
        setArchivingId(null);
      }
    },
    [archiveConversation, pathname, conversations, router]
  );

  // Called by ChatAssistant after auto-title fires — refresh sidebar titles
  const handleTitleUpdated = useCallback(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Upgrade required state
  if (upgradeRequired) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 mb-8">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <MessageSquare className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">AI Chat Assistant</h1>
            <p className="text-gray-400">Get AI-powered help with your content strategy</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="py-12">
            <div className="text-center max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Upgrade to Professional
              </h3>
              <p className="text-gray-300 mb-6">
                AI Chat Assistant is available on Professional plan and above.
                Get unlimited AI-powered conversations to help with your content strategy.
              </p>
              <Button
                asChild
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Link href="/dashboard/billing">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state (initial load)
  if (isLoading && conversations.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && conversations.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">
                  Unable to load conversations
                </h3>
                <p className="text-sm text-gray-400">{error}</p>
              </div>
              <Button
                variant="outline"
                onClick={refreshConversations}
                className="bg-white/5 border-white/10"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <MessageSquare className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Chat Assistant</h1>
            <p className="text-sm text-gray-400">Get help with content strategy and ideas</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-300">
          Professional
        </Badge>
      </div>

      {/* Main content - two column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation sidebar */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-[#0f172a]/30">
          {/* New chat button */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <Button
              onClick={handleCreateConversation}
              disabled={isCreating}
              className="w-full bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 text-cyan-300"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              New Chat
            </Button>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg
                         text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Click &quot;New Chat&quot; to start</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <p className="text-sm">No results for &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = pathname === `/dashboard/ai-chat/${conv.id}`;
                  return (
                    <Link
                      key={conv.id}
                      href={`/dashboard/ai-chat/${conv.id}`}
                      className={cn(
                        'w-full text-left px-3 py-3 rounded-lg transition-colors group flex',
                        isActive
                          ? 'bg-cyan-500/20 border border-cyan-500/30'
                          : 'bg-white/5 border border-transparent hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {conv.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {conv.messageCount} messages
                            </span>
                            <span className="text-xs text-gray-600">•</span>
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(conv.lastMessageAt)}
                            </span>
                          </div>
                        </div>
                        {/* Archive + Delete buttons (visible on hover) */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleArchiveConversation(conv.id, e)}
                            disabled={archivingId === conv.id}
                            title="Archive conversation"
                            className="p-1.5 rounded hover:bg-amber-500/20 text-gray-400 hover:text-amber-400"
                          >
                            {archivingId === conv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            disabled={deletingId === conv.id}
                            title="Delete conversation"
                            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                          >
                            {deletingId === conv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-[#0a0f1a]">
          <ChatAssistant
            conversationId={conversationId}
            onTitleUpdated={handleTitleUpdated}
          />
        </div>
      </div>
    </div>
  );
}
