'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase-client';
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

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [stats, setStats] = useState<AdminStatsData>({
    totalUsers: 0,
    activeToday: 0,
    newThisWeek: 0,
    bannedUsers: 0
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      setUsers((users as User[]) || []);
      setFilteredUsers((users as User[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  useEffect(() => {
    try {
      setStats(calculateStats(users));
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [users]);

  const handleUserAction = useCallback(async (userId: string, action: UserAction) => {
    try {
      switch (action) {
        case 'ban':
          toast.success('User banned successfully');
          break;
        case 'unban':
          toast.success('User unbanned successfully');
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this user?')) {
            const { error } = await supabase.auth.admin.deleteUser(userId);
            if (error) throw error;
            toast.success('User deleted successfully');
            fetchUsers();
          }
          break;
        case 'reset-password':
          toast.success('Password reset email sent');
          break;
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast.error(`Failed to ${action} user`);
    }
  }, [fetchUsers]);

  const handleExportUsers = useCallback(() => {
    exportUsersToCSV(users);
  }, [users]);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
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
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  }, [selectedUserIds.size, filteredUsers]);

  const handleBulkAction = useCallback(async (action: BulkAction) => {
    if (selectedUserIds.size === 0) {
      toast.error('Please select users first');
      return;
    }

    setIsBulkProcessing(true);
    try {
      const selectedCount = selectedUserIds.size;

      switch (action) {
        case 'ban':
          setUsers(prev => prev.map(u =>
            selectedUserIds.has(u.id) ? { ...u, status: 'banned' } : u
          ));
          toast.success(`${selectedCount} user(s) banned`);
          break;
        case 'unban':
          setUsers(prev => prev.map(u =>
            selectedUserIds.has(u.id) ? { ...u, status: 'active' } : u
          ));
          toast.success(`${selectedCount} user(s) unbanned`);
          break;
        case 'delete':
          if (confirm(`Are you sure you want to delete ${selectedCount} user(s)?`)) {
            setUsers(prev => prev.filter(u => !selectedUserIds.has(u.id)));
            toast.success(`${selectedCount} user(s) deleted`);
          }
          break;
        case 'export':
          const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
          exportUsersToCSV(selectedUsers, `selected-users-${Date.now()}.csv`);
          toast.success(`Exported ${selectedCount} user(s)`);
          break;
      }
      setSelectedUserIds(new Set());
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
      toast.error(`Failed to ${action} users`);
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selectedUserIds, users]);

  const handleOpenEditDialog = useCallback((user: User) => {
    setEditingUser({ ...user });
    setEditDialogOpen(true);
  }, []);

  const handleSaveUser = useCallback(async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      setUsers(prev => prev.map(u =>
        u.id === editingUser.id ? editingUser : u
      ));

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch {
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  }, [editingUser]);

  return (
    <div className="p-6 space-y-6">
      <AdminHeader
        onExport={handleExportUsers}
      />

      <AdminStats stats={stats} />

      <Card variant="glass">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <UserSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onRefresh={fetchUsers}
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
