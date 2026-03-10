'use client';

/**
 * Member List Component
 * List of team members with empty state
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from '@/components/icons';
import { MemberCard } from './member-card';
import type { TeamMember, TeamRole } from './types';

interface MemberListProps {
  members: TeamMember[];
  onUpdateRole: (memberId: string, role: TeamRole) => void;
  onRemove: (memberId: string) => void;
  onResendInvitation: (memberId: string) => void;
}

export function MemberList({
  members,
  onUpdateRole,
  onRemove,
  onResendInvitation,
}: MemberListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white">Team Members</CardTitle>
        <CardDescription className="text-slate-400">
          Manage roles and permissions for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onUpdateRole={onUpdateRole}
            onRemove={onRemove}
            onResendInvitation={onResendInvitation}
          />
        ))}

        {members.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400">No team members found</h3>
            <p className="text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
