'use client';

/**
 * TeamSettingsTab
 *
 * Form-driven settings UI for the Team → Settings tab.
 * Wires to GET + PATCH /api/teams/[id]/settings via useTeamSettings.
 *
 * Covers: team name, description, invitation policy, post approval,
 * default post visibility, and notification preferences.
 *
 * @task UNI-1653
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTeamSettings } from '@/hooks/use-team-settings';
import type { OrgSettings } from '@/hooks/use-team-settings';

// ─── Toggle row ────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 font-medium">{label}</p>
        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
          checked ? 'bg-orange-500' : 'bg-white/[0.12]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

// ─── Visibility selector ──────────────────────────────────────────────────

const VISIBILITY_OPTIONS: {
  value: OrgSettings['defaultPostVisibility'];
  label: string;
}[] = [
  { value: 'team', label: 'Team only' },
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

// ─── Main component ───────────────────────────────────────────────────────

interface TeamSettingsTabProps {
  className?: string;
}

export function TeamSettingsTab({ className }: TeamSettingsTabProps) {
  const { teamSettings, mergedSettings, isLoading, isSaving, handleSave } =
    useTeamSettings();

  // Local form state — synced from API on load
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [settings, setSettings] = useState<OrgSettings>(mergedSettings);

  // Sync form once data loads
  useEffect(() => {
    if (teamSettings) {
      setName(teamSettings.name ?? '');
      setDescription(teamSettings.description ?? '');
    }
    setSettings(mergedSettings);
    // mergedSettings changes when API data arrives — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSettings?.id]);

  const updateSetting = <K extends keyof OrgSettings>(
    key: K,
    value: OrgSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave({ name, description, settings });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-sm bg-white/[0.03] animate-pulse border border-white/[0.04]"
          />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-5', className)}>
      {/* Organisation details */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-base font-medium">
            Organisation Details
          </CardTitle>
          <CardDescription className="text-white/40">
            Update your team name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs text-white/60">
              Team name
            </Label>
            <Input
              id="team-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your team name"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus:border-orange-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-description" className="text-xs text-white/60">
              Description
            </Label>
            <Input
              id="team-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of your team"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus:border-orange-500/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Membership settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-base font-medium">
            Membership
          </CardTitle>
          <CardDescription className="text-white/40">
            Control how members join and collaborate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            label="Allow member invites"
            description="Team members can invite others without admin approval"
            checked={settings.allowMemberInvites}
            onChange={val => updateSetting('allowMemberInvites', val)}
          />
          <ToggleRow
            label="Require post approval"
            description="All published posts must be approved by an admin before going live"
            checked={settings.requireApprovalForPosts}
            onChange={val => updateSetting('requireApprovalForPosts', val)}
          />

          {/* Default post visibility */}
          <div className="pt-3">
            <p className="text-sm text-white/80 font-medium mb-1">
              Default post visibility
            </p>
            <p className="text-xs text-white/40 mb-3">
              Default audience when creating new posts
            </p>
            <div className="flex gap-2">
              {VISIBILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    updateSetting('defaultPostVisibility', opt.value)
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-sm border transition-colors',
                    settings.defaultPostVisibility === opt.value
                      ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.06]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification preferences */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-white text-base font-medium">
            Notifications
          </CardTitle>
          <CardDescription className="text-white/40">
            Configure which team events trigger notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            label="New member joins"
            description="Notify admins when someone accepts an invitation"
            checked={settings.notifyOnNewMember}
            onChange={val => updateSetting('notifyOnNewMember', val)}
          />
          <ToggleRow
            label="Post published"
            description="Notify the team when content goes live"
            checked={settings.notifyOnPostPublished}
            onChange={val => updateSetting('notifyOnPostPublished', val)}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-orange-500 hover:bg-orange-400 text-[#050505] font-semibold px-6"
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
