/**
 * Dashboard Types
 * Type definitions for dashboard components
 */

export interface DashboardStats {
  totalPosts: number;
  scheduledPosts: number;
  engagementRate: number;
  followers: number;
  trendingTopics: string[];
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: 'post' | 'engagement' | 'milestone';
  message: string;
  timestamp: string;
}

export interface FetchError {
  message: string;
  code?: string;
  timestamp: Date;
}

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
}

export interface TeamMember {
  name: string;
  role: string;
  status: 'online' | 'offline';
}

export interface ScheduledPost {
  platform: string;
  content: string;
  time: string;
  status: 'scheduled' | 'draft';
}

export interface AIGeneration {
  type: string;
  content: string;
  time: string;
}
