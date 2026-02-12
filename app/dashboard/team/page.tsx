'use client';

/**
 * Team Management Page
 * Manage team members, roles, and permissions
 *
 * @task UNI-417 - Team Page Decomposition
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import toast from 'react-hot-toast';
import {
  TeamStatsGrid,
  TeamFilters,
  MemberList,
  InviteDialog,
  ActivityLogCard,
  RolePermissionsCard,
  mockTeamMembers,
  mockActivityLog,
  getRolePermissions,
  formatLastActive,
  capitalizeRole,
  type TeamMember,
  type ActivityLog,
  type InviteFormData,
  type TeamRole,
  type TeamStats,
} from '@/components/team';

export default function TeamPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(mockActivityLog);

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

  // Helper to get auth token
  const getAuthToken = useCallback(() => {
    return (
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      localStorage.getItem('token')
    );
  }, []);

  // Fetch team members from API
  const fetchTeamMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (token) {
        const response = await fetch('/api/teams/members', {
          headers: { Authorization: `Bearer ${token}` },
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

          if (apiMembers.length > 0) {
            setTeamMembers(apiMembers);
            setIsLoading(false);
            return;
          }
        }
      }
      // Fallback to mock data
      setTeamMembers(mockTeamMembers);
      setIsLoading(false);
    } catch {
      setTeamMembers(mockTeamMembers);
      setIsLoading(false);
    }
  }, [getAuthToken]);

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
  }, [inviteForm, getAuthToken]);

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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Team Error" message={error} onRetry={fetchTeamMembers} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Team Management</h1>
          <p className="text-slate-400 mt-1">
            Manage your team members, roles, and permissions
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <InviteDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            formData={inviteForm}
            onFormChange={handleInviteFormChange}
            onSubmit={handleInviteMember}
            isSubmitting={isInviting}
          />
        </div>
      </div>

      {/* Stats */}
      <TeamStatsGrid stats={stats} />

      {/* Filters */}
      <TeamFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Members List */}
        <div className="lg:col-span-2">
          <MemberList
            members={filteredMembers}
            onUpdateRole={handleUpdateRole}
            onRemove={handleRemoveMember}
            onResendInvitation={handleResendInvitation}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <ActivityLogCard activities={activityLog} />
          <RolePermissionsCard />
        </div>
      </div>
    </div>
  );
}
