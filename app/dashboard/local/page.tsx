'use client';

import { useState, useEffect } from 'react';
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
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';
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
// MOCK DATA
// ============================================

const OVERVIEW_METRICS = {
  totalReviews: 147,
  averageRating: 4.6,
  viewsThisMonth: 3842,
  clicksThisMonth: 612,
  callsThisMonth: 89,
  directionsThisMonth: 156,
  searchImpressions: 12450,
};

const MOCK_REVIEWS = [
  {
    id: 1,
    reviewer: 'Sarah M.',
    rating: 5,
    date: '2026-02-25',
    text: 'Absolutely brilliant service. The team was on time, professional, and the quality of work exceeded my expectations. Would highly recommend to anyone in the area.',
  },
  {
    id: 2,
    reviewer: 'James K.',
    rating: 4,
    date: '2026-02-22',
    text: 'Great experience overall. Communication was clear and the job was done well. Only reason for 4 stars is the scheduling took a bit longer than expected.',
  },
  {
    id: 3,
    reviewer: 'Michelle T.',
    rating: 5,
    date: '2026-02-18',
    text: 'Second time using this business and they never disappoint. Friendly staff, fair pricing, and outstanding results every time.',
  },
  {
    id: 4,
    reviewer: 'David R.',
    rating: 3,
    date: '2026-02-14',
    text: 'Decent work but took longer than the original quote suggested. End result was fine, though the process could have been smoother.',
  },
  {
    id: 5,
    reviewer: 'Emma L.',
    rating: 5,
    date: '2026-02-10',
    text: 'Cannot fault this business. From the initial enquiry to the final walkthrough, everything was handled perfectly. Best in Sydney!',
  },
  {
    id: 6,
    reviewer: 'Tom W.',
    rating: 2,
    date: '2026-02-06',
    text: 'Had some issues with the initial visit — the technician arrived late and seemed rushed. The follow-up was better but first impressions matter.',
  },
];

const INSIGHTS_VIEWS_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `Feb ${i + 1}`,
  views: Math.floor(80 + Math.random() * 120 + (i > 15 ? 30 : 0)),
}));

const INSIGHTS_ACTIONS_DATA = [
  { name: 'Week 1', websiteClicks: 45, phoneCalls: 12, directions: 28 },
  { name: 'Week 2', websiteClicks: 52, phoneCalls: 18, directions: 34 },
  { name: 'Week 3', websiteClicks: 61, phoneCalls: 15, directions: 31 },
  { name: 'Week 4', websiteClicks: 58, phoneCalls: 22, directions: 41 },
];

const RANKINGS_DATA = [
  { keyword: 'plumber sydney', rank: 3, previous: 5, lastChecked: '2026-02-28' },
  { keyword: 'emergency plumber near me', rank: 2, previous: 2, lastChecked: '2026-02-28' },
  { keyword: 'blocked drain sydney', rank: 5, previous: 4, lastChecked: '2026-02-28' },
  { keyword: 'hot water system repair', rank: 4, previous: 7, lastChecked: '2026-02-27' },
  { keyword: 'plumber inner west', rank: 1, previous: 1, lastChecked: '2026-02-28' },
  { keyword: 'gas fitting sydney', rank: 8, previous: 6, lastChecked: '2026-02-27' },
  { keyword: 'bathroom renovation plumber', rank: 6, previous: 9, lastChecked: '2026-02-27' },
  { keyword: 'leak detection sydney', rank: 3, previous: 3, lastChecked: '2026-02-28' },
  { keyword: 'commercial plumber sydney cbd', rank: 7, previous: 10, lastChecked: '2026-02-26' },
  { keyword: '24 hour plumber sydney', rank: 4, previous: 4, lastChecked: '2026-02-28' },
];

const MOCK_POSTS = [
  {
    id: 1,
    text: 'Summer special! 15% off all hot water system installations this February. Book now before spots fill up.',
    date: '2026-02-20',
    status: 'published' as const,
    type: 'Offer',
  },
  {
    id: 2,
    text: 'Just completed a major bathroom renovation in Newtown. Check out the before and after photos!',
    date: '2026-02-15',
    status: 'published' as const,
    type: 'Update',
  },
  {
    id: 3,
    text: 'Reminder: Regular drain maintenance can prevent costly emergency call-outs. Book your annual check today.',
    date: '2026-02-10',
    status: 'published' as const,
    type: 'Update',
  },
  {
    id: 4,
    text: 'We now offer same-day service for emergency plumbing in the Inner West. Call us anytime!',
    date: '2026-03-01',
    status: 'scheduled' as const,
    type: 'Update',
  },
];

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

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        star <= rating ? (
          <StarSolid key={star} className={`${iconClass} text-amber-400`} />
        ) : (
          <Star key={star} className={`${iconClass} text-gray-600`} />
        )
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconColour = 'text-cyan-400',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  iconColour?: string;
}) {
  return (
    <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400">{label}</p>
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

function RankChange({ current, previous }: { current: number; previous: number }) {
  const diff = previous - current;
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
        <TrendingUp className="h-4 w-4" />
        +{diff}
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

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function LocalPage() {
  // Case studies state (existing)
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [caseStudiesLoading, setCaseStudiesLoading] = useState(true);

  // Reviews state
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  // Fetch case studies (existing)
  useEffect(() => {
    fetchCaseStudies();
  }, []);

  const fetchCaseStudies = async () => {
    try {
      setCaseStudiesLoading(true);
      const res = await fetch('/api/local/case-studies', { credentials: 'include' });
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

  const filteredReviews = ratingFilter
    ? MOCK_REVIEWS.filter((r) => r.rating === ratingFilter)
    : MOCK_REVIEWS;

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
            <MapPin className="h-7 w-7 text-cyan-400" />
            Local SEO Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your Google Business Profile, track rankings, and grow local visibility
          </p>
        </div>

        {/* Connect GBP Banner */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-cyan-400 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                Connect your Google Business Profile to see live data and manage your listing directly.
              </p>
            </div>
            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white flex-shrink-0">
              <Globe className="h-4 w-4 mr-2" />
              Connect GBP
            </Button>
          </CardContent>
        </Card>

        {/* Tabbed Dashboard */}
        <Tabs defaultValue="overview">
          <TabsList variant="glass-primary" className="w-full justify-start flex-wrap gap-1">
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
            {/* Rating highlight */}
            <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-white">
                    {OVERVIEW_METRICS.averageRating}
                  </div>
                  <div>
                    <StarRating rating={Math.round(OVERVIEW_METRICS.averageRating)} size="md" />
                    <p className="text-sm text-gray-400 mt-1">
                      Based on {OVERVIEW_METRICS.totalReviews} reviews
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
                value={OVERVIEW_METRICS.viewsThisMonth.toLocaleString()}
                subtext="Profile views on Google"
              />
              <MetricCard
                icon={Globe}
                label="Website clicks"
                value={OVERVIEW_METRICS.clicksThisMonth.toLocaleString()}
                subtext="Clicks to your website"
              />
              <MetricCard
                icon={Phone}
                label="Phone calls"
                value={OVERVIEW_METRICS.callsThisMonth}
                subtext="Calls from your listing"
                iconColour="text-emerald-400"
              />
              <MetricCard
                icon={MapPin}
                label="Direction requests"
                value={OVERVIEW_METRICS.directionsThisMonth}
                subtext="Get directions taps"
                iconColour="text-amber-400"
              />
              <MetricCard
                icon={Search}
                label="Search impressions"
                value={OVERVIEW_METRICS.searchImpressions.toLocaleString()}
                subtext="Times shown in search"
              />
              <MetricCard
                icon={MessageSquare}
                label="Total reviews"
                value={OVERVIEW_METRICS.totalReviews}
                subtext={`${OVERVIEW_METRICS.averageRating} average rating`}
                iconColour="text-violet-400"
              />
            </div>
          </TabsContent>

          {/* ========== REVIEWS TAB ========== */}
          <TabsContent value="reviews" className="space-y-6 mt-6">
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-gray-400 mr-2">
                <Filter className="h-4 w-4" />
                Filter:
              </div>
              {[null, 5, 4, 3, 2, 1].map((rating) => (
                <Button
                  key={rating ?? 'all'}
                  variant="ghost"
                  size="sm"
                  onClick={() => setRatingFilter(rating)}
                  className={`text-sm ${
                    ratingFilter === rating
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {rating === null ? 'All' : `${rating}\u2605`}
                </Button>
              ))}
            </div>

            {/* Reviews list */}
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <Card
                  key={review.id}
                  className="bg-[#0f172a]/80 border border-cyan-500/10"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">{review.reviewer}</span>
                          <StarRating rating={review.rating} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{review.date}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-cyan-400 hover:text-cyan-300"
                        onClick={() => {
                          setReplyingTo(replyingTo === review.id ? null : review.id);
                          setReplyText('');
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Reply
                      </Button>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{review.text}</p>

                    {/* Inline reply composer */}
                    {replyingTo === review.id && (
                      <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                        <Textarea
                          variant="glass"
                          resize="none"
                          placeholder="Write your reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="min-h-[80px]"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-cyan-600 hover:bg-cyan-700 text-white"
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

              {filteredReviews.length === 0 && (
                <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
                  <CardContent className="p-12 text-center text-gray-400">
                    <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No reviews match this filter</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ========== INSIGHTS TAB ========== */}
          <TabsContent value="insights" className="space-y-6 mt-6">
            {/* Views line chart */}
            <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyan-400" />
                  Profile Views — Last 30 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={INSIGHTS_VIEWS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                          border: '1px solid rgba(6,182,212,0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#22d3ee' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Actions bar chart */}
            <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                  Actions Breakdown — February 2026
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={INSIGHTS_ACTIONS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                          border: '1px solid rgba(6,182,212,0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="websiteClicks" name="Website Clicks" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="phoneCalls" name="Phone Calls" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="directions" name="Directions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 justify-center">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-3 h-3 rounded-sm bg-cyan-400" />
                    Website Clicks
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                    Phone Calls
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-3 h-3 rounded-sm bg-amber-400" />
                    Directions
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== RANKINGS TAB ========== */}
          <TabsContent value="rankings" className="space-y-6 mt-6">
            <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Search className="h-5 w-5 text-cyan-400" />
                  Local Keyword Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Keyword</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Rank</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Previous</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Change</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Last Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RANKINGS_DATA.map((row) => (
                        <tr
                          key={row.keyword}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 px-4 text-white font-medium">{row.keyword}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={
                              row.rank <= 3
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : row.rank <= 5
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }>
                              #{row.rank}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-500">#{row.previous}</td>
                          <td className="py-3 px-4 text-center">
                            <RankChange current={row.rank} previous={row.previous} />
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500">{row.lastChecked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== POSTS TAB ========== */}
          <TabsContent value="posts" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">GBP Posts</h2>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => {
                  // Placeholder — toast coming soon
                  if (typeof window !== 'undefined') {
                    alert('GBP post creation coming soon!');
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_POSTS.map((post) => (
                <Card
                  key={post.id}
                  className="bg-[#0f172a]/80 border border-cyan-500/10 hover:border-cyan-500/20 transition-all"
                >
                  <CardContent className="p-5">
                    {/* Image placeholder */}
                    <div className="w-full h-32 bg-white/5 rounded-lg mb-4 flex items-center justify-center">
                      <Globe className="h-8 w-8 text-gray-600" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">
                        {post.type}
                      </Badge>
                      <Badge
                        className={
                          post.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }
                      >
                        {post.status === 'published' ? 'Published' : 'Scheduled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-3 mb-3">{post.text}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {post.date}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ========== CASE STUDIES TAB ========== */}
          <TabsContent value="case-studies" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Local Case Studies</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Hyper-local case studies with NAP consistency and location schema
                </p>
              </div>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Plus className="h-4 w-4 mr-2" />
                New Case Study
              </Button>
            </div>

            {caseStudiesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="bg-[#0f172a]/80 border border-cyan-500/10">
                    <CardContent className="p-6 animate-pulse space-y-3">
                      <div className="h-6 bg-white/10 rounded w-2/3" />
                      <div className="h-4 bg-white/10 rounded w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : caseStudies.length === 0 ? (
              <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
                <CardContent className="p-12 text-center text-gray-400">
                  <Map className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No case studies yet</p>
                  <p className="text-sm mt-1">
                    Create suburb-level case studies to boost local SEO
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caseStudies.map((cs) => (
                  <Card
                    key={cs.id}
                    className="bg-[#0f172a]/80 border border-cyan-500/10 hover:border-cyan-500/30 transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">{cs.title}</h3>
                        <Badge
                          className={
                            cs.publishedAt
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }
                        >
                          {cs.publishedAt ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <MapPin className="h-4 w-4 text-cyan-400" />
                        <span>
                          {cs.suburb}, {cs.city}, {cs.state} {cs.postcode}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">{cs.summary}</p>
                      <div className="flex justify-end mt-3">
                        <Button variant="ghost" size="sm" className="text-cyan-400">
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
