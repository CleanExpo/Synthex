'use client';

/**
 * Detailed Metrics Table
 * Four-tab breakdown: Overview / Engagement / Audience / Content.
 * Synthex design: sharp tabs, white/N opacity table cells, colored growth chips.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown } from '@/components/icons';

const EM = '\u2014';

export interface MetricsTableRow {
  platform: string;
  followers: number;
  posts: number;
  engagement: number;
  reach: number;
  growth: number;
}

export interface EngagementTableRow {
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  total: number;
}

export interface ContentTableRow {
  platform: string;
  topPosts: number;
  avgEngagementRate: number;
  bestTime: string;
}

interface MetricsTableProps {
  data?: MetricsTableRow[];
  engagementData?: EngagementTableRow[];
  contentData?: ContentTableRow[];
}

const defaultPlatforms = ['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'Facebook'];

function fmt(n: number) { return n.toLocaleString(); }

function GrowthChip({ value }: { value: number }) {
  if (value === 0) return <span className="text-white/25 text-xs">{EM}</span>;
  const pos = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`py-2.5 text-[9px] uppercase tracking-[0.18em] font-medium text-white/30 ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

const TD = ({ children, right, accent }: { children: React.ReactNode; right?: boolean; accent?: boolean }) => (
  <td className={`py-2.5 text-xs tabular-nums ${right ? 'text-right' : ''} ${accent ? 'text-white/80 font-medium' : 'text-white/50'}`}>
    {children}
  </td>
);

const EmptyRow = ({ cols }: { cols: number }) => (
  <tr>
    <td colSpan={cols} className="py-10 text-center text-xs text-white/20">
      No data yet for this period
    </td>
  </tr>
);

export function MetricsTable({ data, engagementData, contentData }: MetricsTableProps) {
  const hasData = data && data.length > 0;
  const hasEng  = engagementData && engagementData.length > 0;
  const hasCon  = contentData && contentData.length > 0;

  const overviewRows  = hasData ? data : defaultPlatforms.map(p => null).map((_, i) => ({ platform: defaultPlatforms[i], followers: 0, posts: 0, engagement: 0, reach: 0, growth: 0 }));
  const engRows       = hasEng  ? engagementData : defaultPlatforms.map((p, i) => ({ platform: p, likes: 0, comments: 0, shares: 0, total: 0 }));
  const conRows       = hasCon  ? contentData : defaultPlatforms.map((p, i) => ({ platform: p, topPosts: 0, avgEngagementRate: 0, bestTime: EM }));

  const audienceRows = hasEng
    ? engagementData!.map(r => ({
        platform: r.platform,
        engagementRate: r.total > 0 ? `${(((r.likes + r.comments + r.shares) / r.total) * 100).toFixed(1)}%` : EM,
        trend: 'Stable',
        bestTime: EM,
      }))
    : hasData
    ? data!.map(r => ({
        platform: r.platform,
        engagementRate: `${r.engagement.toFixed(1)}%`,
        trend: r.growth > 0 ? 'Growing' : r.growth < 0 ? 'Declining' : 'Stable',
        bestTime: EM,
      }))
    : defaultPlatforms.map(p => ({ platform: p, engagementRate: EM, trend: 'Stable', bestTime: EM }));

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-5">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Breakdown</p>
        <h3 className="text-sm font-medium text-white/80">Detailed Metrics</h3>
        <p className="text-xs text-white/35 mt-0.5">Platform-specific performance data</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-8 bg-white/3 border-[0.5px] border-white/6 rounded-sm p-0.5 gap-0.5">
          {['overview', 'engagement', 'audience', 'content'].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-7 px-3 text-[10px] capitalize rounded-sm data-[state=active]:bg-white/8 data-[state=active]:text-white text-white/40"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  <TH>Platform</TH>
                  <TH right>Followers</TH>
                  <TH right>Posts</TH>
                  <TH right>Eng. Rate</TH>
                  <TH right>Reach</TH>
                  <TH right>Growth</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {overviewRows.length === 0 ? <EmptyRow cols={6} /> : overviewRows.map(row => (
                  <tr key={row.platform} className="hover:bg-white/2 transition-colors">
                    <TD accent>{row.platform}</TD>
                    <TD right>{row.followers > 0 ? fmt(row.followers) : EM}</TD>
                    <TD right>{row.posts > 0 ? row.posts : EM}</TD>
                    <TD right>{row.engagement > 0 ? `${row.engagement.toFixed(1)}%` : EM}</TD>
                    <TD right>{row.reach > 0 ? fmt(row.reach) : EM}</TD>
                    <TD right><GrowthChip value={row.growth} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Engagement */}
        <TabsContent value="engagement" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  <TH>Platform</TH>
                  <TH right>Likes</TH>
                  <TH right>Comments</TH>
                  <TH right>Shares</TH>
                  <TH right>Total</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {engRows.length === 0 ? <EmptyRow cols={5} /> : engRows.map(row => (
                  <tr key={row.platform} className="hover:bg-white/2 transition-colors">
                    <TD accent>{row.platform}</TD>
                    <TD right>{row.likes > 0 ? fmt(row.likes) : EM}</TD>
                    <TD right>{row.comments > 0 ? fmt(row.comments) : EM}</TD>
                    <TD right>{row.shares > 0 ? fmt(row.shares) : EM}</TD>
                    <TD right accent>{row.total > 0 ? fmt(row.total) : EM}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Audience */}
        <TabsContent value="audience" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  <TH>Platform</TH>
                  <TH right>Eng. Rate</TH>
                  <TH right>Trend</TH>
                  <TH right>Best Time</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {audienceRows.length === 0 ? <EmptyRow cols={4} /> : audienceRows.map(row => {
                  const trendColor = row.trend === 'Growing' ? 'text-emerald-400' : row.trend === 'Declining' ? 'text-red-400' : 'text-white/40';
                  return (
                    <tr key={row.platform} className="hover:bg-white/2 transition-colors">
                      <TD accent>{row.platform}</TD>
                      <TD right>{row.engagementRate}</TD>
                      <td className={`py-2.5 text-xs text-right ${trendColor}`}>{row.trend}</td>
                      <TD right>{row.bestTime}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  <TH>Platform</TH>
                  <TH right>Posts</TH>
                  <TH right>Avg Eng. Rate</TH>
                  <TH right>Best Time</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {conRows.length === 0 ? <EmptyRow cols={4} /> : conRows.map(row => (
                  <tr key={row.platform} className="hover:bg-white/2 transition-colors">
                    <TD accent>{row.platform}</TD>
                    <TD right>{row.topPosts > 0 ? row.topPosts : EM}</TD>
                    <TD right>{row.avgEngagementRate > 0 ? `${row.avgEngagementRate.toFixed(1)}%` : EM}</TD>
                    <TD right>{row.bestTime}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
