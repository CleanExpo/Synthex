'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Globe } from '@/components/icons';
import { COLORS, formatNumber } from './constants';
import type { AnalyticsData } from './types';

interface DemographicsProps {
  demographics: AnalyticsData['demographics'];
}

export function Demographics({ demographics }: DemographicsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Audience Demographics</CardTitle>
        <CardDescription>Understanding your audience composition</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Age Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Age Groups</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={demographics.age}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="range" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                />
                <Bar dataKey="percentage" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gender Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Gender</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={demographics.gender}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="percentage"
                >
                  {demographics.gender.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {demographics.gender.map((item, index) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-400">
                    {item.type} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Locations */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Top Locations</h4>
            <div className="space-y-2">
              {demographics.location.map((location) => (
                <div key={location.country} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{location.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatNumber(location.users)}</span>
                    <Progress
                      value={(location.users / demographics.location[0].users) * 100}
                      className="w-20"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
