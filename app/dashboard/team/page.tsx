'use client';

/**
 * Team Management Page
 * Manage team members, roles, and permissions
 *
 * @task UNI-417 - Team Page Decomposition
 */

import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard, EmptyState } from '@/components/error-states';
import {
  TeamStatsGrid,
  TeamFilters,
  MemberList,
  InviteDialog,
  ActivityLogCard,
  RolePermissionsCard,
} from '@/components/team';
import { useTeamData } from '@/hooks/use-team-data';

export default function TeamPage() {
  const {
    isLoading,
    isInviting,
    error,
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
    teamMembers,
    fetchTeamMembers,
    handleInviteMember,
    handleUpdateRole,
    handleRemoveMember,
    handleResendInvitation,
    handleInviteFormChange,
  } = useTeamData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Team Error" message={error} onRetry={fetchTeamMembers} />;
  }

  if (teamMembers.length === 0) {
    return (
      <EmptyState
        title="No team members yet"
        message="Invite your first team member to get started."
        actionLabel="Invite Member"
        onAction={() => setInviteDialogOpen(true)}
      />
    );
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
