'use client';

import useSWR from 'swr';
import { Loader2 } from '@/components/icons';

interface Stats {
  users: {
    total: number;
    formatted: string;
    label: string;
    growth: number;
  };
  engagement: {
    multiplier: string;
    formatted: string;
    label: string;
    description: string;
  };
  campaigns: {
    total: number;
    formatted: string;
    label: string;
  };
  posts: {
    total: number;
    published: number;
    formatted: string;
    label: string;
  };
  aiPowered: {
    enabled: boolean;
    features: string[];
  };
}

const fetchJson = async (url: string): Promise<Stats> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return null as unknown as Stats;
  return res.json();
};

export function RealStats() {
  const { data: stats, isLoading } = useSWR<Stats>(
    '/api/stats',
    fetchJson,
    { revalidateOnFocus: false, refreshInterval: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="text-center animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl md:text-3xl font-bold text-primary">
          {stats.users.formatted}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.users.label}
          {stats.users.growth > 0 && (
            <span className="text-green-500 ml-1">+{stats.users.growth}%</span>
          )}
        </span>
      </div>

      <div className="text-center">
        <div className="text-2xl md:text-3xl font-bold text-primary">
          {stats.engagement.formatted}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.engagement.label}
        </span>
      </div>

      <div className="text-center">
        <div className="text-2xl md:text-3xl font-bold text-primary">
          {stats.posts.formatted}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.posts.label}
        </span>
      </div>

      <div className="text-center">
        <div className="text-2xl md:text-3xl font-bold text-primary">
          {stats.aiPowered.enabled ? 'AI' : 'Setup'}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.aiPowered.enabled ? 'Powered' : 'In Progress'}
        </span>
      </div>
    </div>
  );
}

// Standalone stat component for individual use
export function UserCount() {
  const { data } = useSWR<Stats>('/api/stats', fetchJson, { revalidateOnFocus: false });
  const count = data ? `${data.users.formatted}+ ${data.users.label}` : 'Join Us';
  return <span>{count}</span>;
}

export function EngagementBoost() {
  const { data } = useSWR<Stats>('/api/stats', fetchJson, { revalidateOnFocus: false });
  const boost = data ? `${data.engagement.formatted} ${data.engagement.label}` : 'AI Powered';
  return <span>{boost}</span>;
}

export function CampaignCount() {
  const { data } = useSWR<Stats>('/api/stats', fetchJson, { revalidateOnFocus: false });
  return <span>{data?.campaigns.formatted ?? '0'}</span>;
}

export function PostCount() {
  const { data } = useSWR<Stats>('/api/stats', fetchJson, { revalidateOnFocus: false });
  return <span>{data?.posts.formatted ?? '0'}</span>;
}
