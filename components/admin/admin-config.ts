/**
 * Admin Panel Configuration
 * Mock data and constants
 */

import type { User } from './types';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@synthex.ai',
    created_at: new Date().toISOString(),
    role: 'admin',
    status: 'active'
  },
  {
    id: '2',
    email: 'user@example.com',
    created_at: new Date().toISOString(),
    role: 'user',
    status: 'active'
  }
];

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

export function calculateStats(users: User[]) {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(now.setDate(now.getDate() - 7));

  return {
    totalUsers: users.length,
    activeToday: users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > today).length,
    newThisWeek: users.filter(u => new Date(u.created_at) > weekAgo).length,
    bannedUsers: users.filter(u => u.status === 'banned').length
  };
}

export function exportUsersToCSV(users: User[], filename = 'users.csv') {
  const csv = [
    ['ID', 'Email', 'Created At', 'Last Sign In', 'Status', 'Role'],
    ...users.map(u => [
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at || 'Never',
      u.status || 'active',
      u.role || 'user'
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
