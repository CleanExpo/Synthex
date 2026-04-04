'use client';

/**
 * Team Management Page
 * Manage team members, roles, invitations, and activity
 *
 * @task UNI-1653
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
  InvitationsTab,
  TeamSettingsTab,
} from '@/components/team';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTeamData } from '@/hooks/use-team-data';
import { useInvitations } from '@/hooks/use-invitations';

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

  // Invitations count for badge — prefetch alongside members
  const { total: pendingInviteCount } = useInvitations();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <APIErrorCard
        title="Team Error"
        message={error}
        onRetry={fetchTeamMembers}
      />
    );
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
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
            People
          </span>
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
            Team Management
          </h1>
          <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
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

      {/* Stats — always visible above tabs */}
      <TeamStatsGrid stats={stats} />

      {/* Tabbed content */}
      <Tabs defaultValue="members">
        <TabsList variant="underline" className="w-full justify-start mb-4">
          <TabsTrigger value="members">
            Members
            <span className="ml-1.5 text-[10px] text-white/30">
              {filteredMembers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {pendingInviteCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500/20 text-orange-300 text-[9px] font-semibold">
                {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Members tab ───────────────────────────────────────── */}
        <TabsContent value="members">
          <TeamFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MemberList
                members={filteredMembers}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveMember}
                onResendInvitation={handleResendInvitation}
              />
            </div>
            <div>
              <RolePermissionsCard />
            </div>
          </div>
        </TabsContent>

        {/* ── Invitations tab ───────────────────────────────────── */}
        <TabsContent value="invitations">
          <InvitationsTab className="mt-2" />
        </TabsContent>

        {/* ── Activity tab ──────────────────────────────────────── */}
        <TabsContent value="activity">
          <div className="mt-2 max-w-2xl">
            <ActivityLogCard activities={activityLog} maxItems={50} />
          </div>
        </TabsContent>

        {/* ── Settings tab ──────────────────────────────────────── */}
        <TabsContent value="settings">
          <TeamSettingsTab className="mt-2 max-w-2xl" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
