'use client';

/**
 * Edit User Dialog Component
 * Dialog for editing user details and permissions
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2 } from '@/components/icons';
import type { User } from './types';
import { roleOptions, statusOptions } from './admin-config';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserChange: (user: User | null) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onUserChange,
  onSave,
  isSaving
}: EditUserDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onUserChange(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Edit User</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update user details and permissions.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-gray-300">Email</Label>
              <Input
                id="edit-email"
                value={user.email}
                readOnly
                className="bg-white/5 border-white/10 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500">Email cannot be changed from the admin panel</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Role</Label>
              <Select
                value={user.role || 'user'}
                onValueChange={(value) => onUserChange({ ...user, role: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Status</Label>
              <Select
                value={user.status || 'active'}
                onValueChange={(value) => onUserChange({ ...user, status: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-gray-400">
                <strong>ID:</strong> {user.id}
              </p>
              <p className="text-xs text-gray-400">
                <strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-400">
                <strong>Last Login:</strong> {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
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
  );
}
