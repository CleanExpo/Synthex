'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { useGBPInsights } from '@/hooks/useGBPInsights';
import { useGBPReviews } from '@/hooks/useGBPReviews';
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
  ArrowRight,
  MapPin,
  Loader2,
} from '@/components/icons';

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

  const isLoading = locationsLoading || insightsLoading;
  const hasLocations = locations.length > 0;

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>
        </>
      ) : null}
    </div>
  );
}
