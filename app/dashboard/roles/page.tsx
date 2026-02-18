'use client';

/**
 * Roles Dashboard Page
 *
 * @description Manages organization roles with CRUD operations,
 * permission assignment, and user management.
 *
 * Features:
 * - Role cards grid with metadata
 * - Create/Edit role dialogs
 * - Permission multi-select by category
 * - User management per role
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useRoles,
  type Role,
  type RoleUser,
  type CreateRoleData,
  type UpdateRoleData,
} from '@/hooks/use-roles';
import { PERMISSIONS, type ResourceType } from '@/lib/auth/rbac/permission-engine';
import {
  Shield,
  Crown,
  Edit,
  Eye,
  Plus,
  Trash2,
  Users,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  UserPlus,
  X,
  Clock,
} from '@/components/icons';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getRoleIcon(roleName: string, isSystem: boolean) {
  const name = roleName.toLowerCase();
  if (name.includes('admin') || name === 'owner') {
    return <Crown className="h-5 w-5 text-red-400" />;
  }
  if (name.includes('editor') || name.includes('manager')) {
    return <Edit className="h-5 w-5 text-blue-400" />;
  }
  if (name.includes('viewer') || name.includes('read')) {
    return <Eye className="h-5 w-5 text-gray-400" />;
  }
  return <Shield className="h-5 w-5 text-cyan-400" />;
}

function getRoleColor(roleName: string): string {
  const name = roleName.toLowerCase();
  if (name.includes('admin') || name === 'owner') {
    return 'text-red-400';
  }
  if (name.includes('editor') || name.includes('manager')) {
    return 'text-blue-400';
  }
  if (name.includes('viewer') || name.includes('read')) {
    return 'text-gray-400';
  }
  return 'text-cyan-400';
}

function formatPermissionLabel(permission: string): string {
  return permission
    .split(':')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' - ');
}

function formatResourceLabel(resource: string): string {
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}

function formatActionLabel(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

// ============================================================================
// ROLE CARD COMPONENT
// ============================================================================

interface RoleCardProps {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onViewUsers: (role: Role) => void;
}

function RoleCard({ role, onEdit, onDelete, onViewUsers }: RoleCardProps) {
  return (
    <Card variant="glass" className="hover:bg-white/[0.08] transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.06]">
              {getRoleIcon(role.name, role.isSystem)}
            </div>
            <div>
              <h3 className={`font-semibold ${getRoleColor(role.name)}`}>
                {role.name}
              </h3>
              {role.description && (
                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                  {role.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {role.isSystem && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30"
              >
                System
              </Badge>
            )}
            {role.isDefault && (
              <Badge
                variant="outline"
                className="text-xs bg-green-500/10 text-green-400 border-green-500/30"
              >
                Default
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            <span>{role.permissions.length} permissions</span>
          </div>
          <button
            onClick={() => onViewUsers(role)}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Users className="h-4 w-4" />
            <span>{role.userCount} users</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 bg-white/5 border-white/10 hover:bg-white/10"
            onClick={() => onEdit(role)}
            disabled={role.isSystem}
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
            onClick={() => onDelete(role)}
            disabled={role.isSystem}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE/EDIT ROLE DIALOG
// ============================================================================

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  availablePermissions: string[];
  onSave: (data: CreateRoleData | UpdateRoleData, roleId?: string) => Promise<void>;
  isSubmitting: boolean;
}

function RoleDialog({
  open,
  onOpenChange,
  role,
  availablePermissions,
  onSave,
  isSubmitting,
}: RoleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  // Reset form when dialog opens/closes or role changes
  const dialogKey = role?.id || 'new';
  useState(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setIsDefault(role.isDefault);
      setSelectedPermissions(new Set(role.permissions));
    } else {
      setName('');
      setDescription('');
      setIsDefault(false);
      setSelectedPermissions(new Set());
    }
  });

  // Reset form when role prop changes
  useMemo(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setDescription(role.description || '');
        setIsDefault(role.isDefault);
        setSelectedPermissions(new Set(role.permissions));
      } else {
        setName('');
        setDescription('');
        setIsDefault(false);
        setSelectedPermissions(new Set());
      }
    }
  }, [open, role]);

  // Group permissions by resource
  const permissionsByResource = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(PERMISSIONS)) {
      grouped[resource] = actions.map(action => `${resource}:${action}`);
    }
    return grouped;
  }, []);

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const toggleResourcePermissions = (resource: string, permissions: string[]) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      const allSelected = permissions.every(p => next.has(p));
      if (allSelected) {
        permissions.forEach(p => next.delete(p));
      } else {
        permissions.forEach(p => next.add(p));
      }
      return next;
    });
  };

  const handleSave = async () => {
    const data = {
      name,
      description: description || undefined,
      permissions: Array.from(selectedPermissions),
      isDefault,
    };

    await onSave(data, role?.id);
  };

  const isValid = name.trim().length > 0 && selectedPermissions.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a]/95 border-cyan-500/20 backdrop-blur-xl sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {role ? 'Edit Role' : 'Create New Role'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {role
              ? 'Update the role name, description, and permissions.'
              : 'Define a new role with specific permissions for your organization.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="role-name" className="text-white">
              Role Name
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Content Manager"
              className="bg-white/5 border-white/10"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="role-description" className="text-white">
              Description
            </Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this role can do..."
              className="bg-white/5 border-white/10 resize-none"
              rows={2}
            />
          </div>

          {/* Default Role */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="role-default"
              checked={isDefault}
              onCheckedChange={checked => setIsDefault(checked === true)}
              variant="glass-primary"
            />
            <Label htmlFor="role-default" className="text-gray-300 cursor-pointer">
              Set as default role for new members
            </Label>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label className="text-white">Permissions</Label>
            <ScrollArea className="h-[280px] rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="p-4 space-y-4">
                {Object.entries(permissionsByResource).map(([resource, permissions]) => {
                  const allSelected = permissions.every(p => selectedPermissions.has(p));
                  const someSelected = permissions.some(p => selectedPermissions.has(p));

                  return (
                    <div key={resource} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`resource-${resource}`}
                          checked={allSelected}
                          onCheckedChange={() =>
                            toggleResourcePermissions(resource, permissions)
                          }
                          variant="glass-primary"
                          className={someSelected && !allSelected ? 'opacity-60' : ''}
                        />
                        <Label
                          htmlFor={`resource-${resource}`}
                          className="text-white font-medium cursor-pointer"
                        >
                          {formatResourceLabel(resource)}
                        </Label>
                        <Badge
                          variant="outline"
                          className="text-xs bg-white/5 border-white/10 text-gray-400"
                        >
                          {permissions.filter(p => selectedPermissions.has(p)).length}/
                          {permissions.length}
                        </Badge>
                      </div>
                      <div className="ml-6 flex flex-wrap gap-2">
                        {permissions.map(permission => {
                          const action = permission.split(':')[1];
                          return (
                            <button
                              key={permission}
                              onClick={() => togglePermission(permission)}
                              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                selectedPermissions.has(permission)
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {formatActionLabel(action)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <p className="text-xs text-gray-500">
              Selected {selectedPermissions.size} permission
              {selectedPermissions.size !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white/5 border-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isSubmitting}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>{role ? 'Update Role' : 'Create Role'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ROLE USERS DIALOG
// ============================================================================

interface RoleUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  users: RoleUser[];
  loading: boolean;
  onRevoke: (userId: string) => Promise<void>;
  onAddUser: () => void;
}

function RoleUsersDialog({
  open,
  onOpenChange,
  role,
  users,
  loading,
  onRevoke,
  onAddUser,
}: RoleUsersDialogProps) {
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());

  const handleRevoke = async (userId: string) => {
    setRevokingIds(prev => new Set(prev).add(userId));
    try {
      await onRevoke(userId);
    } finally {
      setRevokingIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a]/95 border-cyan-500/20 backdrop-blur-xl sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {getRoleIcon(role.name, role.isSystem)}
            {role.name} Users
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {role.userCount} user{role.userCount !== 1 ? 's' : ''} with this role
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No users have this role yet.</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {users.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                        <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-gray-500 mr-2">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(user.grantedAt)}
                        </div>
                        {user.expiresAt && (
                          <div className="text-amber-400">
                            Expires {formatRelativeTime(user.expiresAt)}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
                        onClick={() => handleRevoke(user.id)}
                        disabled={revokingIds.has(user.id)}
                      >
                        {revokingIds.has(user.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={onAddUser}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DELETE CONFIRMATION DIALOG
// ============================================================================

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

function DeleteDialog({ open, onOpenChange, role, onConfirm, isDeleting }: DeleteDialogProps) {
  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172a]/95 border-red-500/20 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Delete Role
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Are you sure you want to delete the role &quot;{role.name}&quot;? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        {role.userCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-300">
            <strong>Warning:</strong> {role.userCount} user
            {role.userCount !== 1 ? 's have' : ' has'} this role. They will lose access
            to permissions granted by this role.
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white/5 border-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Role
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card variant="glass">
      <CardContent className="py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No custom roles yet</h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Use the predefined system roles or create your own custom roles with specific
            permissions.
          </p>
          <Button onClick={onCreate} className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="h-4 w-4 mr-2" />
            Create Custom Role
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function RolesPage() {
  const {
    roles,
    availablePermissions,
    loading,
    error,
    create,
    update,
    remove,
    grantToUser,
    revokeFromUser,
    getUsersWithRole,
    refresh,
  } = useRoles();

  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter roles
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(
      role =>
        role.name.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  }, [roles, searchQuery]);

  // Separate system and custom roles
  const systemRoles = filteredRoles.filter(r => r.isSystem);
  const customRoles = filteredRoles.filter(r => !r.isSystem);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleDialogOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleViewUsers = async (role: Role) => {
    setSelectedRoleForUsers(role);
    setUsersDialogOpen(true);
    setLoadingUsers(true);
    try {
      const users = await getUsersWithRole(role.id);
      setRoleUsers(users);
    } catch {
      setRoleUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSaveRole = async (
    data: CreateRoleData | UpdateRoleData,
    roleId?: string
  ) => {
    setIsSubmitting(true);
    try {
      if (roleId) {
        await update(roleId, data as UpdateRoleData);
      } else {
        await create(data as CreateRoleData);
      }
      setRoleDialogOpen(false);
      setEditingRole(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await remove(roleToDelete.id);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    if (!selectedRoleForUsers) return;
    await revokeFromUser(selectedRoleForUsers.id, userId);
    // Refresh the users list
    const users = await getUsersWithRole(selectedRoleForUsers.id);
    setRoleUsers(users);
  };

  const handleAddUser = () => {
    // TODO: Open user search dialog
    // For now, just close the users dialog
    setUsersDialogOpen(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Shield className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Role Management</h1>
            <p className="text-gray-400">Configure roles and permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-white/10 hover:bg-white/5"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button onClick={handleCreateRole} className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          type="search"
          placeholder="Search roles..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full max-w-md pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      {/* Error State */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Roles Grid */}
      {!loading && (
        <>
          {/* System Roles Section */}
          {systemRoles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                System Roles
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {systemRoles.map(role => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={handleEditRole}
                    onDelete={handleDeleteRole}
                    onViewUsers={handleViewUsers}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom Roles Section */}
          {customRoles.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-400" />
                Custom Roles
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customRoles.map(role => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={handleEditRole}
                    onDelete={handleDeleteRole}
                    onViewUsers={handleViewUsers}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {customRoles.length === 0 && systemRoles.length === 0 && !error && (
            <EmptyState onCreate={handleCreateRole} />
          )}

          {/* Empty Search Results */}
          {filteredRoles.length === 0 && roles.length > 0 && (
            <Card variant="glass">
              <CardContent className="py-12">
                <div className="text-center">
                  <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">No roles found</h3>
                  <p className="text-gray-400">
                    No roles match your search &quot;{searchQuery}&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialogs */}
      <RoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        role={editingRole}
        availablePermissions={availablePermissions}
        onSave={handleSaveRole}
        isSubmitting={isSubmitting}
      />

      <RoleUsersDialog
        open={usersDialogOpen}
        onOpenChange={setUsersDialogOpen}
        role={selectedRoleForUsers}
        users={roleUsers}
        loading={loadingUsers}
        onRevoke={handleRevokeUser}
        onAddUser={handleAddUser}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        role={roleToDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
