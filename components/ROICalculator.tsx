'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Target,
  Activity,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Download,
  Save,
  Clock,
  Calendar,
  Zap,
  Award,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Coins
} from '@/components/icons';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Funnel,
  FunnelChart,
  LabelList
} from 'recharts';
import { notify } from '@/lib/notifications';

interface ROIMetrics {
  revenue: number;
  costs: number;
  profit: number;
  roi: number;
  paybackPeriod: number;
  breakEvenPoint: number;
  customerLifetimeValue: number;
  customerAcquisitionCost: number;
  conversionRate: number;
  averageOrderValue: number;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  status: 'active' | 'completed' | 'planned';
}

interface ChannelPerformance {
  channel: string;
  investment: number;
  revenue: number;
  roi: number;
  conversions: number;
  cpa: number; // Cost per acquisition
}

interface FunnelStage {
  name: string;
  value: number;
  conversionRate: number;
  dropOff: number;
}

export function ROICalculator() {
  const [metrics, setMetrics] = useState<ROIMetrics>({
    revenue: 0,
    costs: 0,
    profit: 0,
    roi: 0,
    paybackPeriod: 0,
    breakEvenPoint: 0,
    customerLifetimeValue: 0,
    customerAcquisitionCost: 0,
    conversionRate: 0,
    averageOrderValue: 0
  });
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
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
    const cpc = parseFloat(costPerClick) || 0;
    const retention = parseFloat(retentionRate) / 100 || 0;
    
    const conversions = traffic * convRate;
    const revenue = conversions * orderValue;
    const profit = revenue - budget;
    const roi = budget > 0 ? (profit / budget) * 100 : 0;
    const cac = conversions > 0 ? budget / conversions : 0;
    const clv = orderValue * (1 / (1 - retention));
    const payback = cac > 0 ? cac / (orderValue * 0.3) : 0; // Assuming 30% profit margin
    const breakeven = orderValue > 0 ? budget / (orderValue * 0.3) : 0;
    
    setMetrics({
      revenue,
      costs: budget,
      profit,
      roi,
      paybackPeriod: payback,
      breakEvenPoint: breakeven,
      customerLifetimeValue: clv,
      customerAcquisitionCost: cac,
      conversionRate: convRate * 100,
      averageOrderValue: orderValue
    });
  }, [monthlyBudget, avgConversionRate, avgOrderValue, monthlyTraffic, costPerClick, retentionRate]);

  const loadCampaignData = useCallback(() => {
    // Generate mock campaign data
    const mockCampaigns: Campaign[] = [
      {
        id: 'camp-1',
        name: 'Summer Sale 2024',
        platform: 'Facebook',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        budget: 15000,
        spent: 14250,
        impressions: 250000,
        clicks: 12500,
        conversions: 625,
        revenue: 93750,
        roi: 558,
        status: 'completed'
      },
      {
        id: 'camp-2',
        name: 'Black Friday Campaign',
        platform: 'Google Ads',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2024-11-30'),
        budget: 25000,
        spent: 18500,
        impressions: 500000,
        clicks: 25000,
        conversions: 1250,
        revenue: 187500,
        roi: 914,
        status: 'active'
      },
      {
        id: 'camp-3',
        name: 'Holiday Season Push',
        platform: 'Instagram',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        budget: 20000,
        spent: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        roi: 0,
        status: 'planned'
      }
    ];
    
    setCampaigns(mockCampaigns);
    
    // Generate channel performance data
    const channels: ChannelPerformance[] = [
      { channel: 'Facebook', investment: 15000, revenue: 67500, roi: 350, conversions: 450, cpa: 33.33 },
      { channel: 'Google Ads', investment: 18000, revenue: 108000, roi: 500, conversions: 720, cpa: 25 },
      { channel: 'Instagram', investment: 12000, revenue: 48000, roi: 300, conversions: 320, cpa: 37.5 },
      { channel: 'Email', investment: 3000, revenue: 45000, roi: 1400, conversions: 300, cpa: 10 },
      { channel: 'TikTok', investment: 8000, revenue: 24000, roi: 200, conversions: 160, cpa: 50 }
    ];
    
    setChannelPerformance(channels);
    
    // Generate funnel data
    const funnel: FunnelStage[] = [
      { name: 'Visitors', value: 10000, conversionRate: 100, dropOff: 0 },
      { name: 'Product Views', value: 6000, conversionRate: 60, dropOff: 40 },
      { name: 'Add to Cart', value: 2400, conversionRate: 40, dropOff: 60 },
      { name: 'Checkout', value: 1200, conversionRate: 50, dropOff: 50 },
      { name: 'Purchase', value: 600, conversionRate: 50, dropOff: 50 }
    ];
    
    setFunnelData(funnel);
  }, []);

  useEffect(() => {
    calculateROI();
  }, [calculateROI]);

  useEffect(() => {
    loadCampaignData();
  }, [loadCampaignData]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  const getROIColor = (roi: number) => {
    if (roi > 100) return 'text-green-400';
    if (roi > 0) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'planned': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Prepare chart data
  const roiTrendData = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    roi: 50 + Math.random() * 150 + (i * 10),
    target: 100
  }));
  
  const costBreakdown = [
    { name: 'Advertising', value: 45, fill: '#8b5cf6' },
    { name: 'Content Creation', value: 20, fill: '#ec4899' },
    { name: 'Tools & Software', value: 15, fill: '#3b82f6' },
    { name: 'Influencers', value: 12, fill: '#10b981' },
    { name: 'Other', value: 8, fill: '#f59e0b' }
  ];
  
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
          <Button
            variant="outline"
            className="bg-white/5 border-white/10"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
          <Button className="gradient-primary">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <Badge className="bg-green-500/20 text-green-400 text-xs">Revenue</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(metrics.revenue)}</p>
            <p className="text-xs text-gray-400 mt-1">Monthly revenue</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <Badge className={`text-xs ${getROIColor(metrics.roi)}`}>ROI</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.roi.toFixed(1)}%</p>
            <p className="text-xs text-gray-400 mt-1">Return on investment</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <Badge className="bg-blue-500/20 text-blue-400 text-xs">CAC</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(metrics.customerAcquisitionCost)}</p>
            <p className="text-xs text-gray-400 mt-1">Per customer</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Award className="h-4 w-4 text-yellow-400" />
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">CLV</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(metrics.customerLifetimeValue)}</p>
            <p className="text-xs text-gray-400 mt-1">Lifetime value</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-4 w-4 text-orange-400" />
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">Conv</Badge>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-400 mt-1">Conversion rate</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 bg-white/5">
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calculator Inputs */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>ROI Parameters</CardTitle>
                <CardDescription>Adjust values to calculate ROI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="budget">Monthly Marketing Budget</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="budget"
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="traffic">Monthly Website Traffic</Label>
                  <div className="relative mt-1">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="traffic"
                      type="number"
                      value={monthlyTraffic}
                      onChange={(e) => setMonthlyTraffic(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="conversion">Average Conversion Rate (%)</Label>
                  <div className="relative mt-1">
                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="conversion"
                      type="number"
                      step="0.1"
                      value={avgConversionRate}
                      onChange={(e) => setAvgConversionRate(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="aov">Average Order Value</Label>
                  <div className="relative mt-1">
                    <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="aov"
                      type="number"
                      value={avgOrderValue}
                      onChange={(e) => setAvgOrderValue(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="cpc">Cost Per Click</Label>
                  <div className="relative mt-1">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="cpc"
                      type="number"
                      step="0.01"
                      value={costPerClick}
                      onChange={(e) => setCostPerClick(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="retention">Customer Retention Rate (%)</Label>
                  <div className="relative mt-1">
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="retention"
                      type="number"
                      value={retentionRate}
                      onChange={(e) => setRetentionRate(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Results */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Calculated Results</CardTitle>
                <CardDescription>Based on your inputs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Net Profit</span>
                    <span className="text-2xl font-bold text-white">{formatCurrency(metrics.profit)}</span>
                  </div>
                  <Progress value={metrics.roi > 0 ? Math.min(metrics.roi, 100) : 0} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-400">Break-even Point</p>
                    <p className="text-lg font-bold text-white">{Math.ceil(metrics.breakEvenPoint)} sales</p>
                  </div>
                  
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-400">Payback Period</p>
                    <p className="text-lg font-bold text-white">{metrics.paybackPeriod.toFixed(1)} months</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">CLV to CAC Ratio</span>
                    <span className="text-sm font-medium text-white">
                      {metrics.customerAcquisitionCost > 0 
                        ? (metrics.customerLifetimeValue / metrics.customerAcquisitionCost).toFixed(1) 
                        : '0'}:1
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Monthly Conversions</span>
                    <span className="text-sm font-medium text-white">
                      {Math.floor(parseFloat(monthlyTraffic) * (parseFloat(avgConversionRate) / 100))}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Cost Per Conversion</span>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(metrics.customerAcquisitionCost)}
                    </span>
                  </div>
                </div>
                
                {/* AI Recommendations */}
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <p className="text-sm font-medium text-white">AI Recommendations</p>
                  </div>
                  <div className="space-y-1">
                    {metrics.roi < 100 && (
                      <p className="text-xs text-gray-300">
                        • Consider reducing CPC or improving conversion rate
                      </p>
                    )}
                    {metrics.customerAcquisitionCost > metrics.averageOrderValue * 0.3 && (
                      <p className="text-xs text-gray-300">
                        • CAC is high relative to AOV, focus on retention
                      </p>
                    )}
                    {metrics.conversionRate < 2 && (
                      <p className="text-xs text-gray-300">
                        • Conversion rate below industry average, optimize landing pages
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* ROI Trend Chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>ROI Trend</CardTitle>
              <CardDescription>Monthly return on investment</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={roiTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={2} name="ROI %" />
                  <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" name="Target" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{campaign.name}</h3>
                      <Badge variant="secondary">{campaign.platform}</Badge>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(campaign.status)}`} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={`${getROIColor(campaign.roi)}`}>
                    {campaign.roi}% ROI
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Budget</p>
                    <p className="text-sm font-medium text-white">{formatCurrency(campaign.budget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Spent</p>
                    <p className="text-sm font-medium text-white">{formatCurrency(campaign.spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Impressions</p>
                    <p className="text-sm font-medium text-white">{campaign.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Conversions</p>
                    <p className="text-sm font-medium text-white">{campaign.conversions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Revenue</p>
                    <p className="text-sm font-medium text-white">{formatCurrency(campaign.revenue)}</p>
                  </div>
                </div>
                
                {campaign.spent > 0 && (
                  <Progress 
                    value={(campaign.spent / campaign.budget) * 100} 
                    className="h-2 mt-3"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        
        <TabsContent value="channels" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
              <CardDescription>ROI by marketing channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={channelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="channel" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="roi" fill="#8b5cf6" name="ROI %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <div className="grid gap-4">
            {channelPerformance.map(channel => (
              <Card key={channel.channel} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">{channel.channel}</h4>
                        <Badge className={`${getROIColor(channel.roi)}`}>
                          {channel.roi}% ROI
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-400">Investment</p>
                          <p className="text-sm font-medium text-white">{formatCurrency(channel.investment)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Revenue</p>
                          <p className="text-sm font-medium text-white">{formatCurrency(channel.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Conversions</p>
                          <p className="text-sm font-medium text-white">{channel.conversions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">CPA</p>
                          <p className="text-sm font-medium text-white">{formatCurrency(channel.cpa)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="funnel" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Track drop-off at each stage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnelData.map((stage, index) => (
                  <div key={stage.name} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-400">{index + 1}</span>
                        </div>
                        <span className="font-medium text-white">{stage.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-white">{stage.value.toLocaleString()} users</span>
                        {index > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {stage.conversionRate}% conversion
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-10">
                      <Progress 
                        value={(stage.value / funnelData[0].value) * 100} 
                        className="h-3"
                      />
                    </div>
                    
                    {index < funnelData.length - 1 && (
                      <div className="ml-10 mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <ArrowDownRight className="h-3 w-3" />
                        <span>{stage.dropOff}% drop-off</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <p className="text-sm font-medium text-white">Optimization Opportunities</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-300">
                    • Highest drop-off at Product Views → Add to Cart (60%)
                  </p>
                  <p className="text-xs text-gray-300">
                    • Consider improving product page design and CTAs
                  </p>
                  <p className="text-xs text-gray-300">
                    • Implement cart abandonment recovery campaigns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Cost Breakdown */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>Marketing spend allocation</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={costBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {costBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
