'use client';

/**
 * InvitationsTab
 *
 * Displays pending team invitations with resend and cancel actions.
 * Uses useInvitations hook which wires to:
 *  - GET  /api/teams/invitations?status=sent
 *  - PATCH /api/teams/invitations/[id] (resend)
 *  - DELETE /api/teams/invitations/[id] (cancel)
 *
 * @task UNI-1653
 */

import { Mail, RefreshCw, X, Clock, UserPlus } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInvitations } from '@/hooks/use-invitations';
import type { TeamInvitation } from '@/hooks/use-invitations';

// ─── Role badge colours ───────────────────────────────────────────────────

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  editor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewer: 'bg-white/10 text-white/60 border-white/15',
};

function getRoleBadgeClass(role: string): string {
  return roleBadgeClass[role.toLowerCase()] ?? roleBadgeClass.viewer;
}

// ─── Single invitation row ────────────────────────────────────────────────

interface InvitationRowProps {
  invitation: TeamInvitation;
  onResend: (id: string) => void;
  onCancel: (id: string) => void;
}

function InvitationRow({ invitation, onResend, onCancel }: InvitationRowProps) {
  const sentDate = new Date(invitation.sentAt).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-sm border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      {/* Avatar placeholder */}
      <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center shrink-0">
        <Mail className="w-3.5 h-3.5 text-white/40" />
      </div>

      {/* Email + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 font-medium truncate">
          {invitation.email}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="w-3 h-3 text-white/30 shrink-0" />
          <span className="text-xs text-white/40">Sent {sentDate}</span>
          {invitation.invitedBy?.name && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-xs text-white/40">
                by {invitation.invitedBy.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Role badge */}
      <span
        className={cn(
          'hidden sm:inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium uppercase tracking-wide border',
          getRoleBadgeClass(invitation.role)
        )}
      >
        {invitation.role}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onResend(invitation.id)}
          className="h-7 px-2 text-xs text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
          title="Resend invitation"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Resend
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCancel(invitation.id)}
          className="h-7 px-2 text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10"
          title="Cancel invitation"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyInvitations() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-3">
        <UserPlus className="w-4 h-4 text-white/30" />
      </div>
      <p className="text-sm text-white/50 font-medium">
        No pending invitations
      </p>
      <p className="text-xs text-white/30 mt-1">
        Invitations you send will appear here until accepted.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

interface InvitationsTabProps {
  className?: string;
}

export function InvitationsTab({ className }: InvitationsTabProps) {
  const { invitations, total, isLoading, handleResend, handleCancel } =
    useInvitations();

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-sm bg-white/[0.03] animate-pulse border border-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-white/40 uppercase tracking-widest">
          Pending
        </p>
        {total > 0 && (
          <span className="text-xs text-white/40">
            {total} invitation{total !== 1 ? 's' : ''} awaiting response
          </span>
        )}
      </div>

      {invitations.length === 0 ? (
        <EmptyInvitations />
      ) : (
        <div className="space-y-1.5">
          {invitations.map(inv => (
            <InvitationRow
              key={inv.id}
              invitation={inv}
              onResend={handleResend}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
