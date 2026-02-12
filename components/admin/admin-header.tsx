'use client';

/**
 * Admin Header Component
 * Page title and action buttons
 */

import { Button } from '@/components/ui/button';
import { Download, UserPlus } from '@/components/icons';

interface AdminHeaderProps {
  onExport: () => void;
  onAddUser: () => void;
}

export function AdminHeader({ onExport, onAddUser }: AdminHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-gray-400">Manage users and system settings</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Users
        </Button>
        <Button onClick={onAddUser} className="gradient-primary text-white">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>
    </div>
  );
}
