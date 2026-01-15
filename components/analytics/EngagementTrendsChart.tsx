'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type EngagementTrendsPoint = {
  date: string;
  likes?: number;
  shares?: number;
  comments?: number;
};

type EngagementTrendsChartProps = {
  data: EngagementTrendsPoint[];
};

export default function EngagementTrendsChart({ data }: EngagementTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="likes" stroke="#ef4444" name="Likes" />
        <Line type="monotone" dataKey="shares" stroke="#3b82f6" name="Shares" />
        <Line type="monotone" dataKey="comments" stroke="#10b981" name="Comments" />
      </LineChart>
    </ResponsiveContainer>
  );
}
