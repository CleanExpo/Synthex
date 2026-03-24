'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { useGBPInsights } from '@/hooks/useGBPInsights';
import { useGBPReviews } from '@/hooks/useGBPReviews';
import { useNAPAudit } from '@/hooks/useNAPAudit';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { GBPConnectionBanner } from '@/components/google/GBPConnectionBanner';
import Link from 'next/link';
import {
  Map,
  Star,
  Eye,
  Phone,
  Globe,
  TrendingUp,
  MessageSquare,
  Quote,
  ArrowRight,
  MapPin,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle,
  Code,
  Copy,
} from '@/components/icons';

const FIELD_LABELS: Record<'name' | 'phone' | 'website', string> = {
  name: 'Name',
  phone: 'Phone',
  website: 'Website',
};

function NAPConsistencyWidget({ show }: { show: boolean }) {
  const { mismatches, allMatch, isLoading, error } = useNAPAudit();

  if (!show) return null;

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          {allMatch && !isLoading ? (
            <Shield className="w-5 h-5 text-orange-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          )}
          NAP Consistency
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-gray-500 py-2">
            Unable to load NAP audit data.
          </p>
        ) : allMatch ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              All details consistent across platforms
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mismatches.map(mismatch => (
              <div
                key={mismatch.field}
                className="p-3 bg-white/5 rounded-lg space-y-2"
              >
                <p className="text-sm font-semibold text-white">
                  {FIELD_LABELS[mismatch.field]}
                </p>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-28 shrink-0 pt-0.5">
                    Google (canonical)
                  </span>
                  <span className="text-xs text-orange-400 break-all">
                    {mismatch.canonical}
                  </span>
                </div>
                {mismatch.sources.map(src => (
                  <div key={src.source} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0 pt-0.5">
                      {src.label}
                    </span>
                    <span className="text-xs text-white break-all flex-1">
                      {src.value}
                    </span>
                    {src.editUrl && (
                      <a
                        href={src.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-400 hover:text-orange-300 shrink-0 underline"
                      >
                        Fix
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewEmbedWidget({
  show,
  orgSlug,
}: {
  show: boolean;
  orgSlug: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!show || !orgSlug) return null;

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://synthex.social';
  const reviewsApiUrl = `${origin}/api/public/reviews/${orgSlug}?min_rating=4&limit=6`;

  const embedSnippet = `<div id="synthex-reviews"></div>\n<script>\n(function(){\n  var el=document.getElementById('synthex-reviews');\n  fetch('${reviewsApiUrl}')\n    .then(function(r){return r.json()})\n    .then(function(d){\n      el.innerHTML=d.reviews.map(function(r){\n        return '<div class="synthex-review"><strong>'+r.reviewerName+'</strong><span>'+('\u2605'.repeat(r.rating))+'</span><p>'+r.comment+'</p></div>';\n      }).join('');\n    });\n})();\n<\/script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = embedSnippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-orange-400" />
            Embed Reviews on Your Website
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="flex items-center gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
        <p className="text-sm text-gray-300 mb-4">
          Copy this snippet and paste it into your website&apos;s HTML to
          display your Google reviews.
        </p>
        <pre className="bg-black/40 rounded border border-white/10 p-4 overflow-x-auto">
          <code className="text-xs text-gray-300 font-mono whitespace-pre">
            {embedSnippet}
          </code>
        </pre>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Icon className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-sm text-gray-300">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoogleBusinessPage() {
  const {
    locations,
    primaryLocation,
    isLoading: locationsLoading,
  } = useGBPLocations();
  const {
    totals,
    totalReviews,
    averageRating,
    isLoading: insightsLoading,
  } = useGBPInsights(primaryLocation?.id);
  const { reviews, isLoading: reviewsLoading } = useGBPReviews({
    locationId: primaryLocation?.id,
    limit: 5,
  });
  const { activeBusiness } = useActiveBusiness();

  const isLoading = locationsLoading || insightsLoading;
  const hasLocations = locations.length > 0;

  // Derive org slug from the active business for the embed widget
  const orgSlug = activeBusiness?.organizationSlug ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Map className="w-8 h-8 text-orange-400" />
          Google Business Profile
        </h1>
        <p className="text-gray-300 mt-2">
          Manage your business listings, reviews, and local search performance
        </p>
      </div>

      {!hasLocations && !isLoading && <GBPConnectionBanner />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : hasLocations ? (
        <>
          {/* Current Location */}
          {primaryLocation && (
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-white font-semibold">
                      {primaryLocation.locationName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {primaryLocation.phone}{' '}
                      {primaryLocation.website
                        ? `· ${primaryLocation.website}`
                        : ''}
                    </p>
                  </div>
                  {primaryLocation.verified && (
                    <span className="ml-auto px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">
                      Verified
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Search Views"
              value={totals.searchViews.toLocaleString()}
              icon={Eye}
            />
            <MetricCard
              label="Maps Views"
              value={totals.mapsViews.toLocaleString()}
              icon={Map}
            />
            <MetricCard
              label="Website Clicks"
              value={totals.websiteClicks.toLocaleString()}
              icon={Globe}
            />
            <MetricCard
              label="Phone Clicks"
              value={totals.phoneClicks.toLocaleString()}
              icon={Phone}
            />
            <MetricCard
              label="Directions"
              value={totals.directionClicks.toLocaleString()}
              icon={TrendingUp}
            />
          </div>

          {/* NAP Consistency Audit — after metrics grid, before rating summary */}
          <NAPConsistencyWidget show={hasLocations} />

          {/* Rating + Reviews Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-orange-400" />
                  Rating Overview
                </h2>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-5xl font-bold text-white">
                    {averageRating ? averageRating.toFixed(1) : '--'}
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(averageRating || 0)
                            ? 'text-orange-400'
                            : 'text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-300">
                  Based on {totalReviews} reviews
                </p>
              </CardContent>
            </Card>

            <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-orange-400" />
                    Recent Reviews
                  </h2>
                  <Link
                    href="/dashboard/google-business/reviews"
                    className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {reviewsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.slice(0, 3).map(review => (
                      <div
                        key={review.id}
                        className="p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white font-medium">
                            {review.reviewerName || 'Anonymous'}
                          </span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${
                                  star <= review.rating
                                    ? 'text-orange-400'
                                    : 'text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-gray-300 line-clamp-2">
                            {review.comment}
                          </p>
                        )}
                        {!review.replyText && (
                          <span className="text-[10px] text-red-400 mt-1 inline-block">
                            Needs reply
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No reviews yet. Reviews will appear after the daily sync.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/google-business/reviews">
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10 hover:border-orange-500/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-medium">
                    Review Management
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-500 ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/google-business/posts">
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10 hover:border-orange-500/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Globe className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-medium">Google Posts</span>
                  <ArrowRight className="w-4 h-4 text-gray-500 ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/google-business/insights">
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10 hover:border-orange-500/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-medium">
                    Performance Insights
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-500 ml-auto" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/google-business/testimonials">
              <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10 hover:border-orange-500/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Quote className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-medium">Testimonials</span>
                  <ArrowRight className="w-4 h-4 text-gray-500 ml-auto" />
                </CardContent>
              </Card>
            </Link>
          </div>
          {/* Review Embed Snippet — after quick links */}
          <ReviewEmbedWidget show={hasLocations} orgSlug={orgSlug} />
        </>
      ) : null}
    </div>
  );
}
