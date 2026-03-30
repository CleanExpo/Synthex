'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Star,
  Check,
  X,
  Loader2,
  Filter,
  ExternalLink,
} from '@/components/icons';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

interface GBPReviewItem {
  id: string;
  reviewerName: string | null;
  reviewerAvatar: string | null;
  rating: number;
  comment: string | null;
  reviewTime: string;
  status: string;
  isFeatured: boolean;
  displayOnWidget: boolean;
  widgetOrder: number | null;
  sentiment: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  location: { locationName: string | null } | null;
}

interface ModerationResponse {
  reviews: GBPReviewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

type StatusFilter = 'all' | ReviewStatus;

// ── SWR fetcher ───────────────────────────────────────────────────────────────

async function fetchReviews(url: string): Promise<ModerationResponse> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json() as Promise<ModerationResponse>;
}

// ── Star rating display ───────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  hidden: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_STYLES[status] ?? STATUS_STYLES.hidden}`}
    >
      {status}
    </span>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onPatch,
  patchingId,
}: {
  review: GBPReviewItem;
  onPatch: (id: string, data: Partial<GBPReviewItem>) => Promise<void>;
  patchingId: string | null;
}) {
  const isPatching = patchingId === review.id;
  const reviewerName = review.reviewerName ?? 'Anonymous';
  const reviewedAt = new Date(review.reviewTime).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            {review.reviewerAvatar ? (
              <Image
                src={review.reviewerAvatar}
                alt={reviewerName}
                width={36}
                height={36}
                className="rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-400 font-bold text-sm">
                  {reviewerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-white text-sm font-semibold">{reviewerName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StarRow rating={review.rating} />
                <span className="text-white/30 text-xs">{reviewedAt}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={review.status} />
            {review.isFeatured && (
              <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-orange-500/10 text-orange-400 border-orange-500/20">
                Featured
              </span>
            )}
          </div>
        </div>

        {/* Location */}
        {review.location?.locationName && (
          <p className="text-white/30 text-xs mb-2">
            📍 {review.location.locationName}
          </p>
        )}

        {/* Comment */}
        {review.comment && (
          <p className="text-white/60 text-sm leading-relaxed mb-4 line-clamp-3">
            &ldquo;{review.comment}&rdquo;
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
          {/* Approve / Reject */}
          {review.status !== 'approved' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              disabled={isPatching}
              onClick={() => onPatch(review.id, { status: 'approved' })}
            >
              {isPatching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Approve
            </Button>
          )}

          {review.status !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
              disabled={isPatching}
              onClick={() => onPatch(review.id, { status: 'rejected' })}
            >
              <X className="w-3 h-3 mr-1" />
              Reject
            </Button>
          )}

          {/* Widget toggle */}
          <Button
            size="sm"
            variant="outline"
            className={`h-7 px-3 text-xs ${
              review.displayOnWidget
                ? 'border-blue-500/30 text-blue-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                : 'border-white/20 text-white/50 hover:bg-white/5'
            }`}
            disabled={isPatching}
            onClick={() =>
              onPatch(review.id, { displayOnWidget: !review.displayOnWidget })
            }
          >
            {review.displayOnWidget ? 'Hide from Widget' : 'Show on Widget'}
          </Button>

          {/* Feature toggle */}
          <Button
            size="sm"
            variant="outline"
            className={`h-7 px-3 text-xs ${
              review.isFeatured
                ? 'border-orange-500/30 text-orange-400 hover:bg-white/5 hover:text-white/50'
                : 'border-white/20 text-white/50 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30'
            }`}
            disabled={isPatching}
            onClick={() =>
              onPatch(review.id, { isFeatured: !review.isFeatured })
            }
          >
            {review.isFeatured ? '★ Unfeature' : '☆ Feature'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Filter pills ──────────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hidden', value: 'hidden' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const apiUrl = `/api/reviews/moderation?status=${statusFilter}&page=${page}&limit=20`;

  const { data, isLoading, mutate } = useSWR<ModerationResponse>(
    apiUrl,
    fetchReviews,
    { revalidateOnFocus: false }
  );

  const handleFilterChange = (f: StatusFilter) => {
    setStatusFilter(f);
    setPage(1);
  };

  const handlePatch = useCallback(
    async (reviewId: string, updates: Partial<GBPReviewItem>) => {
      setPatchingId(reviewId);
      try {
        const res = await fetch(`/api/reviews/moderation/${reviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          await mutate(); // Refresh the list
        }
      } finally {
        setPatchingId(null);
      }
    },
    [mutate]
  );

  const { reviews = [], pagination } = data ?? {};
  const hasNextPage = pagination ? page < pagination.pages : false;
  const hasPrevPage = page > 1;

  return (
    <div className="min-h-screen bg-[#0A0A12] p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/dashboard/google-business"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Google Business
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Reviews Moderation
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Control which Google reviews appear on your public widget
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/google-business/testimonials">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Customer Testimonials
              </Button>
            </Link>

            <Link href="/dashboard/google-business/reviews">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Reply to Reviews
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats strip */}
        {pagination && (
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Filter className="w-3.5 h-3.5" />
            <span>
              {pagination.total} review{pagination.total !== 1 ? 's' : ''}
              {statusFilter !== 'all' ? ` · ${statusFilter}` : ''}
            </span>
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                statusFilter === f.value
                  ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(255,107,53,0.3)]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg mb-2">No reviews found</p>
            <p className="text-white/20 text-sm">
              {statusFilter === 'all'
                ? 'Reviews will appear here once your Google Business Profile is synced.'
                : `No reviews with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onPatch={handlePatch}
                  patchingId={patchingId}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/70"
                  disabled={!hasPrevPage}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-white/40 text-sm">
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/70"
                  disabled={!hasNextPage}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
