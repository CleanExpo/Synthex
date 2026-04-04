'use client';

import { useState, useCallback } from 'react';
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
  CheckCircle,
  X,
  Edit,
} from '@/components/icons';

type RatingFilter = 'all' | '1' | '2' | '3' | '4' | '5' | 'unreplied';
type DismissReason = 'too_formal' | 'wrong_tone' | 'inaccurate' | 'other';

const DISMISS_REASONS: { value: DismissReason; label: string }[] = [
  { value: 'too_formal', label: 'Too formal' },
  { value: 'wrong_tone', label: 'Wrong tone' },
  { value: 'inaccurate', label: 'Inaccurate' },
  { value: 'other', label: 'Other' },
];

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

  // Edit-and-send flow
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // One-tap approve flow
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // AI generation
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);

  // Dismiss flow
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissingReasonId, setDismissingReasonId] = useState<string | null>(
    null
  );

  const hasLocations = locations.length > 0;

  const handleSendReply = useCallback(
    async (reviewId: string) => {
      if (!replyText.trim()) return;
      setSending(true);
      try {
        const res = await fetch(
          `/api/google-business/reviews/${reviewId}/reply`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: replyText }),
          }
        );
        if (res.ok) {
          setReplyingTo(null);
          setReplyText('');
          refresh();
        }
      } finally {
        setSending(false);
      }
    },
    [replyText, refresh]
  );

  // One-tap approve: post the existing AI suggestion directly
  const handleApprove = useCallback(
    async (reviewId: string, suggestion: string) => {
      setApprovingId(reviewId);
      try {
        const res = await fetch(
          `/api/google-business/reviews/${reviewId}/reply`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: suggestion }),
          }
        );
        if (res.ok) refresh();
      } finally {
        setApprovingId(null);
      }
    },
    [refresh]
  );

  const handleGenerateAI = useCallback(
    async (reviewId: string) => {
      setGeneratingAI(reviewId);
      try {
        const res = await fetch(
          `/api/google-business/reviews/${reviewId}/auto-reply`,
          { method: 'POST', credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setReplyingTo(reviewId);
          setReplyText(data.suggestion || '');
          refresh();
        }
      } finally {
        setGeneratingAI(null);
      }
    },
    [refresh]
  );

  const handleDismiss = useCallback(
    async (reviewId: string, reason: DismissReason) => {
      setDismissingId(reviewId);
      try {
        const res = await fetch(
          `/api/google-business/reviews/${reviewId}/dismiss`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason }),
          }
        );
        if (res.ok) {
          setDismissingReasonId(null);
          refresh();
        }
      } finally {
        setDismissingId(null);
      }
    },
    [refresh]
  );

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
                            {new Date(review.reviewTime).toLocaleDateString(
                              'en-AU'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Response status badge */}
                        {review.responseStatus === 'posted' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Replied
                          </span>
                        ) : review.responseStatus === 'dismissed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-500/15 text-gray-400">
                            <X className="w-3 h-3" />
                            Dismissed
                          </span>
                        ) : !review.replyText ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-400">
                            Needs reply
                          </span>
                        ) : null}
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
                    </div>

                    {/* Review Comment */}
                    {review.comment && (
                      <p className="text-sm text-gray-300 mb-3">
                        {review.comment}
                      </p>
                    )}

                    {/* Posted Reply */}
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

                    {/* AI Draft — shown when unreplied + not dismissed + not editing */}
                    {review.aiSuggestion &&
                      !review.replyText &&
                      review.responseStatus !== 'dismissed' &&
                      replyingTo !== review.id && (
                        <div className="p-3 bg-orange-500/5 rounded-lg mb-3 border-l-2 border-orange-500/20">
                          <p className="text-xs text-orange-400 font-medium mb-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> AI Draft
                          </p>
                          <p className="text-sm text-gray-300 mb-3">
                            {review.aiSuggestion}
                          </p>

                          {/* Dismiss reason picker (inline) */}
                          {dismissingReasonId === review.id ? (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-400">
                                Why are you dismissing this draft?
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {DISMISS_REASONS.map(r => (
                                  <Button
                                    key={r.value}
                                    size="sm"
                                    variant="outline"
                                    disabled={dismissingId === review.id}
                                    onClick={() =>
                                      handleDismiss(review.id, r.value)
                                    }
                                    className="text-xs border-white/10 text-gray-300 hover:bg-white/5"
                                  >
                                    {dismissingId === review.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    ) : null}
                                    {r.label}
                                  </Button>
                                ))}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDismissingReasonId(null)}
                                  className="text-xs text-gray-500"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {/* One-tap Approve */}
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleApprove(review.id, review.aiSuggestion!)
                                }
                                disabled={approvingId === review.id}
                                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs"
                              >
                                {approvingId === review.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                )}
                                Approve &amp; Post
                              </Button>
                              {/* Edit then Approve */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReplyingTo(review.id);
                                  setReplyText(review.aiSuggestion!);
                                }}
                                className="border-white/10 text-gray-300 hover:bg-white/5 text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              {/* Dismiss */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDismissingReasonId(review.id)}
                                className="text-gray-500 hover:text-gray-300 text-xs"
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Edit form (pre-filled with AI draft or blank) */}
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
                            Post Reply
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
                    ) : !review.replyText &&
                      review.responseStatus !== 'dismissed' ? (
                      <div className="flex gap-2">
                        {!review.aiSuggestion && (
                          <>
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
                              Generate AI Draft
                            </Button>
                          </>
                        )}
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
                  : 'Reviews sync every 5 minutes via Google Business Profile.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
