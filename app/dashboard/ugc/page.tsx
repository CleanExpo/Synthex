'use client';

/**
 * UGC & Creators console — backlog #6 (the one remaining v1 dashboard gap).
 *
 * Surfaces the EXISTING org-scoped UGC + creator stores which had API routes
 * and Prisma models (`Creator`/`UgcSubmission`, `app/api/{ugc,creators}`) but no
 * dashboard surface. Two panels:
 *   • UGC moderation queue — GET /api/ugc?status= , PATCH /api/ugc {id,status}
 *   • Creator roster       — GET /api/creators
 *
 * No new API: every route already exists. Org-scoping is handled server-side
 * (clientId via withAuth + DB-layer RLS); the hooks key on the active org.
 */

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type UgcStatus = 'pending' | 'approved' | 'rejected';
type CreatorStatus = 'prospect' | 'contacted' | 'active' | 'declined';

interface UgcCreatorRef {
  id: string;
  name: string;
  handle: string | null;
}
interface UgcSubmissionItem {
  id: string;
  creatorId: string | null;
  assetUrl: string | null;
  caption: string | null;
  status: UgcStatus;
  submittedAt: string;
  createdAt: string;
  creator: UgcCreatorRef | null;
}
interface UgcResponse {
  submissions: UgcSubmissionItem[];
}

interface CreatorItem {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  email: string | null;
  followerCount: number | null;
  status: CreatorStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
interface CreatorsResponse {
  creators: CreatorItem[];
}

const UGC_STATUS_STYLES: Record<UgcStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const CREATOR_STATUS_STYLES: Record<CreatorStatus, string> = {
  prospect: 'bg-slate-100 text-slate-600 border-slate-200',
  contacted: 'bg-sky-50 text-sky-700 border-sky-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-slate-100 text-slate-500 border-slate-200',
};

const FILTERS: { label: string; value: UgcStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function UgcPage() {
  const [filter, setFilter] = useState<UgcStatus | 'all'>('pending');

  const ugcUrl =
    filter === 'all' ? '/api/ugc' : `/api/ugc?status=${filter}`;
  const {
    data: ugcData,
    isLoading: ugcLoading,
    error: ugcError,
    refetch: refetchUgc,
  } = useApi<UgcResponse>(ugcUrl);

  const submissions = ugcData?.submissions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Creators"
        title="UGC & Creators"
        description="Moderate creator submissions and track your creator roster."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* UGC moderation queue */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filter === f.value
                    ? 'border-slate-300 bg-slate-100 text-slate-900'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {ugcLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50"
                />
              ))}
            </div>
          )}

          {ugcError && !ugcLoading && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-red-600">
                Couldn&apos;t load submissions. {ugcError.message}
              </CardContent>
            </Card>
          )}

          {!ugcLoading && !ugcError && submissions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm font-light text-slate-500">
                  No {filter === 'all' ? '' : filter} submissions yet.
                </p>
              </CardContent>
            </Card>
          )}

          {!ugcLoading &&
            !ugcError &&
            submissions.map(submission => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                onModerated={refetchUgc}
              />
            ))}
        </div>

        {/* Creator roster */}
        <CreatorRoster />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UGC submission card — moderation actions (PATCH /api/ugc) on pending rows.
// ---------------------------------------------------------------------------

function SubmissionCard({
  submission,
  onModerated,
}: {
  submission: UgcSubmissionItem;
  onModerated: () => void;
}) {
  const { mutate: moderate, isLoading: moderating } = useMutation<
    { submission: UgcSubmissionItem },
    { id: string; status: 'approved' | 'rejected' }
  >(
    async ({ id, status }) => {
      const res = await fetch('/api/ugc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to moderate submission');
      }
      return res.json();
    },
    { onSuccess: onModerated }
  );

  const creatorLabel = submission.creator
    ? submission.creator.handle ?? submission.creator.name
    : 'Unattributed';

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-light text-slate-900">
              {creatorLabel}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(submission.submittedAt).toLocaleDateString('en-AU')}
            </p>
          </div>
          <Badge
            variant="outline"
            className={UGC_STATUS_STYLES[submission.status]}
          >
            {submission.status}
          </Badge>
        </div>

        {submission.caption && (
          <p className="text-sm font-light leading-relaxed text-slate-700">
            {submission.caption}
          </p>
        )}

        {submission.assetUrl && (
          <a
            href={submission.assetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block truncate text-xs text-cyan-600 hover:underline"
          >
            {submission.assetUrl}
          </a>
        )}

        {submission.status === 'pending' && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={moderating}
              onClick={() =>
                moderate({ id: submission.id, status: 'approved' })
              }
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={moderating}
              onClick={() =>
                moderate({ id: submission.id, status: 'rejected' })
              }
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Creator roster — read-only list from GET /api/creators.
// ---------------------------------------------------------------------------

function CreatorRoster() {
  const { data, isLoading, error } = useApi<CreatorsResponse>('/api/creators');
  const creators = data?.creators ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        Creator roster ({creators.length})
      </p>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-red-600">
            Couldn&apos;t load creators. {error.message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && creators.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-light text-slate-500">
              No creators yet.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        !error &&
        creators.map(creator => (
          <Card key={creator.id}>
            <CardContent className="space-y-1 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-light text-slate-900">
                  {creator.name}
                </span>
                <Badge
                  variant="outline"
                  className={CREATOR_STATUS_STYLES[creator.status]}
                >
                  {creator.status}
                </Badge>
              </div>
              <p className="truncate text-xs text-slate-500">
                {[
                  creator.handle,
                  creator.platform,
                  creator.followerCount != null
                    ? `${creator.followerCount.toLocaleString('en-AU')} followers`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
