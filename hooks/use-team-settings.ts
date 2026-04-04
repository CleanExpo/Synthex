'use client';

/**
 * useTeamSettings
 *
 * Encapsulates team settings state for the Team → Settings tab.
 * Wires to:
 *  - GET  /api/teams/stats                   — resolves current org ID
 *  - GET  /api/teams/[id]/settings           — load settings form data
 *  - PATCH /api/teams/[id]/settings          — persist updates
 *
 * Two-phase SWR fetch: stats gives us the org ID, settings gives the form.
 *
 * @task UNI-1653
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/fetcher';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OrgSettings {
  allowMemberInvites: boolean;
  requireApprovalForPosts: boolean;
  defaultPostVisibility: 'public' | 'private' | 'team';
  notifyOnNewMember: boolean;
  notifyOnPostPublished: boolean;
}

export interface TeamSettingsData {
  id: string;
  name: string;
  description: string | null;
  plan: string;
  settings: OrgSettings | null;
}

interface StatsOrg {
  id?: string;
  name?: string;
  plan?: string;
}

interface StatsResponse {
  success: boolean;
  data: {
    organization: StatsOrg;
  };
}

interface SettingsResponse {
  success: boolean;
  data: TeamSettingsData;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: OrgSettings = {
  allowMemberInvites: true,
  requireApprovalForPosts: false,
  defaultPostVisibility: 'team',
  notifyOnNewMember: true,
  notifyOnPostPublished: false,
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTeamSettings() {
  const [isSaving, setIsSaving] = useState(false);

  // Phase 1: get current org ID from stats endpoint
  const { data: statsData } = useSWR<StatsResponse>(
    '/api/teams/stats',
    fetchJson,
    { dedupingInterval: 300_000 }
  );

  const orgId = statsData?.data?.organization?.id ?? null;

  // Phase 2: load settings only when org ID is known
  const {
    data: settingsData,
    error: settingsError,
    isLoading: settingsLoading,
    mutate: mutateSettings,
  } = useSWR<SettingsResponse>(
    orgId ? `/api/teams/${orgId}/settings` : null,
    fetchJson,
    { dedupingInterval: 60_000 }
  );

  const teamSettings = settingsData?.data ?? null;
  const mergedSettings: OrgSettings = {
    ...DEFAULT_SETTINGS,
    ...(teamSettings?.settings ?? {}),
  };

  const handleSave = useCallback(
    async (updates: {
      name?: string;
      description?: string;
      settings?: Partial<OrgSettings>;
    }) => {
      if (!orgId) {
        toast.error('Organisation not found');
        return false;
      }

      setIsSaving(true);
      try {
        const res = await fetch(`/api/teams/${orgId}/settings`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(
            (body as { message?: string }).message || 'Failed to save settings'
          );
          return false;
        }

        toast.success('Settings saved');
        await mutateSettings();
        return true;
      } catch {
        toast.error('Failed to save settings');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [orgId, mutateSettings]
  );

  return {
    orgId,
    teamSettings,
    mergedSettings,
    isLoading: !statsData || (!!orgId && settingsLoading),
    error: settingsError,
    isSaving,
    handleSave,
  };
}
