'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Map,
  Plus,
  MapPin,
  Eye,
  Star,
  StarSolid,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Phone,
  Search,
  Globe,
  Calendar,
  Info,
  Filter,
  Send,
  ArrowRight,
  Loader2,
  Sparkles,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';
import { CompositeHealthWidget } from '@/components/dashboard/CompositeHealthWidget';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { useGBPReviews } from '@/hooks/useGBPReviews';
import { useGBPInsights } from '@/hooks/useGBPInsights';
import { useSearchConsole } from '@/hooks/useSearchConsole';
import { fetchJson } from '@/lib/fetcher';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// ============================================
// CASE STUDIES (existing functionality)
// ============================================

interface CaseStudy {
  id: number;
  title: string;
  slug: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  summary: string;
  publishedAt: string | null;
  createdAt: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StarRating({
  rating,
  size = 'sm',
}: {
  rating: number;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star =>
        star <= rating ? (
          <StarSolid key={star} className={`${iconClass} text-orange-400`} />
        ) : (
          <Star key={star} className={`${iconClass} text-gray-600`} />
        )
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColour = 'text-orange-400',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  iconColour?: string;
}) {
  return (
    <Card className="bg-surface-base/80 border border-orange-500/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-300">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-white/5 ${iconColour}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankChange({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = previous - current;
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
        <TrendingUp className="h-4 w-4" />+{diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="flex items-center gap-1 text-rose-400 text-sm font-medium">
        <TrendingDown className="h-4 w-4" />
        {diff}
      </span>
    );
  }
  return <span className="text-gray-500 text-sm">—</span>;
}

function ConnectCTA({ platform, label }: { platform: string; label: string }) {
  return (
    <Card className="bg-surface-base/80 border border-orange-500/10">
      <CardContent className="p-12 text-center text-gray-300">
        <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Connect {label} to see real data</p>
        <Button
          className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => {
            window.location.href = `/api/auth/oauth/${platform}?returnTo=/dashboard/local`;
          }}
        >
          <Globe className="h-4 w-4 mr-2" />
          Connect {label}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function LocalPage() {
  // GBP data hooks
  const {
    locations,
    primaryLocation,
    isLoading: locationsLoading,
  } = useGBPLocations();
  const primaryLocationId = primaryLocation?.id;
  const hasGbp = locations.length > 0;

  const {
    totals: insightsTotals,
    totalReviews,
    averageRating,
    trend: insightsTrend,
    isLoading: insightsLoading,
  } = useGBPInsights(primaryLocationId, 30);

  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const {
    reviews,
    isLoading: reviewsLoading,
    refresh: refreshReviews,
  } = useGBPReviews({
    locationId: primaryLocationId,
    rating: ratingFilter ?? undefined,
  });

  // GSC data for rankings
  const {
    searchAnalytics,
    fetchAnalytics,
    isLoading: gscLoading,
  } = useSearchConsole();
  const [rankingsLoaded, setRankingsLoaded] = useState(false);

  // Posts via SWR
  const { data: postsData, isLoading: postsLoading } = useSWR<{
    success: boolean;
    posts?: Array<{
      id: string;
      text: string;
      date: string;
      status: string;
      type: string;
    }>;
  }>(hasGbp ? '/api/google-business/posts' : null, fetchJson);
  const posts = postsData?.posts ?? [];

  // Case studies state (existing)
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [caseStudiesLoading, setCaseStudiesLoading] = useState(true);

  // Reviews UI state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Fetch case studies (existing)
  useEffect(() => {
    fetchCaseStudies();
  }, []);

  // Fetch rankings when GSC is available
  useEffect(() => {
    if (!rankingsLoaded && hasGbp) {
      // Try to fetch search analytics with query dimension for rankings
      fetchAnalytics?.('', { dimensions: ['query'], rowLimit: 20 })
        .then(() => setRankingsLoaded(true))
        .catch(() => {});
    }
  }, [hasGbp, rankingsLoaded, fetchAnalytics]);

  const fetchCaseStudies = async () => {
    try {
      setCaseStudiesLoading(true);
      const res = await fetch('/api/local/case-studies', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCaseStudies(data.caseStudies || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCaseStudiesLoading(false);
    }
  };

  // Derive rankings from search analytics
  const rankings = (searchAnalytics?.rows ?? []).map(
    (row: {
      keys: string[];
      position: number;
      clicks: number;
      impressions: number;
    }) => ({
      keyword: row.keys?.[0] ?? '',
      rank: Math.round(row.position),
      clicks: row.clicks,
      impressions: row.impressions,
    })
  );

  // Derive chart data from insights trend
  const viewsChartData = insightsTrend.map(
    (t: {
      date: string;
      searchViews: number | null;
      mapsViews: number | null;
    }) => ({
      day: new Date(t.date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
      }),
      views: (t.searchViews ?? 0) + (t.mapsViews ?? 0),
    })
  );

  // Aggregate weekly actions for bar chart
  const actionsChartData = (() => {
    if (insightsTrend.length === 0) return [];
    const weeks: Array<{
      name: string;
      websiteClicks: number;
      phoneCalls: number;
      directions: number;
    }> = [];
    for (let i = 0; i < insightsTrend.length; i += 7) {
      const chunk = insightsTrend.slice(i, i + 7);
      weeks.push({
        name: `Week ${weeks.length + 1}`,
        websiteClicks: chunk.reduce(
          (s: number, d) =>
            s + ((d as { websiteClicks?: number | null }).websiteClicks ?? 0),
          0
        ),
        phoneCalls: chunk.reduce(
          (s: number, d) =>
            s + ((d as { phoneClicks?: number | null }).phoneClicks ?? 0),
          0
        ),
        directions: chunk.reduce(
          (s: number, d) =>
            s +
            ((d as { directionClicks?: number | null }).directionClicks ?? 0),
          0
        ),
      });
    }
    return weeks;
  })();

  return (
    <GEOFeatureGate
      feature="Local SEO Dashboard"
      requiredPlan="professional"
      description="Manage your Google Business Profile, track local rankings, monitor reviews, and optimise your local SEO performance."
      benefits={[
        'Google Business Profile management and insights',
        'Local keyword ranking tracker',
        'Review monitoring with AI-powered response suggestions',
        'GBP post scheduling and analytics',
      ]}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MapPin className="h-7 w-7 text-orange-400" />
            Local SEO Dashboard
          </h1>
          <p className="text-gray-300 mt-1">
            Manage your Google Business Profile, track rankings, and grow local
            visibility
          </p>
        </div>

        {/* Connect GBP Banner — only show when not connected */}
        {!hasGbp && !locationsLoading && (
          <Card className="bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-orange-400 flex-shrink-0" />
                <p className="text-sm text-gray-300">
                  Connect your Google Business Profile to see live data and
                  manage your listing directly.
                </p>
              </div>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0"
                onClick={() => {
                  window.location.href =
                    '/api/auth/oauth/googlebusiness?returnTo=/dashboard/local';
                }}
              >
                <Globe className="h-4 w-4 mr-2" />
                Connect GBP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabbed Dashboard */}
        <Tabs defaultValue="overview">
          <TabsList
            variant="glass-primary"
            className="w-full justify-start flex-wrap gap-1"
          >
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5">
              <Star className="h-4 w-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="rankings" className="gap-1.5">
              <Search className="h-4 w-4" />
              Rankings
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="case-studies" className="gap-1.5">
              <Map className="h-4 w-4" />
              Case Studies
            </TabsTrigger>
          </TabsList>

          {/* ========== OVERVIEW TAB ========== */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Composite Health Score */}
            <CompositeHealthWidget />

            {!hasGbp && !locationsLoading ? (
              <ConnectCTA
                platform="googlebusiness"
                label="Google Business Profile"
              />
            ) : insightsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Rating highlight */}
                <Card className="bg-surface-base/80 border border-orange-500/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl font-bold text-white">
                        {averageRating > 0 ? averageRating.toFixed(1) : '—'}
                      </div>
                      <div>
                        <StarRating
                          rating={Math.round(averageRating)}
                          size="md"
                        />
                        <p className="text-sm text-gray-300 mt-1">
                          Based on {totalReviews} review
                          {totalReviews !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard
                    icon={Eye}
                    label="Views this month"
                    value={(
                      insightsTotals.searchViews + insightsTotals.mapsViews
                    ).toLocaleString()}
                    subtext="Profile views on Google"
                  />
                  <MetricCard
                    icon={Globe}
                    label="Website clicks"
                    value={insightsTotals.websiteClicks.toLocaleString()}
                    subtext="Clicks to your website"
                  />
                  <MetricCard
                    icon={Phone}
                    label="Phone calls"
                    value={insightsTotals.phoneClicks}
                    subtext="Calls from your listing"
                    iconColour="text-emerald-400"
                  />
                  <MetricCard
                    icon={MapPin}
                    label="Direction requests"
                    value={insightsTotals.directionClicks}
                    subtext="Get directions taps"
                    iconColour="text-orange-400"
                  />
                  <MetricCard
                    icon={Search}
                    label="Search views"
                    value={insightsTotals.searchViews.toLocaleString()}
                    subtext="Seen in Google Search"
                  />
                  <MetricCard
                    icon={MessageSquare}
                    label="Total reviews"
                    value={totalReviews}
                    subtext={
                      averageRating > 0
                        ? `${averageRating.toFixed(1)} average rating`
                        : 'No reviews yet'
                    }
                    iconColour="text-orange-400"
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* ========== REVIEWS TAB ========== */}
          <TabsContent value="reviews" className="space-y-6 mt-6">
            {!hasGbp && !locationsLoading ? (
              <ConnectCTA
                platform="googlebusiness"
                label="Google Business Profile"
              />
            ) : (
              <>
                {/* Filter bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm text-gray-300 mr-2">
                    <Filter className="h-4 w-4" />
                    Filter:
                  </div>
                  {[null, 5, 4, 3, 2, 1].map(rating => (
                    <Button
                      key={rating ?? 'all'}
                      variant="ghost"
                      size="sm"
                      onClick={() => setRatingFilter(rating)}
                      className={`text-sm ${
                        ratingFilter === rating
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {rating === null ? 'All' : `${rating}\u2605`}
                    </Button>
                  ))}
                </div>

                {/* Reviews list */}
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map(review => (
                      <Card
                        key={review.id}
                        className="bg-surface-base/80 border border-orange-500/10"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-white">
                                  {review.reviewerName ?? 'Anonymous'}
                                </span>
                                <StarRating rating={review.rating} />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(review.reviewTime).toLocaleDateString(
                                  'en-AU'
                                )}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-400 hover:text-orange-300"
                              onClick={() => {
                                setReplyingTo(
                                  replyingTo === review.id ? null : review.id
                                );
                                setReplyText('');
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Reply
                            </Button>
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {review.comment ?? 'No comment provided'}
                          </p>

                          {/* AI suggestion */}
                          {!review.replyText && review.aiSuggestion && (
                            <div className="mt-3 rounded-lg bg-orange-500/10 border-[0.5px] border-orange-500/20 p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                                <span className="text-xs font-medium text-orange-400">
                                  AI Suggested Reply
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 leading-relaxed mb-3">
                                {review.aiSuggestion}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                                  onClick={() => {
                                    setReplyText(review.aiSuggestion!);
                                    setReplyingTo(review.id);
                                  }}
                                >
                                  Use Suggestion
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-orange-400 hover:text-orange-300 text-xs"
                                  disabled={generatingFor === review.id}
                                  onClick={async () => {
                                    setGeneratingFor(review.id);
                                    try {
                                      await fetch(
                                        `/api/google-business/reviews/${review.id}/auto-reply`,
                                        {
                                          method: 'POST',
                                          credentials: 'include',
                                        }
                                      );
                                      await refreshReviews();
                                    } catch (err) {
                                      console.error(
                                        'Failed to generate suggestion:',
                                        err
                                      );
                                    } finally {
                                      setGeneratingFor(null);
                                    }
                                  }}
                                >
                                  {generatingFor === review.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : null}
                                  Generate New
                                </Button>
                              </div>
                            </div>
                          )}
                          {!review.replyText && !review.aiSuggestion && (
                            <button
                              type="button"
                              className="mt-2 inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colours disabled:opacity-50"
                              disabled={generatingFor === review.id}
                              onClick={async () => {
                                setGeneratingFor(review.id);
                                try {
                                  await fetch(
                                    `/api/google-business/reviews/${review.id}/auto-reply`,
                                    {
                                      method: 'POST',
                                      credentials: 'include',
                                    }
                                  );
                                  await refreshReviews();
                                } catch (err) {
                                  console.error(
                                    'Failed to generate suggestion:',
                                    err
                                  );
                                } finally {
                                  setGeneratingFor(null);
                                }
                              }}
                            >
                              {generatingFor === review.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              Get AI Suggestion
                            </button>
                          )}

                          {/* Existing reply */}
                          {review.replyText && (
                            <div className="mt-3 pl-4 border-l-2 border-orange-500/20">
                              <p className="text-xs text-orange-400 mb-1">
                                Your reply:
                              </p>
                              <p className="text-sm text-gray-300">
                                {review.replyText}
                              </p>
                            </div>
                          )}

                          {/* Inline reply composer */}
                          {replyingTo === review.id && (
                            <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                              <Textarea
                                variant="glass"
                                resize="none"
                                placeholder="Write your reply..."
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                className="min-h-[80px]"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-300"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700 text-white"
                                  disabled={!replyText.trim()}
                                >
                                  <Send className="h-3.5 w-3.5 mr-1.5" />
                                  Send Reply
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {reviews.length === 0 && (
                      <Card className="bg-surface-base/80 border border-orange-500/10">
                        <CardContent className="p-12 text-center text-gray-300">
                          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>
                            {ratingFilter
                              ? 'No reviews match this filter'
                              : 'No reviews yet'}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ========== INSIGHTS TAB ========== */}
          <TabsContent value="insights" className="space-y-6 mt-6">
            {!hasGbp && !locationsLoading ? (
              <ConnectCTA
                platform="googlebusiness"
                label="Google Business Profile"
              />
            ) : insightsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
              </div>
            ) : viewsChartData.length === 0 ? (
              <Card className="bg-surface-base/80 border border-orange-500/10">
                <CardContent className="p-12 text-center text-gray-300">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>
                    No insights data yet — check back once your listing has
                    activity
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Views line chart */}
                <Card className="bg-surface-base/80 border border-orange-500/10">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Eye className="h-5 w-5 text-orange-400" />
                      Profile Views — Last 30 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={viewsChartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                          />
                          <XAxis
                            dataKey="day"
                            stroke="#6b7280"
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            interval={4}
                          />
                          <YAxis
                            stroke="#6b7280"
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid rgba(245,158,11,0.2)',
                              borderRadius: '8px',
                              color: '#fff',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="views"
                            stroke="#ffdcc2"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: '#ffdcc2' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions bar chart */}
                {actionsChartData.length > 0 && (
                  <Card className="bg-surface-base/80 border border-orange-500/10">
                    <CardHeader>
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-orange-400" />
                        Actions Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={actionsChartData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.05)"
                            />
                            <XAxis
                              dataKey="name"
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <YAxis
                              stroke="#6b7280"
                              tick={{ fill: '#9ca3af', fontSize: 12 }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid rgba(245,158,11,0.2)',
                                borderRadius: '8px',
                                color: '#fff',
                              }}
                            />
                            <Bar
                              dataKey="websiteClicks"
                              name="Website Clicks"
                              fill="#ffdcc2"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="phoneCalls"
                              name="Phone Calls"
                              fill="#34d399"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="directions"
                              name="Directions"
                              fill="#f59e0b"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-6 mt-4 justify-center">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <div className="w-3 h-3 rounded-sm bg-[#ffdcc2]" />
                          Website Clicks
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                          Phone Calls
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <div className="w-3 h-3 rounded-sm bg-orange-400" />
                          Directions
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ========== RANKINGS TAB ========== */}
          <TabsContent value="rankings" className="space-y-6 mt-6">
            {rankings.length === 0 && !gscLoading ? (
              <ConnectCTA
                platform="searchconsole"
                label="Google Search Console"
              />
            ) : (
              <Card className="bg-surface-base/80 border border-orange-500/10">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Search className="h-5 w-5 text-orange-400" />
                    Local Keyword Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gscLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-gray-300 font-medium">
                              Keyword
                            </th>
                            <th className="text-center py-3 px-4 text-gray-300 font-medium">
                              Position
                            </th>
                            <th className="text-center py-3 px-4 text-gray-300 font-medium">
                              Clicks
                            </th>
                            <th className="text-right py-3 px-4 text-gray-300 font-medium">
                              Impressions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankings.map(
                            (row: {
                              keyword: string;
                              rank: number;
                              clicks: number;
                              impressions: number;
                            }) => (
                              <tr
                                key={row.keyword}
                                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="py-3 px-4 text-white font-medium">
                                  {row.keyword}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Badge
                                    className={
                                      row.rank <= 3
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : row.rank <= 10
                                          ? 'bg-orange-500/20 text-orange-400'
                                          : 'bg-gray-500/20 text-gray-300'
                                    }
                                  >
                                    #{row.rank}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-center text-gray-300">
                                  {row.clicks.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-500">
                                  {row.impressions.toLocaleString()}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ========== POSTS TAB ========== */}
          <TabsContent value="posts" className="space-y-6 mt-6">
            {!hasGbp && !locationsLoading ? (
              <ConnectCTA
                platform="googlebusiness"
                label="Google Business Profile"
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    GBP Posts
                  </h2>
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Post
                  </Button>
                </div>

                {postsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 text-orange-400 animate-spin" />
                  </div>
                ) : posts.length === 0 ? (
                  <Card className="bg-surface-base/80 border border-orange-500/10">
                    <CardContent className="p-12 text-center text-gray-300">
                      <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>No GBP posts yet</p>
                      <p className="text-sm mt-1">
                        Create your first post to engage local customers
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map(post => (
                      <Card
                        key={post.id}
                        className="bg-surface-base/80 border border-orange-500/10 hover:border-orange-500/20 transition-all"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                              {post.type || 'Update'}
                            </Badge>
                            <Badge
                              className={
                                post.status === 'published'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-orange-500/20 text-orange-400'
                              }
                            >
                              {post.status === 'published'
                                ? 'Published'
                                : 'Scheduled'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-3 mb-3">
                            {post.text}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(post.date).toLocaleDateString('en-AU')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ========== CASE STUDIES TAB ========== */}
          <TabsContent value="case-studies" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Local Case Studies
                </h2>
                <p className="text-sm text-gray-300 mt-0.5">
                  Hyper-local case studies with NAP consistency and location
                  schema
                </p>
              </div>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="h-4 w-4 mr-2" />
                New Case Study
              </Button>
            </div>

            {caseStudiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card
                    key={i}
                    className="bg-surface-base/80 border border-orange-500/10"
                  >
                    <CardContent className="p-6 animate-pulse space-y-3">
                      <div className="h-6 bg-white/10 rounded w-2/3" />
                      <div className="h-4 bg-white/10 rounded w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : caseStudies.length === 0 ? (
              <Card className="bg-surface-base/80 border border-orange-500/10">
                <CardContent className="p-12 text-center text-gray-300">
                  <Map className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No case studies yet</p>
                  <p className="text-sm mt-1">
                    Create suburb-level case studies to boost local SEO
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caseStudies.map(cs => (
                  <Card
                    key={cs.id}
                    className="bg-surface-base/80 border border-orange-500/10 hover:border-orange-500/30 transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">
                          {cs.title}
                        </h3>
                        <Badge
                          className={
                            cs.publishedAt
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-500/20 text-gray-300'
                          }
                        >
                          {cs.publishedAt ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                        <MapPin className="h-4 w-4 text-orange-400" />
                        <span>
                          {cs.suburb}, {cs.city}, {cs.state} {cs.postcode}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {cs.summary}
                      </p>
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-400"
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </GEOFeatureGate>
  );
}
