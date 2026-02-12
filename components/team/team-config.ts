/**
 * Team Configuration
 * Constants, mock data, and helper functions
 */

import type { TeamMember, ActivityLog, TeamRole, MemberStatus } from './types';

export const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@synthex.social',
    role: 'Admin',
    avatar: '',
    status: 'Active',
    joinedAt: '2024-01-15',
    lastActive: '2 hours ago',
    permissions: ['all'],
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'Editor',
    avatar: '',
    status: 'Active',
    joinedAt: '2024-02-20',
    lastActive: '5 minutes ago',
    permissions: ['create', 'edit', 'publish'],
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike@company.com',
    role: 'Viewer',
    avatar: '',
    status: 'Pending',
    joinedAt: '2024-03-01',
    lastActive: 'Never',
    permissions: ['view'],
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@company.com',
    role: 'Editor',
    avatar: '',
    status: 'Inactive',
    joinedAt: '2024-01-30',
    lastActive: '2 days ago',
    permissions: ['create', 'edit'],
  },
];

export const mockActivityLog: ActivityLog[] = [
  {
    id: '1',
    userId: '2',
    userName: 'Sarah Johnson',
    action: 'Created new content',
    timestamp: '2 hours ago',
    details: 'Instagram post for Q1 campaign',
  },
  {
    id: '2',
    userId: '1',
    userName: 'John Smith',
    action: 'Updated team permissions',
    timestamp: '4 hours ago',
    details: 'Added publishing rights to Mike Chen',
  },
  {
    id: '3',
    userId: '4',
    userName: 'Emily Davis',
    action: 'Accessed analytics',
    timestamp: '1 day ago',
    details: 'Viewed Q4 performance report',
  },
  {
    id: '4',
    userId: '2',
    userName: 'Sarah Johnson',
    action: 'Scheduled content',
    timestamp: '1 day ago',
    details: 'LinkedIn post for tomorrow 9 AM',
  },
  {
    id: '5',
    userId: '1',
    userName: 'John Smith',
    action: 'Invited team member',
    timestamp: '3 days ago',
    details: 'Sent invitation to mike@company.com',
  },
];

export function getRolePermissions(role: string): string[] {
  switch (role) {
    case 'Admin':
      return ['all'];
    case 'Editor':
      return ['create', 'edit', 'publish', 'schedule'];
    case 'Viewer':
      return ['view'];
    default:
      return ['view'];
  }
}

export function getRoleBadgeColor(role: TeamRole): string {
  switch (role) {
    case 'Admin':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Editor':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Viewer':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function getStatusBadgeColor(status: MemberStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Inactive':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function formatLastActive(lastActive: string | null): string {
  if (!lastActive) return 'Never';
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 5) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function capitalizeRole(role: string): TeamRole {
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'Admin';
  if (lower === 'editor') return 'Editor';
  return 'Viewer';
}
