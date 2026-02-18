'use client';

/**
 * Social Listening Dashboard Page
 *
 * @description Monitor brand mentions, keywords, and hashtags across platforms.
 * Shows tracked keywords sidebar and scrollable mentions feed.
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocialListening, TrackedKeyword, SocialMention } from '@/hooks/useSocialListening';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Plus,
  Hash,
  AtSign,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Flag,
  Check,
  Archive,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Twitter,
  Youtube,
  MessageSquare,
} from '@/components/icons';
import { formatDistanceToNow } from 'date-fns';

// Platform options
const PLATFORMS = [
  { id: 'twitter', label: 'X (Twitter)', icon: Twitter },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'reddit', label: 'Reddit', icon: MessageSquare },
];

// Keyword type options
const KEYWORD_TYPES = [
  { id: 'keyword', label: 'Keyword', icon: Search },
  { id: 'hashtag', label: 'Hashtag', icon: Hash },
  { id: 'mention', label: 'Mention', icon: AtSign },
  { id: 'brand', label: 'Brand', icon: Bell },
];

// Sentiment badge component
function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;

  const config = {
    positive: { icon: TrendingUp, color: 'text-green-400 bg-green-500/10' },
    negative: { icon: TrendingDown, color: 'text-red-400 bg-red-500/10' },
    neutral: { icon: Minus, color: 'text-gray-400 bg-gray-500/10' },
  }[sentiment] || { icon: Minus, color: 'text-gray-400 bg-gray-500/10' };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.color}`}>
      <Icon className="h-3 w-3" />
      {sentiment}
    </span>
  );
}

// Mention card component
function MentionCard({
  mention,
  onMarkRead,
  onFlag,
  onArchive,
}: {
  mention: SocialMention;
  onMarkRead: () => void;
  onFlag: () => void;
  onArchive: () => void;
}) {
  const isNew = new Date(mention.postedAt).getTime() > Date.now() - 60 * 60 * 1000;

  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        mention.isRead
          ? 'bg-gray-900/30 border-white/5'
          : 'bg-gray-900/50 border-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {mention.authorAvatar ? (
            <img
              src={mention.authorAvatar}
              alt={mention.authorHandle}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-sm text-gray-400">
                {mention.authorHandle[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">
                {mention.authorName || mention.authorHandle}
              </span>
              {mention.isInfluencer && (
                <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                  Influencer
                </Badge>
              )}
              {isNew && !mention.isRead && (
                <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">New</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>@{mention.authorHandle}</span>
              <span>·</span>
              <span>{mention.platform}</span>
              {mention.authorFollowers && (
                <>
                  <span>·</span>
                  <span>{mention.authorFollowers.toLocaleString()} followers</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <SentimentBadge sentiment={mention.sentiment} />
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-300 text-sm mb-3 whitespace-pre-wrap">{mention.content}</p>

      {/* Keyword tag */}
      {mention.keyword && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs">
            <Hash className="h-3 w-3" />
            {mention.keyword.keyword}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{mention.likes} likes</span>
          <span>{mention.comments} comments</span>
          <span>{mention.shares} shares</span>
          <span>{formatDistanceToNow(new Date(mention.postedAt), { addSuffix: true })}</span>
        </div>

        <div className="flex items-center gap-1">
          {!mention.isRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkRead}
              className="h-8 px-2 text-gray-400 hover:text-white"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onFlag}
            className={`h-8 px-2 ${mention.isFlagged ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            <Flag className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onArchive}
            className="h-8 px-2 text-gray-400 hover:text-white"
          >
            <Archive className="h-4 w-4" />
          </Button>
          {mention.platformUrl && (
            <a
              href={mention.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ListeningPage() {
  const searchParams = useSearchParams();

  // Filters
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordType, setNewKeywordType] = useState<'keyword' | 'hashtag' | 'mention' | 'brand'>('keyword');
  const [newKeywordPlatforms, setNewKeywordPlatforms] = useState<string[]>(['twitter']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize hook with filters
  const {
    keywords,
    mentions,
    stats,
    page,
    totalPages,
    isLoading,
    error,
    lastRefreshedAt,
    addKeyword,
    removeKeyword,
    markMentionRead,
    flagMention,
    archiveMention,
    refresh,
    nextPage,
    prevPage,
    clearError,
  } = useSocialListening({
    keywordId: selectedKeywordId || undefined,
    platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
    sentiment: selectedSentiment !== 'all' ? selectedSentiment : undefined,
  });

  // Check for action param
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  // Handle add keyword
  const handleAddKeyword = async () => {
    if (!newKeyword.trim() || newKeywordPlatforms.length === 0) return;

    setIsSubmitting(true);
    const result = await addKeyword(newKeyword.trim(), newKeywordType, newKeywordPlatforms);
    setIsSubmitting(false);

    if (result) {
      setIsAddModalOpen(false);
      setNewKeyword('');
      setNewKeywordType('keyword');
      setNewKeywordPlatforms(['twitter']);
    }
  };

  // Handle platform toggle
  const handlePlatformToggle = (platformId: string) => {
    setNewKeywordPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  // Loading state
  if (isLoading && keywords.length === 0 && mentions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-gray-400">Loading social listening...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && keywords.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Failed to Load</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={clearError} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      {/* Header */}
      <PageHeader
        title="Social Listening"
        description="Monitor brand mentions, keywords, and hashtags across platforms"
        actions={
          <div className="flex items-center gap-3">
            {/* Last refreshed */}
            {lastRefreshedAt && (
              <span className="text-sm text-gray-400">
                Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>
            )}

            {/* Refresh button */}
            <Button
              variant="outline"
              onClick={refresh}
              disabled={isLoading}
              className="bg-gray-900/50 border-white/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {/* Add keyword CTA */}
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Keyword
            </Button>
          </div>
        }
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{stats.total24h}</p>
          <p className="text-sm text-gray-400">Mentions (24h)</p>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{stats.total7d}</p>
          <p className="text-sm text-gray-400">Mentions (7d)</p>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400">{stats.sentimentBreakdown.positive}</span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{stats.sentimentBreakdown.neutral}</span>
            <span className="text-gray-500">/</span>
            <span className="text-red-400">{stats.sentimentBreakdown.negative}</span>
          </div>
          <p className="text-sm text-gray-400">Sentiment (P/N/Neg)</p>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{stats.unreadCount}</p>
          <p className="text-sm text-gray-400">Unread</p>
        </div>
      </div>

      {/* Main content - Two column layout */}
      {keywords.length === 0 ? (
        <DashboardEmptyState
          icon={Bell}
          title="Start monitoring your brand"
          description="Add keywords, hashtags, or brand names to track mentions across social platforms."
          action={{
            label: 'Add Keyword',
            onClick: () => setIsAddModalOpen(true),
          }}
        />
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Keywords sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4 h-full">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Tracked Keywords</h3>
              <div className="space-y-2">
                {/* All keywords option */}
                <button
                  onClick={() => setSelectedKeywordId(null)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                    !selectedKeywordId
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm">All Keywords</span>
                  <Badge variant="outline" className="text-xs">
                    {keywords.reduce((sum, k) => sum + k.totalMentions, 0)}
                  </Badge>
                </button>

                {/* Individual keywords */}
                {keywords.map(keyword => (
                  <div
                    key={keyword.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors group ${
                      selectedKeywordId === keyword.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedKeywordId(keyword.id)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      {keyword.type === 'hashtag' && <Hash className="h-3 w-3" />}
                      {keyword.type === 'mention' && <AtSign className="h-3 w-3" />}
                      {keyword.type === 'keyword' && <Search className="h-3 w-3" />}
                      {keyword.type === 'brand' && <Bell className="h-3 w-3" />}
                      <span className="text-sm truncate">{keyword.keyword}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {keyword.unreadCount > 0 && (
                        <Badge className="bg-cyan-500 text-white text-xs h-5 min-w-[20px] flex items-center justify-center">
                          {keyword.unreadCount}
                        </Badge>
                      )}
                      <button
                        onClick={() => removeKeyword(keyword.id)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mentions feed */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-40 bg-gray-900/50 border-white/10">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
                <SelectTrigger className="w-40 bg-gray-900/50 border-white/10">
                  <SelectValue placeholder="Sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiment</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mentions list */}
            <div className="flex-1 overflow-auto space-y-3">
              {mentions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mentions found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
                </div>
              ) : (
                mentions.map(mention => (
                  <MentionCard
                    key={mention.id}
                    mention={mention}
                    onMarkRead={() => markMentionRead(mention.id)}
                    onFlag={() => flagMention(mention.id, !mention.isFlagged)}
                    onArchive={() => archiveMention(mention.id)}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={prevPage}
                  disabled={page <= 1}
                  className="bg-gray-900/50 border-white/10"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={nextPage}
                  disabled={page >= totalPages}
                  className="bg-gray-900/50 border-white/10"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Keyword Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-gray-900 border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Tracked Keyword</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Keyword input */}
            <div className="space-y-2">
              <Label htmlFor="keyword" className="text-gray-300">
                Keyword or Hashtag
              </Label>
              <Input
                id="keyword"
                placeholder="e.g., synthex, #marketing, @competitor"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                className="bg-gray-800/50 border-white/10 text-white"
              />
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-gray-300">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {KEYWORD_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setNewKeywordType(type.id as typeof newKeywordType)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      newKeywordType === type.id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-800/50 border-white/10 text-gray-300 hover:bg-gray-800/70'
                    }`}
                  >
                    <type.icon className="h-4 w-4" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform checkboxes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Platforms to Monitor</Label>
              <div className="space-y-2">
                {PLATFORMS.map(platform => (
                  <label
                    key={platform.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-white/10 cursor-pointer hover:bg-gray-800/70"
                  >
                    <Checkbox
                      checked={newKeywordPlatforms.includes(platform.id)}
                      onCheckedChange={() => handlePlatformToggle(platform.id)}
                    />
                    <platform.icon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{platform.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddKeyword}
                disabled={isSubmitting || !newKeyword.trim() || newKeywordPlatforms.length === 0}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Keyword'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
