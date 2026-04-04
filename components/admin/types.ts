/**
 * Admin Panel Types
 *
 * Updated to match Prisma API response shape from /api/admin/users.
 * Fields: createdAt (ISO string), lastLogin (ISO string | null).
 */

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  /** ISO datetime string — matches Prisma createdAt */
  createdAt: string;
  /** ISO datetime string | null — matches Prisma lastLogin */
  lastLogin?: string | null;
  emailVerified?: boolean;
  authProvider?: string | null;
  preferences?: Record<string, unknown> | null;
  /** Derived from preferences.status */
  status?: string;
  /** Derived from preferences.role */
  role?: string;
  _count?: { campaigns: number };
}

export interface AdminStatsData {
  totalUsers: number;
  activeToday: number;
  newThisWeek: number;
  bannedUsers: number;
}

export type UserAction = 'ban' | 'unban' | 'delete' | 'reset-password';

export type BulkAction = 'ban' | 'unban' | 'delete' | 'export';
