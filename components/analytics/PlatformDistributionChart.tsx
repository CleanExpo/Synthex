'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type PlatformDistributionPoint = {
  platform: string;
  posts: number;
};

type PlatformDistributionChartProps = {
  data: PlatformDistributionPoint[];
};

export default function PlatformDistributionChart({
  data
}: PlatformDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="platform" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="posts" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
