/**
 * AI Chat Dashboard Page
 *
 * @description Smart redirect page — routes to the most recent conversation
 * on load, or shows an empty state if no conversations exist.
 * The two-column layout lives in [conversationId]/page.tsx.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAIChat } from '@/hooks/use-ai-chat';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Plus,
  Loader2,
  AlertTriangle,
  Sparkles,
  Crown,
  RefreshCw,
} from '@/components/icons';
import { HelpVideo } from '@/components/ui/HelpVideo';

export default function AIChatPage() {
  const router = useRouter();
  const {
    conversations,
    isLoading,
    error,
    upgradeRequired,
    createConversation,
    refreshConversations,
  } = useAIChat();

  const [isCreating, setIsCreating] = useState(false);

  // Redirect to most recent conversation once loaded
  useEffect(() => {
    if (!isLoading && conversations.length > 0) {
      router.replace(`/dashboard/ai-chat/${conversations[0].id}`);
    }
  }, [isLoading, conversations, router]);

  const handleCreateConversation = async () => {
    setIsCreating(true);
    try {
      const newConversation = await createConversation();
      if (newConversation) {
        router.push(`/dashboard/ai-chat/${newConversation.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Upgrade required state
  if (upgradeRequired) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20">
              <MessageSquare className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1 block">
                AI Tools
              </span>
              <h1 className="text-3xl font-extralight tracking-tight text-white">
                AI Chat Assistant
              </h1>
              <p className="text-white/40 text-sm">
                Get AI-powered help with your content strategy
              </p>
            </div>
          </div>
          <HelpVideo videoId="ai-capability-chat" />
        </div>

        <div className="border-[0.5px] border-orange-500/20 bg-orange-500/[0.04] rounded-sm py-12 px-6">
          <div className="text-center max-w-md mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20 mb-4">
              <Crown className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-xl font-light text-white mb-2">
              Upgrade to Professional
            </h3>
            <p className="text-white/40 mb-6">
              AI Chat Assistant is available on Professional plan and above. Get
              unlimited AI-powered conversations to help with your content
              strategy.
            </p>
            <Button
              asChild
              className="bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30"
            >
              <Link href="/dashboard/billing">
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade Now
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="border-[0.5px] border-red-500/20 bg-red-500/[0.04] rounded-sm py-8 px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-sm bg-red-500/10 border-[0.5px] border-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-light text-white mb-1">
                Unable to load conversations
              </h3>
              <p className="text-sm text-white/40">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={refreshConversations}
              className="bg-white/[0.02] border-[0.5px] border-white/[0.06]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no conversations exist yet
  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="p-4 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20 inline-block mb-4">
          <MessageSquare className="h-8 w-8 text-orange-400" />
        </div>
        <h3 className="text-xl font-light text-white mb-2">
          Start your first conversation
        </h3>
        <div className="mb-4">
          <HelpVideo videoId="ai-capability-chat" />
        </div>
        <p className="text-white/40 mb-6">
          Ask about content strategy, get ideas for posts, or optimise your
          social media presence.
        </p>
        <Button
          onClick={handleCreateConversation}
          disabled={isCreating}
          className="bg-orange-500/20 border-[0.5px] border-orange-500/30 hover:bg-orange-500/30 text-orange-400"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Start New Chat
        </Button>
      </div>
    </div>
  );
}
