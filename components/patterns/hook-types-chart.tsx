'use client';

/**
 * Hook Types Chart Component
 * Pie chart showing viral hook type distribution
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from '@/components/icons';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { hookTypes } from './patterns-config';

export function HookTypesChart() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Viral Hook Types</span>
          <Sparkles className="h-4 w-4 text-cyan-500" />
        </CardTitle>
        <CardDescription className="text-gray-400">
          Most effective content hooks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={hookTypes}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {hookTypes.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
