'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calculator, DollarSign, TrendingUp, Users, Award, Target, Save, Download,
} from '@/components/icons';
import { notify } from '@/lib/notifications';

import type { ROIMetrics, Campaign, ChannelPerformance, FunnelStage } from './types';
import { formatCurrency, getROIColor } from './helpers';
import { CalculatorTab } from './CalculatorTab';
import { CampaignsTab } from './CampaignsTab';
import { ChannelsTab } from './ChannelsTab';
import { FunnelTab } from './FunnelTab';

export function ROICalculator() {
  const [metrics, setMetrics] = useState<ROIMetrics>({
    revenue: 0, costs: 0, profit: 0, roi: 0, paybackPeriod: 0, breakEvenPoint: 0,
    customerLifetimeValue: 0, customerAcquisitionCost: 0, conversionRate: 0, averageOrderValue: 0,
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [roiTrendData, setRoiTrendData] = useState<Array<{ month: string; roi: number; target: number }>>([]);
  const [activeTab, setActiveTab] = useState('calculator');

  // Calculator inputs
  const [monthlyBudget, setMonthlyBudget] = useState('5000');
  const [avgConversionRate, setAvgConversionRate] = useState('2.5');
  const [avgOrderValue, setAvgOrderValue] = useState('150');
  const [monthlyTraffic, setMonthlyTraffic] = useState('10000');
  const [costPerClick, setCostPerClick] = useState('0.50');
  const [retentionRate, setRetentionRate] = useState('80');

  const calculateROI = useCallback(() => {
    const budget = parseFloat(monthlyBudget) || 0;
    const convRate = parseFloat(avgConversionRate) / 100 || 0;
    const orderValue = parseFloat(avgOrderValue) || 0;
    const traffic = parseFloat(monthlyTraffic) || 0;
    const retention = parseFloat(retentionRate) / 100 || 0;

    const conversions = traffic * convRate;
    const revenue = conversions * orderValue;
    const profit = revenue - budget;
    const roi = budget > 0 ? (profit / budget) * 100 : 0;
    const cac = conversions > 0 ? budget / conversions : 0;
    const clv = orderValue * (1 / (1 - retention));
    const payback = cac > 0 ? cac / (orderValue * 0.3) : 0;
    const breakeven = orderValue > 0 ? budget / (orderValue * 0.3) : 0;

    setMetrics({
      revenue, costs: budget, profit, roi, paybackPeriod: payback, breakEvenPoint: breakeven,
      customerLifetimeValue: clv, customerAcquisitionCost: cac, conversionRate: convRate * 100,
      averageOrderValue: orderValue,
    });
  }, [monthlyBudget, avgConversionRate, avgOrderValue, monthlyTraffic, costPerClick, retentionRate]);

  const loadCampaignData = useCallback(async () => {
    try {
      const [campaignsRes, performanceRes, statsRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/analytics/performance?period=30d'),
        fetch('/api/stats'),
      ]);

      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        if (data.campaigns && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns.map((camp: any) => {
            const posts = camp.posts || [];
            const totalImpressions = posts.reduce((s: number, p: any) => s + (p.analytics?.impressions || 0), 0);
            const totalClicks = posts.reduce((s: number, p: any) => s + (p.analytics?.clicks || 0), 0);
            const totalConversions = posts.reduce((s: number, p: any) => s + (p.analytics?.conversions || 0), 0);
            const totalRevenue = posts.reduce((s: number, p: any) => s + (p.analytics?.revenue || 0), 0);
            const estimatedBudget = totalRevenue > 0 ? totalRevenue * 0.2 : 0;
            const spent = estimatedBudget * 0.95;
            const roi = spent > 0 ? ((totalRevenue - spent) / spent) * 100 : 0;
            const status: 'active' | 'completed' | 'planned' =
              camp.status === 'active' ? 'active' : camp.status === 'completed' || camp.status === 'archived' ? 'completed' : camp.status === 'scheduled' ? 'planned' : 'active';
            return {
              id: camp.id, name: camp.name, platform: camp.platform,
              startDate: new Date(camp.createdAt),
              endDate: new Date(camp.settings?.scheduledAt || Date.now() + 30 * 24 * 60 * 60 * 1000),
              budget: estimatedBudget, spent, impressions: totalImpressions, clicks: totalClicks,
              conversions: totalConversions, revenue: totalRevenue, roi: Math.round(roi), status,
            };
          }));
        }
      }

      if (performanceRes.ok) {
        const perfData = await performanceRes.json();
        if (perfData.success && perfData.data?.platforms) {
          const channels: ChannelPerformance[] = perfData.data.platforms.map((plat: any) => {
            const inv = plat.posts * 50;
            const rev = plat.engagement * 5;
            const roi = inv > 0 ? ((rev - inv) / inv) * 100 : 0;
            const conv = Math.floor(plat.engagement * 0.05);
            return {
              channel: plat.platform.charAt(0).toUpperCase() + plat.platform.slice(1),
              investment: inv, revenue: rev, roi: Math.round(roi), conversions: conv,
              cpa: conv > 0 ? Math.round((inv / conv) * 100) / 100 : 0,
            };
          });
          if (channels.length > 0) setChannelPerformance(channels);
        }
        if (perfData.success && perfData.data?.timeline) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthlyData = new Map<string, { engagement: number; posts: number }>();
          for (const point of perfData.data.timeline) {
            const date = new Date(point.date);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!monthlyData.has(key)) monthlyData.set(key, { engagement: 0, posts: 0 });
            const d = monthlyData.get(key)!;
            d.engagement += point.engagement || 0;
            d.posts += point.posts || 0;
          }
          const trendData: Array<{ month: string; roi: number; target: number }> = [];
          for (const [key, data] of monthlyData) {
            const [, month] = key.split('-');
            const cost = data.posts * 50;
            const rev = data.engagement * 5;
            trendData.push({ month: months[parseInt(month)], roi: cost > 0 ? Math.round(((rev - cost) / cost) * 100) : 0, target: 100 });
          }
          if (trendData.length > 0) setRoiTrendData(trendData.slice(-12));
          else setRoiTrendData(months.map(m => ({ month: m, roi: 0, target: 100 })));
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const totalPosts = statsData.posts?.total || 0;
        const visitors = totalPosts * 100;
        const productViews = Math.floor(visitors * 0.6);
        const addToCart = Math.floor(productViews * 0.4);
        const checkout = Math.floor(addToCart * 0.5);
        const purchase = Math.floor(checkout * 0.5);
        setFunnelData([
          { name: 'Visitors', value: visitors, conversionRate: 100, dropOff: 0 },
          { name: 'Product Views', value: productViews, conversionRate: visitors > 0 ? Math.round((productViews / visitors) * 100) : 0, dropOff: visitors > 0 ? Math.round((1 - productViews / visitors) * 100) : 0 },
          { name: 'Add to Cart', value: addToCart, conversionRate: productViews > 0 ? Math.round((addToCart / productViews) * 100) : 0, dropOff: productViews > 0 ? Math.round((1 - addToCart / productViews) * 100) : 0 },
          { name: 'Checkout', value: checkout, conversionRate: addToCart > 0 ? Math.round((checkout / addToCart) * 100) : 0, dropOff: addToCart > 0 ? Math.round((1 - checkout / addToCart) * 100) : 0 },
          { name: 'Purchase', value: purchase, conversionRate: checkout > 0 ? Math.round((purchase / checkout) * 100) : 0, dropOff: checkout > 0 ? Math.round((1 - purchase / checkout) * 100) : 0 },
        ]);
      }
    } catch (error) {
      console.error('Error loading campaign data:', error);
      notify.error('Failed to load campaign data');
    }
  }, []);

  useEffect(() => { calculateROI(); }, [calculateROI]);
  useEffect(() => { loadCampaignData(); }, [loadCampaignData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
            <Calculator className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">ROI Calculator</h2>
            <p className="text-gray-400">Measure and optimize your marketing returns</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white/5 border-white/10">
            <Save className="h-4 w-4 mr-2" />Save Report
          </Button>
          <Button className="gradient-primary">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { icon: DollarSign, color: 'green', label: 'Revenue', badge: 'Revenue', value: formatCurrency(metrics.revenue), sub: 'Monthly revenue' },
          { icon: TrendingUp, color: 'cyan', label: 'ROI', badge: 'ROI', value: `${metrics.roi.toFixed(1)}%`, sub: 'Return on investment', badgeClass: getROIColor(metrics.roi) },
          { icon: Users, color: 'blue', label: 'CAC', badge: 'CAC', value: formatCurrency(metrics.customerAcquisitionCost), sub: 'Per customer' },
          { icon: Award, color: 'yellow', label: 'CLV', badge: 'CLV', value: formatCurrency(metrics.customerLifetimeValue), sub: 'Lifetime value' },
          { icon: Target, color: 'orange', label: 'Conv', badge: 'Conv', value: `${metrics.conversionRate.toFixed(1)}%`, sub: 'Conversion rate' },
        ].map(({ icon: Icon, color, badge, value, sub, badgeClass }) => (
          <Card key={badge} variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-4 w-4 text-${color}-400`} />
                <Badge className={badgeClass || `bg-${color}-500/20 text-${color}-400 text-xs`}>{badge}</Badge>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 bg-white/5">
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator">
          <CalculatorTab
            metrics={metrics}
            monthlyBudget={monthlyBudget} setMonthlyBudget={setMonthlyBudget}
            avgConversionRate={avgConversionRate} setAvgConversionRate={setAvgConversionRate}
            avgOrderValue={avgOrderValue} setAvgOrderValue={setAvgOrderValue}
            monthlyTraffic={monthlyTraffic} setMonthlyTraffic={setMonthlyTraffic}
            costPerClick={costPerClick} setCostPerClick={setCostPerClick}
            retentionRate={retentionRate} setRetentionRate={setRetentionRate}
            roiTrendData={roiTrendData}
          />
        </TabsContent>
        <TabsContent value="campaigns"><CampaignsTab campaigns={campaigns} /></TabsContent>
        <TabsContent value="channels"><ChannelsTab channelPerformance={channelPerformance} /></TabsContent>
        <TabsContent value="funnel"><FunnelTab funnelData={funnelData} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default ROICalculator;
