/**
 * Admin Panel Configuration
 * Constants and helper functions
 */

import type { User, AdminStatsData } from './types';

export const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
];

export const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
  { value: 'suspended', label: 'Suspended' },
];

export function calculateStats(users: User[]): AdminStatsData {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    totalUsers: users.length,
    activeToday: users.filter(
      (u) => u.lastLogin && new Date(u.lastLogin) > today
    ).length,
    newThisWeek: users.filter((u) => new Date(u.createdAt) > weekAgo).length,
    bannedUsers: users.filter(
      (u) => u.status === 'banned' || u.status === 'suspended'
    ).length,
  };
}

export function exportUsersToCSV(users: User[], filename = 'users.csv') {
  const csv = [
    ['ID', 'Email', 'Name', 'Created At', 'Last Login', 'Status', 'Role'],
    ...users.map((u) => [
      u.id,
      u.email,
      u.name || '',
      u.createdAt,
      u.lastLogin || 'Never',
      u.status || 'active',
      u.role || 'user',
    ]),
  ]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
