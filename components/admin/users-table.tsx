'use client';

/**
 * Users Table Component
 * Main user management table with row selection
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Ban, CheckCircle, Edit, Mail, Trash2 } from '@/components/icons';
import type { User, UserAction } from './types';

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  selectedUserIds: Set<string>;
  onToggleSelection: (userId: string) => void;
  onToggleSelectAll: () => void;
  onUserAction: (userId: string, action: UserAction) => void;
  onEditUser: (user: User) => void;
}

export function UsersTable({
  users,
  isLoading,
  selectedUserIds,
  onToggleSelection,
  onToggleSelectAll,
  onUserAction,
  onEditUser
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={selectedUserIds.size === users.length && users.length > 0}
                onChange={onToggleSelectAll}
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
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-gray-400">
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => (
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
                    onChange={() => onToggleSelection(user.id)}
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
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">
                  {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleDateString()
                    : 'Never'
                  }
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditUser(user)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUserAction(user.id, 'reset-password')}
                      className="text-gray-400 hover:text-white"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUserAction(user.id, user.status === 'banned' ? 'unban' : 'ban')}
                      className="text-gray-400 hover:text-white"
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onUserAction(user.id, 'delete')}
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
  );
}
