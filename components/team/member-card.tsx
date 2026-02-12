'use client';

/**
 * Member Card Component
 * Individual team member card with actions dropdown
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  Mail,
  Crown,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { getRoleBadgeColor, getStatusBadgeColor } from './team-config';
import type { TeamMember, TeamRole } from './types';

interface MemberCardProps {
  member: TeamMember;
  onUpdateRole: (memberId: string, role: TeamRole) => void;
  onRemove: (memberId: string) => void;
  onResendInvitation: (memberId: string) => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Active':
      return <CheckCircle className="h-4 w-4" />;
    case 'Pending':
      return <AlertTriangle className="h-4 w-4" />;
    case 'Inactive':
      return <XCircle className="h-4 w-4" />;
    default:
      return <XCircle className="h-4 w-4" />;
  }
}

export function MemberCard({
  member,
  onUpdateRole,
  onRemove,
  onResendInvitation,
}: MemberCardProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
      <div className="flex items-center space-x-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar} alt={member.name} />
          <AvatarFallback className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
            {member.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-medium text-white">{member.name}</h3>
            {member.role === 'Admin' && <Crown className="h-4 w-4 text-red-400" />}
          </div>
          <p className="text-sm text-slate-400">{member.email}</p>
          <div className="flex items-center space-x-2 mt-1">
            <Badge className={`text-xs ${getRoleBadgeColor(member.role)}`}>
              {member.role}
            </Badge>
            <Badge
              className={`text-xs ${getStatusBadgeColor(member.status)} flex items-center space-x-1`}
            >
              {getStatusIcon(member.status)}
              <span>{member.status}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="text-right">
          <p className="text-sm text-slate-400">Last active</p>
          <p className="text-xs text-slate-500">{member.lastActive}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400"
              aria-label="Member actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {member.status === 'Pending' && (
              <>
                <DropdownMenuItem onClick={() => onResendInvitation(member.id)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Invitation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuLabel>Change Role</DropdownMenuLabel>
            {(['Admin', 'Editor', 'Viewer'] as const).map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => onUpdateRole(member.id, role)}
                disabled={member.role === role}
              >
                {role === 'Admin' && <Crown className="mr-2 h-4 w-4 text-red-400" />}
                {role === 'Editor' && <Edit className="mr-2 h-4 w-4 text-blue-400" />}
                {role === 'Viewer' && <Eye className="mr-2 h-4 w-4 text-slate-400" />}
                {role}
                {member.role === role && <span className="ml-auto text-xs">(current)</span>}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(member.id)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
