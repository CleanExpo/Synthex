/**
 * Team Configuration
 * Constants and helper functions
 */

import type { TeamRole, MemberStatus } from './types';

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
