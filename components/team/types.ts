/**
 * Team Types
 * Type definitions for team management
 */

export type TeamRole = 'Admin' | 'Editor' | 'Viewer';
export type MemberStatus = 'Active' | 'Pending' | 'Inactive';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar?: string;
  status: MemberStatus;
  joinedAt: string;
  lastActive: string;
  permissions?: string[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface InviteFormData {
  email: string;
  role: TeamRole;
  message?: string;
}

export interface TeamStats {
  total: number;
  active: number;
  pending: number;
  admins: number;
}
