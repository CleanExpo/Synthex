'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ChannelPerformance } from './types';
import { formatCurrency, getROIColor } from './helpers';

interface ChannelsTabProps {
  channelPerformance: ChannelPerformance[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.8)',
  border: '1px solid rgba(6, 182, 212, 0.3)',
  borderRadius: '8px',
};

export function ChannelsTab({ channelPerformance }: ChannelsTabProps) {
  return (
    <div className="space-y-6">
      <Card variant="glass">
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
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="roi" fill="#06b6d4" name="ROI %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {channelPerformance.map(channel => (
          <Card key={channel.channel} variant="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{channel.channel}</h4>
                    <Badge className={`${getROIColor(channel.roi)}`}>{channel.roi}% ROI</Badge>
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
    </div>
  );
}
