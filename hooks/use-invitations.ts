'use client';

/**
 * useInvitations
 *
 * Encapsulates pending invitation state for the Teams → Invitations tab.
 * Wires to:
 *  - GET  /api/teams/invitations?status=sent  — list pending invites
 *  - PATCH /api/teams/invitations/[id]        — resend (body: { resend: true })
 *  - DELETE /api/teams/invitations/[id]       — cancel invite
 *
 * SWR dedupingInterval of 30 s keeps the list fresh after mutations.
 *
 * @task UNI-1653
 */

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/fetcher';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  message: string | null;
  status: string;
  sentAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface InvitationsResponse {
  success: boolean;
  data: TeamInvitation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useInvitations() {
  const { data, error, isLoading, mutate } = useSWR<InvitationsResponse>(
    '/api/teams/invitations?status=sent',
    fetchJson,
    {
      dedupingInterval: 30_000,
      refreshInterval: 60_000,
    }
  );

  const invitations: TeamInvitation[] = useMemo(() => data?.data ?? [], [data]);
  const total = data?.pagination.total ?? 0;

  const handleResend = useCallback(
    async (id: string) => {
      const inv = invitations.find(i => i.id === id);
      try {
        const res = await fetch(`/api/teams/invitations/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resend: true }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(
            (body as { error?: string }).error || 'Failed to resend invitation'
          );
          return;
        }

        toast.success(`Invitation resent to ${inv?.email ?? 'member'}`);
        await mutate();
      } catch {
        toast.error('Failed to resend invitation');
      }
    },
    [invitations, mutate]
  );

  const handleCancel = useCallback(
    async (id: string) => {
      const inv = invitations.find(i => i.id === id);
      try {
        const res = await fetch(`/api/teams/invitations/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(
            (body as { error?: string }).error || 'Failed to cancel invitation'
          );
          return;
        }

        toast.success(`Invitation to ${inv?.email ?? 'member'} cancelled`);
        await mutate();
      } catch {
        toast.error('Failed to cancel invitation');
      }
    },
    [invitations, mutate]
  );

  return {
    invitations,
    total,
    isLoading,
    error,
    handleResend,
    handleCancel,
    refetch: mutate,
  };
}
