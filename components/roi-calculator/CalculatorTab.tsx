'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, Users, Target, ShoppingCart, Activity, Sparkles, Coins,
} from '@/components/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ROIMetrics } from './types';
import { formatCurrency, getROIColor } from './helpers';

interface CalculatorTabProps {
  metrics: ROIMetrics;
  monthlyBudget: string;
  setMonthlyBudget: (v: string) => void;
  avgConversionRate: string;
  setAvgConversionRate: (v: string) => void;
  avgOrderValue: string;
  setAvgOrderValue: (v: string) => void;
  monthlyTraffic: string;
  setMonthlyTraffic: (v: string) => void;
  costPerClick: string;
  setCostPerClick: (v: string) => void;
  retentionRate: string;
  setRetentionRate: (v: string) => void;
  roiTrendData: Array<{ month: string; roi: number; target: number }>;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.8)',
  border: '1px solid rgba(6, 182, 212, 0.3)',
  borderRadius: '8px',
};

export function CalculatorTab({
  metrics, monthlyBudget, setMonthlyBudget, avgConversionRate, setAvgConversionRate,
  avgOrderValue, setAvgOrderValue, monthlyTraffic, setMonthlyTraffic, costPerClick,
  setCostPerClick, retentionRate, setRetentionRate, roiTrendData,
}: CalculatorTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calculator Inputs */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>ROI Parameters</CardTitle>
            <CardDescription>Adjust values to calculate ROI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'budget', label: 'Monthly Marketing Budget', icon: DollarSign, value: monthlyBudget, onChange: setMonthlyBudget, type: 'number' },
              { id: 'traffic', label: 'Monthly Website Traffic', icon: Users, value: monthlyTraffic, onChange: setMonthlyTraffic, type: 'number' },
              { id: 'conversion', label: 'Average Conversion Rate (%)', icon: Target, value: avgConversionRate, onChange: setAvgConversionRate, type: 'number', step: '0.1' },
              { id: 'aov', label: 'Average Order Value', icon: ShoppingCart, value: avgOrderValue, onChange: setAvgOrderValue, type: 'number' },
              { id: 'cpc', label: 'Cost Per Click', icon: Coins, value: costPerClick, onChange: setCostPerClick, type: 'number', step: '0.01' },
              { id: 'retention', label: 'Customer Retention Rate (%)', icon: Activity, value: retentionRate, onChange: setRetentionRate, type: 'number' },
            ].map(({ id, label, icon: Icon, value, onChange, step }) => (
              <div key={id}>
                <Label htmlFor={id}>{label}</Label>
                <div className="relative mt-1">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id={id}
                    type="number"
                    step={step}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Results */}
        <Card variant="glass">
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
                  {metrics.customerAcquisitionCost > 0 ? (metrics.customerLifetimeValue / metrics.customerAcquisitionCost).toFixed(1) : '0'}:1
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
                <span className="text-sm font-medium text-white">{formatCurrency(metrics.customerAcquisitionCost)}</span>
              </div>
            </div>

            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <p className="text-sm font-medium text-white">AI Recommendations</p>
              </div>
              <div className="space-y-1">
                {metrics.roi < 100 && <p className="text-xs text-gray-300">&bull; Consider reducing CPC or improving conversion rate</p>}
                {metrics.customerAcquisitionCost > metrics.averageOrderValue * 0.3 && <p className="text-xs text-gray-300">&bull; CAC is high relative to AOV, focus on retention</p>}
                {metrics.conversionRate < 2 && <p className="text-xs text-gray-300">&bull; Conversion rate below industry average, optimize landing pages</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROI Trend Chart */}
      <Card variant="glass">
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
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={2} name="ROI %" />
              <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
