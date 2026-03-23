'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGBPReviews } from '@/hooks/useGBPReviews';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { GBPConnectionBanner } from '@/components/google/GBPConnectionBanner';
import {
  ArrowLeft,
  MessageSquare,
  Star,
  Send,
  Loader2,
  Zap,
  Filter,
} from '@/components/icons';

type RatingFilter = 'all' | '1' | '2' | '3' | '4' | '5' | 'unreplied';

export default function GBPReviewsPage() {
  const { locations, primaryLocation } = useGBPLocations();
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');

  const reviewOptions = {
    locationId: primaryLocation?.id,
    page,
    limit: 20,
    ...(ratingFilter !== 'all' && ratingFilter !== 'unreplied'
      ? { rating: parseInt(ratingFilter) }
      : {}),
    ...(ratingFilter === 'unreplied' ? { unreplied: true } : {}),
  };

  const { reviews, pagination, isLoading, refresh } =
    useGBPReviews(reviewOptions);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);

  const hasLocations = locations.length > 0;

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const response = await fetch(
        `/api/google-business/reviews/${reviewId}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: replyText }),
        }
      );

      if (response.ok) {
        setReplyingTo(null);
        setReplyText('');
        refresh();
      }
    } finally {
      setSending(false);
    }
  };

  const handleGenerateAI = async (reviewId: string) => {
    setGeneratingAI(reviewId);
    try {
      const response = await fetch(
        `/api/google-business/reviews/${reviewId}/auto-reply`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReplyingTo(reviewId);
        setReplyText(data.suggestion || '');
        refresh();
      }
    } finally {
      setGeneratingAI(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/google-business"
          className="text-sm text-gray-300 hover:text-orange-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Business
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-orange-400" />
          Review Management
        </h1>
        <p className="text-gray-300 mt-1">
          Respond to customer reviews with AI-assisted replies
        </p>
      </div>

      {!hasLocations && <GBPConnectionBanner />}

      {hasLocations && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-300" />
            {(
              ['all', '5', '4', '3', '2', '1', 'unreplied'] as RatingFilter[]
            ).map(f => (
              <Button
                key={f}
                variant="outline"
                size="sm"
                onClick={() => {
                  setRatingFilter(f);
                  setPage(1);
                }}
                className={`text-xs ${
                  ratingFilter === f
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'unreplied'
                    ? 'Needs Reply'
                    : `${f} Stars`}
              </Button>
            ))}
          </div>

          {/* Reviews List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(review => (
                <Card
                  key={review.id}
                  className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10"
                >
                  <CardContent className="p-5">
                    {/* Review Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500/10 rounded-full flex items-center justify-center">
                          <span className="text-orange-400 font-bold text-sm">
                            {(review.reviewerName || 'A')[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">
                            {review.reviewerName || 'Anonymous'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(review.reviewTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? 'text-orange-400'
                                : 'text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Review Comment */}
                    {review.comment && (
                      <p className="text-sm text-gray-300 mb-3">
                        {review.comment}
                      </p>
                    )}

                    {/* Existing Reply */}
                    {review.replyText && (
                      <div className="p-3 bg-white/5 rounded-lg mb-3 border-l-2 border-orange-500/30">
                        <p className="text-xs text-orange-400 font-medium mb-1">
                          Your reply
                        </p>
                        <p className="text-sm text-gray-300">
                          {review.replyText}
                        </p>
                      </div>
                    )}

                    {/* AI Suggestion */}
                    {review.aiSuggestion &&
                      !review.replyText &&
                      replyingTo !== review.id && (
                        <div className="p-3 bg-orange-500/5 rounded-lg mb-3 border-l-2 border-orange-500/20">
                          <p className="text-xs text-orange-400 font-medium mb-1 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> AI Suggestion
                          </p>
                          <p className="text-sm text-gray-300">
                            {review.aiSuggestion}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-orange-400 hover:text-orange-300"
                            onClick={() => {
                              setReplyingTo(review.id);
                              setReplyText(review.aiSuggestion!);
                            }}
                          >
                            Use this reply
                          </Button>
                        </div>
                      )}

                    {/* Reply Form */}
                    {replyingTo === review.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSendReply(review.id)}
                            disabled={sending || !replyText.trim()}
                            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                          >
                            {sending ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Send className="w-3 h-3 mr-1" />
                            )}
                            Send Reply
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            className="text-gray-300"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : !review.replyText ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReplyingTo(review.id)}
                          className="border-white/10 text-gray-300 hover:bg-white/5"
                        >
                          Reply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateAI(review.id)}
                          disabled={generatingAI === review.id}
                          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                        >
                          {generatingAI === review.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Zap className="w-3 h-3 mr-1" />
                          )}
                          AI Suggest
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="border-white/10 text-gray-300"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-300">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="border-white/10 text-gray-300"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No Reviews Found
              </h3>
              <p className="text-gray-300">
                {ratingFilter !== 'all'
                  ? 'No reviews match the current filter.'
                  : 'Reviews will appear after the daily sync runs.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
