'use client';

import { useEffect, useState } from 'react';
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

export function RealStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Use fallback stats
      setStats({
        users: { total: 0, formatted: '0', label: 'Users', growth: 0 },
        engagement: { 
          multiplier: '1.0', 
          formatted: '1.0x', 
          label: 'Engagement',
          description: 'Loading...'
        },
        campaigns: { total: 0, formatted: '0', label: 'Campaigns' },
        posts: { total: 0, published: 0, formatted: '0', label: 'Posts' },
        aiPowered: { enabled: false, features: [] }
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
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
  const [count, setCount] = useState('Loading...');

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setCount(data.users.formatted + '+ ' + data.users.label))
      .catch(() => setCount('Join Us'));
  }, []);

  return <span>{count}</span>;
}

export function EngagementBoost() {
  const [boost, setBoost] = useState('Loading...');

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setBoost(data.engagement.formatted + ' ' + data.engagement.label))
      .catch(() => setBoost('AI Powered'));
  }, []);

  return <span>{boost}</span>;
}

export function CampaignCount() {
  const [count, setCount] = useState('0');

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setCount(data.campaigns.formatted))
      .catch(() => setCount('0'));
  }, []);

  return <span>{count}</span>;
}

export function PostCount() {
  const [count, setCount] = useState('0');

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setCount(data.posts.formatted))
      .catch(() => setCount('0'));
  }, []);

  return <span>{count}</span>;
}