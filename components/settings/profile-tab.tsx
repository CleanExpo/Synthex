'use client';

/**
 * Profile Tab Component
 * User profile settings with avatar upload
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, Save } from '@/components/icons';
import type { UserProfile } from './types';

interface ProfileTabProps {
  profile: UserProfile;
  onProfileChange: (field: keyof UserProfile, value: string) => void;
  onAvatarUpload: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function ProfileTab({
  profile,
  onProfileChange,
  onAvatarUpload,
  onSave,
  isSaving,
}: ProfileTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal details and profile picture</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
              {profile.avatar || profile.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={onAvatarUpload}
              className="absolute bottom-0 right-0 p-2 bg-cyan-500 rounded-full text-white hover:bg-cyan-600 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-white">{profile.name}</h3>
            <p className="text-sm text-slate-400">{profile.role}</p>
            <p className="text-xs text-slate-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) => onProfileChange('name', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => onProfileChange('email', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={profile.company}
              onChange={(e) => onProfileChange('company', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={profile.role}
              onChange={(e) => onProfileChange('role', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={(e) => onProfileChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            className="bg-white/5 border-white/10 min-h-[100px]"
          />
        </div>

        <Button onClick={onSave} disabled={isSaving} className="gradient-primary">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
