/**
 * Admin Panel Types
 */

export interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  role?: string;
  status?: string;
}

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  newThisWeek: number;
  bannedUsers: number;
}

export type UserAction = 'ban' | 'unban' | 'delete' | 'reset-password';

export type BulkAction = 'ban' | 'unban' | 'delete' | 'export';
