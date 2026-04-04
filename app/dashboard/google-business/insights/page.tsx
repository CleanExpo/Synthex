'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { useGBPInsights } from '@/hooks/useGBPInsights';
import { GBPConnectionBanner } from '@/components/google/GBPConnectionBanner';
import {
  ArrowLeft,
  TrendingUp,
  Eye,
  Map,
  Globe,
  Phone,
  Loader2,
} from '@/components/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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
    <div className="p-4 bg-white/5 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-orange-400" />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function GBPInsightsPage() {
  const { locations, primaryLocation } = useGBPLocations();
  const [days, setDays] = useState(30);
  const { totals, trend, isLoading } = useGBPInsights(
    primaryLocation?.id,
    days
  );

  const hasLocations = locations.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/google-business"
          className="text-sm text-gray-300 hover:text-orange-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Business
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-orange-400" />
          Performance Insights
        </h1>
        <p className="text-gray-300 mt-1">
          Track how customers find and interact with your business listing
        </p>
      </div>

      {!hasLocations && <GBPConnectionBanner />}

      {hasLocations && (
        <>
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Period:</span>
            {[7, 14, 30, 90].map(d => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                onClick={() => setDays(d)}
                className={`text-xs ${
                  days === d
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                    : 'border-white/10 text-gray-300 hover:bg-white/5'
                }`}
              >
                {d} days
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : (
            <>
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

              {/* Trend Chart */}
              {trend.length > 0 && (
                <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                      Performance Trend
                    </h2>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            tickFormatter={d => {
                              const date = new Date(d);
                              return `${date.getDate()}/${date.getMonth() + 1}`;
                            }}
                          />
                          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1a1612',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              borderRadius: '8px',
                              color: '#fff',
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="searchViews"
                            name="Search Views"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="mapsViews"
                            name="Maps Views"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="websiteClicks"
                            name="Website"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
