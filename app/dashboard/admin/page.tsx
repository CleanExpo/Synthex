'use client';

/**
 * Admin Panel Page
 *
 * Rewritten to use SWR + real /api/admin/* endpoints.
 *
 * Removed:
 *   - supabase.auth.admin.listUsers() (security bug — service-role key in browser)
 *   - fake setTimeout in handleSaveUser
 *   - stub toast-only user actions
 *
 * Added:
 *   - SWR data fetching from /api/admin/users with credentials: 'include'
 *   - Real suspend/activate/delete via POST /api/admin/users
 *   - Tabs: Users | Platform Health | Audit Log
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

import {
  type User,
  type AdminStatsData,
  type UserAction,
  type BulkAction,
  calculateStats,
  exportUsersToCSV,
  AdminHeader,
  AdminStats,
  UserSearchBar,
  BulkActionsBar,
  UsersTable,
  EditUserDialog,
} from '@/components/admin';

import { PlatformHealth } from '@/components/admin/platform-health';
import { AuditLogViewer } from '@/components/admin/audit-log-viewer';
import { VaultManager } from '@/components/admin/vault-manager';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// =============================================================================
// SWR Fetcher — always sends httpOnly auth-token cookie
// =============================================================================

function fetchJson(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => r.json());
}

// =============================================================================
// Map API response row → User shape
// The Prisma API returns camelCase; preferences.status/role are nested.
// =============================================================================

function mapApiUser(raw: Record<string, unknown>): User {
  const prefs = (raw.preferences as Record<string, unknown>) ?? {};
  return {
    id: raw.id as string,
    email: raw.email as string,
    name: raw.name as string | null,
    avatar: raw.avatar as string | null,
    createdAt: raw.createdAt as string,
    lastLogin: raw.lastLogin as string | null,
    emailVerified: raw.emailVerified as boolean,
    authProvider: raw.authProvider as string | null,
    preferences: prefs,
    status: (prefs.status as string) ?? 'active',
    role: (prefs.role as string) ?? 'user',
    _count: raw._count as { campaigns: number } | undefined,
  };
}

// =============================================================================
// Admin Panel
// =============================================================================

export default function AdminPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Active business context (for vault org scoping)
  const { activeOrganizationId } = useActiveBusiness();

  // ---------------------------------------------------------------------------
  // SWR — fetch users from Prisma API
  // ---------------------------------------------------------------------------
  const { data: apiResponse, isLoading, mutate } = useSWR(
    '/api/admin/users?limit=50',
    fetchJson
  );

  // Map raw API users to typed User shape
  const users: User[] = (apiResponse?.data ?? []).map(
    (raw: Record<string, unknown>) => mapApiUser(raw)
  );

  // Client-side search filter
  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Derive stats from SWR data
  const stats: AdminStatsData = calculateStats(users);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleExportUsers = useCallback(() => {
    exportUsersToCSV(users);
  }, [users]);

  const handleUserAction = useCallback(
    async (userId: string, action: UserAction) => {
      try {
        switch (action) {
          case 'ban': {
            const res = await fetch('/api/admin/users', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, action: 'suspend' }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? 'Failed to suspend user');
            toast.success('User suspended successfully');
            mutate();
            break;
          }

          case 'unban': {
            const res = await fetch('/api/admin/users', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, action: 'activate' }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? 'Failed to activate user');
            toast.success('User activated successfully');
            mutate();
            break;
          }

          case 'delete': {
            if (!confirm('Are you sure you want to delete this user?')) return;
            const res = await fetch('/api/admin/users', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, action: 'delete' }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? 'Failed to delete user');
            toast.success('User deleted successfully');
            mutate();
            break;
          }

          case 'reset-password': {
            // Send password reset email via the existing auth endpoint
            const targetUser = users.find((u) => u.id === userId);
            if (!targetUser?.email) {
              toast.error('User email not found');
              break;
            }
            try {
              const res = await fetch('/api/auth/request-reset', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetUser.email }),
              });
              if (!res.ok) throw new Error('Failed to send reset email');
              toast.success(`Password reset email sent to ${targetUser.email}`);
            } catch (resetError) {
              toast.error(resetError instanceof Error ? resetError.message : 'Failed to send password reset');
            }
            break;
          }
        }
      } catch (error) {
        console.error(`Error performing ${action}:`, error);
        toast.error(error instanceof Error ? error.message : `Failed to ${action} user`);
      }
    },
    [mutate, users]
  );

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  }, [selectedUserIds.size, filteredUsers]);

  const handleBulkAction = useCallback(
    async (action: BulkAction) => {
      if (selectedUserIds.size === 0) {
        toast.error('Please select users first');
        return;
      }

      setIsBulkProcessing(true);
      try {
        const selectedCount = selectedUserIds.size;

        switch (action) {
          case 'ban': {
            // Suspend each selected user sequentially
            const results = await Promise.allSettled(
              Array.from(selectedUserIds).map((userId) =>
                fetch('/api/admin/users', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, action: 'suspend' }),
                })
              )
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            toast.success(`${selectedCount - failed} user(s) suspended${failed ? `, ${failed} failed` : ''}`);
            mutate();
            break;
          }

          case 'unban': {
            const results = await Promise.allSettled(
              Array.from(selectedUserIds).map((userId) =>
                fetch('/api/admin/users', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, action: 'activate' }),
                })
              )
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            toast.success(`${selectedCount - failed} user(s) activated${failed ? `, ${failed} failed` : ''}`);
            mutate();
            break;
          }

          case 'delete': {
            if (!confirm(`Are you sure you want to delete ${selectedCount} user(s)?`)) break;
            const results = await Promise.allSettled(
              Array.from(selectedUserIds).map((userId) =>
                fetch('/api/admin/users', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, action: 'delete' }),
                })
              )
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            toast.success(`${selectedCount - failed} user(s) deleted${failed ? `, ${failed} failed` : ''}`);
            mutate();
            break;
          }

          case 'export': {
            const selectedUsers = users.filter((u) => selectedUserIds.has(u.id));
            exportUsersToCSV(selectedUsers, `selected-users-${Date.now()}.csv`);
            toast.success(`Exported ${selectedCount} user(s)`);
            break;
          }
        }

        setSelectedUserIds(new Set());
      } catch (error) {
        console.error(`Bulk ${action} failed:`, error);
        toast.error(`Failed to ${action} users`);
      } finally {
        setIsBulkProcessing(false);
      }
    },
    [selectedUserIds, users, mutate]
  );

  const handleOpenEditDialog = useCallback((user: User) => {
    setEditingUser({ ...user });
    setEditDialogOpen(true);
  }, []);

  const handleSaveUser = useCallback(async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          role: editingUser.role || 'user',
          status: editingUser.status || 'active',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to update user');

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      setEditingUser(null);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  }, [editingUser, mutate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      <AdminHeader onExport={handleExportUsers} />

      <AdminStats stats={stats} />

      <Tabs defaultValue="users">
        <TabsList variant="glass">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="platform-health">Platform Health</TabsTrigger>
          <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
          <TabsTrigger value="vault">Vault</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Users Tab                                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="users">
          <Card variant="glass">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <UserSearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onRefresh={handleRefresh}
                isLoading={isLoading}
              />

              <BulkActionsBar
                selectedCount={selectedUserIds.size}
                onClear={() => setSelectedUserIds(new Set())}
                onBulkAction={handleBulkAction}
                isProcessing={isBulkProcessing}
              />

              <UsersTable
                users={filteredUsers}
                isLoading={isLoading}
                selectedUserIds={selectedUserIds}
                onToggleSelection={toggleUserSelection}
                onToggleSelectAll={toggleSelectAll}
                onUserAction={handleUserAction}
                onEditUser={handleOpenEditDialog}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Platform Health Tab                                                 */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="platform-health">
          <PlatformHealth />
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Audit Log Tab                                                       */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="audit-log">
          <AuditLogViewer />
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Vault Tab                                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="vault">
          <VaultManager organizationId={activeOrganizationId ?? ''} />
        </TabsContent>
      </Tabs>

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={editingUser}
        onUserChange={setEditingUser}
        onSave={handleSaveUser}
        isSaving={isSaving}
      />
    </div>
  );
}
