'use client';

/**
 * Invite Dialog Component
 * Dialog for inviting new team members
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Mail, Loader2, Crown, Edit, Eye } from 'lucide-react';
import type { InviteFormData, TeamRole } from './types';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: InviteFormData;
  onFormChange: (data: Partial<InviteFormData>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function InviteDialog({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  isSubmitting,
}: InviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gradient-primary">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          <DialogDescription className="text-slate-400">
            Send an invitation to join your team with specific role permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="email" className="text-slate-400">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="member@company.com"
              value={formData.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>
          <div>
            <Label htmlFor="role" className="text-slate-400">
              Role
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value) => onFormChange({ role: value as TeamRole })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">
                  <div className="flex items-center">
                    <Crown className="mr-2 h-4 w-4 text-red-400" />
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-xs text-slate-400">Full access to all features</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="Editor">
                  <div className="flex items-center">
                    <Edit className="mr-2 h-4 w-4 text-blue-400" />
                    <div>
                      <div className="font-medium">Editor</div>
                      <div className="text-xs text-slate-400">Can create and edit content</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="Viewer">
                  <div className="flex items-center">
                    <Eye className="mr-2 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="font-medium">Viewer</div>
                      <div className="text-xs text-slate-400">Read-only access</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="message" className="text-slate-400">
              Custom Message (Optional)
            </Label>
            <textarea
              id="message"
              rows={3}
              placeholder="Welcome to our team! We're excited to have you..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white mt-1 placeholder:text-slate-500"
              value={formData.message || ''}
              onChange={(e) => onFormChange({ message: e.target.value })}
            />
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
          <Button onClick={onSubmit} disabled={isSubmitting} className="gradient-primary">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
