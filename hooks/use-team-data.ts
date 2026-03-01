'use client';

/**
 * Custom hook that encapsulates team page state, data loading, and handlers.
 * Extracted from app/dashboard/team/page.tsx to reduce page file size.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  getRolePermissions,
  formatLastActive,
  capitalizeRole,
  type TeamMember,
  type ActivityLog,
  type InviteFormData,
  type TeamRole,
  type TeamStats,
} from '@/components/team';

/** Helper to get auth token from storage */
function getAuthToken(): string | null {
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

export function useTeamData() {
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    role: 'Viewer',
    message: '',
  });

  // Fetch team members from API
  const fetchTeamMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      {
        const response = await fetch('/api/teams/members', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const { data } = await response.json();
          const apiMembers: TeamMember[] = data.map((m: Record<string, unknown>) => ({
            id: m.id as string,
            name: (m.name as string) || 'Unknown',
            email: m.email as string,
            role: capitalizeRole((m.role as string) || 'viewer'),
            avatar: (m.avatar as string) || '',
            status: m.lastActive ? 'Active' : 'Pending',
            joinedAt: (m.joinedAt as string)?.split('T')[0] || '',
            lastActive: formatLastActive(m.lastActive as string | null),
            permissions: getRolePermissions((m.role as string) || 'viewer'),
          }));

          setTeamMembers(apiMembers);
          setIsLoading(false);
          return;
        }

        // 400 "No organization found" means the user has no org yet — show empty team, not error
        if (response.status === 400) {
          const body = await response.json().catch(() => ({}));
          if ((body as { error?: string }).error === 'No organization found') {
            setTeamMembers([]);
            setIsLoading(false);
            return;
          }
        }
      }
      setError('Failed to load team members');
      setIsLoading(false);
    } catch {
      setError('Failed to load team members');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // Filter team members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [teamMembers, searchQuery, roleFilter, statusFilter]);

  // Stats
  const stats: TeamStats = useMemo(
    () => ({
      total: teamMembers.length,
      active: teamMembers.filter((m) => m.status === 'Active').length,
      pending: teamMembers.filter((m) => m.status === 'Pending').length,
      admins: teamMembers.filter((m) => m.role === 'Admin').length,
    }),
    [teamMembers]
  );

  // Handlers
  const handleInviteMember = useCallback(async () => {
    if (!inviteForm.email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      const token = getAuthToken();
      if (token) {
        const response = await fetch('/api/teams/members', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteForm.email,
            role: inviteForm.role.toLowerCase(),
            message: inviteForm.message || undefined,
          }),
        });

        if (response.ok) {
          const { data } = await response.json();
          const newMember: TeamMember = {
            id: data.id || Date.now().toString(),
            name: inviteForm.email.split('@')[0],
            email: inviteForm.email,
            role: inviteForm.role,
            status: 'Pending',
            joinedAt: new Date().toISOString().split('T')[0],
            lastActive: 'Never',
            permissions: getRolePermissions(inviteForm.role),
          };
          setTeamMembers((prev) => [...prev, newMember]);

          const newActivity: ActivityLog = {
            id: Date.now().toString(),
            userId: '1',
            userName: 'You',
            action: 'Invited team member',
            timestamp: 'Just now',
            details: `Sent invitation to ${inviteForm.email}`,
          };
          setActivityLog((prev) => [newActivity, ...prev]);

          toast.success(`Invitation sent to ${inviteForm.email}`);
          setInviteDialogOpen(false);
          setInviteForm({ email: '', role: 'Viewer', message: '' });
          setIsInviting(false);
          return;
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to send invitation');
          setIsInviting(false);
          return;
        }
      }

      // Fallback: simulate for demo
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: inviteForm.email.split('@')[0],
        email: inviteForm.email,
        role: inviteForm.role,
        status: 'Pending',
        joinedAt: new Date().toISOString().split('T')[0],
        lastActive: 'Never',
        permissions: getRolePermissions(inviteForm.role),
      };

      setTeamMembers((prev) => [...prev, newMember]);

      const newActivity: ActivityLog = {
        id: Date.now().toString(),
        userId: '1',
        userName: 'You',
        action: 'Invited team member',
        timestamp: 'Just now',
        details: `Sent invitation to ${inviteForm.email}`,
      };
      setActivityLog((prev) => [newActivity, ...prev]);

      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'Viewer', message: '' });
    } catch (err) {
      console.error('Invite error:', err);
      toast.error('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  }, [inviteForm]);

  const handleUpdateRole = useCallback((memberId: string, newRole: TeamRole) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;

    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, role: newRole, permissions: getRolePermissions(newRole) } : m
      )
    );

    const newActivity: ActivityLog = {
      id: Date.now().toString(),
      userId: '1',
      userName: 'You',
      action: 'Updated member role',
      timestamp: 'Just now',
      details: `Changed ${member.name}'s role to ${newRole}`,
    };
    setActivityLog((prev) => [newActivity, ...prev]);

    toast.success(`${member.name}'s role updated to ${newRole}`);
  }, [teamMembers]);

  const handleRemoveMember = useCallback((memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;

    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));

    const newActivity: ActivityLog = {
      id: Date.now().toString(),
      userId: '1',
      userName: 'You',
      action: 'Removed team member',
      timestamp: 'Just now',
      details: `Removed ${member.name} from the team`,
    };
    setActivityLog((prev) => [newActivity, ...prev]);

    toast.success(`${member.name} removed from team`);
  }, [teamMembers]);

  const handleResendInvitation = useCallback((memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return;
    toast.success(`Invitation resent to ${member.email}`);
  }, [teamMembers]);

  const handleInviteFormChange = useCallback((data: Partial<InviteFormData>) => {
    setInviteForm((prev) => ({ ...prev, ...data }));
  }, []);

  return {
    // State
    isLoading,
    isInviting,
    error,
    teamMembers,
    activityLog,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    inviteDialogOpen,
    setInviteDialogOpen,
    inviteForm,
    filteredMembers,
    stats,

    // Handlers
    fetchTeamMembers,
    handleInviteMember,
    handleUpdateRole,
    handleRemoveMember,
    handleResendInvitation,
    handleInviteFormChange,
  };
}
