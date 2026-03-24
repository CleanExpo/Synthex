'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Quote,
  Star,
  Loader2,
  Check,
  X,
  ExternalLink,
  Copy,
  Plus,
  Video,
  Filter,
} from '@/components/icons';
import {
  useTestimonials,
  type TestimonialStatus,
} from '@/hooks/useTestimonials';
import { useTestimonialRequests } from '@/hooks/useTestimonialRequests';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | TestimonialStatus;
type MainTab = 'incoming' | 'requests';

interface CreateLinkForm {
  title: string;
  subtitle: string;
  expiresInDays: string;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-orange-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────

function TestimonialCard({
  testimonial,
  onApprove,
  onReject,
  onPostToGmb,
  actionLoading,
}: {
  testimonial: import('@/hooks/useTestimonials').TestimonialItem;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onPostToGmb: (id: string) => Promise<void>;
  actionLoading: string | null;
}) {
  const isLoading = actionLoading === testimonial.id;
  const isPosted = !!testimonial.postedToGmbAt;

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-400 font-bold text-sm">
                {(testimonial.submitterName || 'A')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">
                {testimonial.submitterName}
              </p>
              {testimonial.submitterEmail && (
                <p className="text-xs text-gray-500">
                  {testimonial.submitterEmail}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StarRating rating={testimonial.rating} />
            <span className="text-[11px] text-gray-500">
              {new Date(testimonial.createdAt).toLocaleDateString('en-AU')}
            </span>
          </div>
        </div>

        {/* Campaign label */}
        <p className="text-[11px] text-orange-400/70 mb-2">
          Campaign: {testimonial.request.title}
        </p>

        {/* Testimonial text */}
        <p className="text-sm text-gray-300 mb-3 leading-relaxed">
          {testimonial.text}
        </p>

        {/* Photo thumbnails */}
        {testimonial.photoUrls.length > 0 && (
          <div className="flex gap-2 mb-3">
            {testimonial.photoUrls.slice(0, 3).map((url, idx) => (
              <div
                key={idx}
                className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0"
              >
                <Image
                  src={url}
                  alt={`Photo ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ))}
            {testimonial.photoUrls.length > 3 && (
              <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-gray-400">
                  +{testimonial.photoUrls.length - 3}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Video indicator */}
        {testimonial.videoUrl && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-orange-400">
            <Video className="w-3.5 h-3.5" />
            <span>Video testimonial attached</span>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {testimonial.status === 'pending' && (
            <>
              <Button
                size="sm"
                disabled={isLoading}
                onClick={() => onApprove(testimonial.id)}
                className="bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 text-xs"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => onReject(testimonial.id)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </>
          )}

          {testimonial.status === 'approved' && (
            <>
              {isPosted ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">
                  <Check className="w-3 h-3" />
                  Posted to GMB
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onPostToGmb(testimonial.id)}
                  className="bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 text-xs"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <ExternalLink className="w-3 h-3 mr-1" />
                  )}
                  Post to GMB
                </Button>
              )}
            </>
          )}

          {testimonial.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-400 rounded-full text-xs font-medium">
              <X className="w-3 h-3" />
              Rejected
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Incoming Tab ─────────────────────────────────────────────────────────────

function IncomingTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { items, pages, isLoading, refresh } = useTestimonials({
    status: statusFilter,
    page,
  });

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'approved' }),
      });
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected' }),
      });
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handlePostToGmb = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/testimonials/${id}/post-to-gmb`, {
        method: 'POST',
        credentials: 'include',
      });
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const emptyMessages: Record<StatusFilter, string> = {
    all: 'No testimonials received yet.',
    pending: 'No pending testimonials to review.',
    approved: 'No approved testimonials.',
    rejected: 'No rejected testimonials.',
  };

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {STATUS_FILTERS.map(f => (
          <Button
            key={f.value}
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`text-xs ${
              statusFilter === f.value
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                : 'border-white/10 text-gray-300 hover:bg-white/5'
            }`}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="space-y-4">
            {items.map(t => (
              <TestimonialCard
                key={t.id}
                testimonial={t}
                onApprove={handleApprove}
                onReject={handleReject}
                onPostToGmb={handlePostToGmb}
                actionLoading={actionLoading}
              />
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
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
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="border-white/10 text-gray-300"
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Quote className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Testimonials Found
          </h3>
          <p className="text-gray-400 text-sm">{emptyMessages[statusFilter]}</p>
        </div>
      )}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────

function RequestsTab() {
  const { items, isLoading, refresh } = useTestimonialRequests();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateLinkForm>({
    title: '',
    subtitle: '',
    expiresInDays: '',
  });
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const body: {
        title: string;
        subtitle?: string;
        expiresInDays?: number;
      } = { title: form.title.trim() };
      if (form.subtitle.trim()) body.subtitle = form.subtitle.trim();
      if (form.expiresInDays.trim()) {
        const days = parseInt(form.expiresInDays, 10);
        if (!isNaN(days) && days > 0) body.expiresInDays = days;
      }

      await fetch('/api/testimonials/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      setForm({ title: '', subtitle: '', expiresInDays: '' });
      setShowForm(false);
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create New Link
        </Button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/20">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              New Collection Link
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Title <span className="text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Share Your Experience"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Subtitle (optional)
              </label>
              <input
                type="text"
                value={form.subtitle}
                onChange={e =>
                  setForm(f => ({ ...f, subtitle: e.target.value }))
                }
                placeholder="Tell us what you think"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Expires in days (optional)
              </label>
              <input
                type="number"
                min="1"
                value={form.expiresInDays}
                onChange={e =>
                  setForm(f => ({ ...f, expiresInDays: e.target.value }))
                }
                placeholder="e.g. 30"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                disabled={creating || !form.title.trim()}
                onClick={handleCreate}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs"
              >
                {creating ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                Create Link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                className="text-gray-400 text-xs"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map(item => {
            const isExpired =
              item.expiresAt !== null && new Date(item.expiresAt) < new Date();
            const statusActive = item.isActive && !isExpired;

            return (
              <Card
                key={item.id}
                className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium text-sm">
                          {item.title}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            statusActive
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          {statusActive ? 'Active' : 'Expired'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-medium">
                          {item.submissionCount}{' '}
                          {item.submissionCount === 1
                            ? 'submission'
                            : 'submissions'}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                      {item.expiresAt && (
                        <p className="text-[11px] text-gray-600 mt-1">
                          {isExpired ? 'Expired' : 'Expires'}{' '}
                          {new Date(item.expiresAt).toLocaleDateString('en-AU')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(item.url, item.id)}
                        className={`text-xs ${
                          copiedId === item.id
                            ? 'border-green-500/30 text-green-400 bg-green-500/10'
                            : 'border-white/10 text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                        title="Open form"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Quote className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Collection Links Yet
          </h3>
          <p className="text-gray-400 text-sm">
            Create a shareable link to start collecting testimonials from your
            customers.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('incoming');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/google-business"
          className="text-sm text-gray-300 hover:text-orange-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Business
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Quote className="w-7 h-7 text-orange-400" />
          Testimonial Management
        </h1>
        <p className="text-gray-300 mt-1">
          Collect, review, and publish customer testimonials to Google Business
        </p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'incoming'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Incoming
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'requests'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Request Links
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'incoming' ? <IncomingTab /> : <RequestsTab />}
    </div>
  );
}
