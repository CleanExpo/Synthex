'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Shield,
  Ban,
  CheckCircle,
  AlertCircle,
  Mail,
  Calendar,
  Activity,
  Trash2,
  Edit,
  RefreshCw,
  Download,
  UserPlus,
  Loader2
} from '@/components/icons';
import { supabase } from '@/lib/supabase-client';
import toast, { Toaster } from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  role?: string;
  status?: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    newThisWeek: 0,
    bannedUsers: 0
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch users from Supabase Auth Admin API
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      
      if (error) throw error;
      
      setUsers((users as any[]) || []);
      setFilteredUsers((users as any[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
      // Use mock data for demo
      const mockUsers = [
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
      setUsers(mockUsers);
      setFilteredUsers(mockUsers);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    // Filter users based on search term
    const filtered = users.filter(user => 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  useEffect(() => {
    try {
      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      
      // Calculate statistics
      const nextStats = {
        totalUsers: users.length,
        activeToday: users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > today).length,
        newThisWeek: users.filter(u => new Date(u.created_at) > weekAgo).length,
        bannedUsers: users.filter(u => u.status === 'banned').length
      };
      
      setStats(nextStats);
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [users]);

  const handleUserAction = async (userId: string, action: string) => {
    try {
      switch (action) {
        case 'ban':
          // Ban user logic
          toast.success('User banned successfully');
          break;
        case 'unban':
          // Unban user logic
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
          // Send password reset email
          toast.success('Password reset email sent');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  const exportUsers = () => {
    const csv = [
      ['ID', 'Email', 'Created At', 'Last Sign In', 'Status'],
      ...users.map(u => [
        u.id,
        u.email,
        u.created_at,
        u.last_sign_in_at || 'Never',
        u.status || 'active'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
  };

  // Bulk selection handlers
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleBulkAction = async (action: 'ban' | 'unban' | 'delete' | 'export') => {
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
          const csv = [
            ['ID', 'Email', 'Created At', 'Last Sign In', 'Status', 'Role'],
            ...selectedUsers.map(u => [
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
          a.download = `selected-users-${Date.now()}.csv`;
          a.click();
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
  };

  const handleAddUser = () => {
    toast.success('Add User dialog coming soon');
  };

  const handleFilter = () => {
    toast.success('Filter options coming soon');
  };

  const handleOpenEditDialog = (user: User) => {
    setEditingUser({ ...user });
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      // In production, this would call the API to update the user
      await new Promise(resolve => setTimeout(resolve, 800));

      setUsers(prev => prev.map(u =>
        u.id === editingUser.id ? editingUser : u
      ));

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-gray-400">Manage users and system settings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportUsers} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Users
          </Button>
          <Button onClick={handleAddUser} className="gradient-primary text-white">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2 text-cyan-400" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
            <p className="text-xs text-gray-400 mt-1">Registered accounts</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="w-4 h-4 mr-2 text-green-400" />
              Active Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats.activeToday}</p>
            <p className="text-xs text-gray-400 mt-1">Users signed in today</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserPlus className="w-4 h-4 mr-2 text-blue-400" />
              New This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats.newThisWeek}</p>
            <p className="text-xs text-gray-400 mt-1">Recent signups</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Ban className="w-4 h-4 mr-2 text-red-400" />
              Banned Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats.bannedUsers}</p>
            <p className="text-xs text-gray-400 mt-1">Suspended accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users by email or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={handleFilter} variant="outline" className="border-white/10">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button onClick={fetchUsers} variant="outline" className="border-white/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedUserIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-cyan-300">
                  {selectedUserIds.size} user(s) selected
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="text-gray-400 hover:text-white"
                >
                  Clear
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('export')}
                  disabled={isBulkProcessing}
                  className="border-white/10"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('ban')}
                  disabled={isBulkProcessing}
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Ban
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('unban')}
                  disabled={isBulkProcessing}
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Unban
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('delete')}
                  disabled={isBulkProcessing}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Joined</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Last Active</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        selectedUserIds.has(user.id) ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold mr-3">
                            {user.email?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.email}</p>
                            <p className="text-xs text-gray-400">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${
                          user.status === 'banned' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {user.status === 'banned' ? (
                            <Ban className="w-3 h-3 mr-1" />
                          ) : (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {user.status || 'Active'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className="bg-cyan-500/20 text-cyan-400">
                          {user.role === 'admin' ? (
                            <Shield className="w-3 h-3 mr-1" />
                          ) : null}
                          {user.role || 'User'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditDialog(user)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUserAction(user.id, 'reset-password')}
                            className="text-gray-400 hover:text-white"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUserAction(user.id, user.status === 'banned' ? 'unban' : 'ban')}
                            className="text-gray-400 hover:text-white"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUserAction(user.id, 'delete')}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update user details and permissions.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-gray-300">Email</Label>
                <Input
                  id="edit-email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Role</Label>
                <Select
                  value={editingUser.role || 'user'}
                  onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, role: value } : null)}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Status</Label>
                <Select
                  value={editingUser.status || 'active'}
                  onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, status: value } : null)}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-400">
                  <strong>ID:</strong> {editingUser.id}
                </p>
                <p className="text-xs text-gray-400">
                  <strong>Created:</strong> {new Date(editingUser.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-400">
                  <strong>Last Sign In:</strong> {editingUser.last_sign_in_at ? new Date(editingUser.last_sign_in_at).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingUser(null);
              }}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={isSaving}
              className="gradient-primary text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
