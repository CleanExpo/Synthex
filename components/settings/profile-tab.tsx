'use client';

/**
 * Profile Tab Component
 * User profile settings with avatar upload and password change (UNI-1651)
 */

import Image from 'next/image';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Save,
} from '@/components/icons';
import type { UserProfile } from './types';

interface ProfileTabProps {
  profile: UserProfile;
  onProfileChange: (field: keyof UserProfile, value: string) => void;
  onAvatarUpload: () => void;
  onSave: () => void;
  isSaving: boolean;
  onChangePassword?: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<boolean>;
}

export function ProfileTab({
  profile,
  onProfileChange,
  onAvatarUpload,
  onSave,
  isSaving,
  onChangePassword,
}: ProfileTabProps) {
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handlePasswordSubmit = async () => {
    if (!onChangePassword) return;
    setIsChangingPassword(true);
    const success = await onChangePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword,
      passwordForm.confirmPassword
    );
    setIsChangingPassword(false);
    if (success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordSection(false);
    }
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal details and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <div className="relative">
            {profile.avatar && profile.avatar.startsWith('http') ? (
              <Image
                src={profile.avatar}
                alt={profile.name || 'Avatar'}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">
                {(profile.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={onAvatarUpload}
              className="absolute bottom-0 right-0 p-2 bg-orange-500 rounded-full text-white hover:bg-orange-600 transition-colors"
              aria-label="Upload avatar"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {profile.name || 'Your Name'}
            </h3>
            <p className="text-sm text-slate-300">
              {profile.role || 'Your Role'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              JPG, PNG or GIF. Max 2MB.
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={e => onProfileChange('name', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={e => onProfileChange('email', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={profile.company}
              onChange={e => onProfileChange('company', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={profile.role}
              onChange={e => onProfileChange('role', e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={e => onProfileChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            className="bg-white/5 border-white/10 min-h-[100px]"
          />
        </div>

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="gradient-primary"
        >
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

        {/* Change Password — collapsible section (UNI-1651) */}
        {onChangePassword && (
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setShowPasswordSection(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors w-full"
            >
              <Key className="w-4 h-4" />
              Change Password
              <ChevronDown
                className={`w-4 h-4 ml-auto transition-transform ${showPasswordSection ? 'rotate-180' : ''}`}
              />
            </button>

            {showPasswordSection && (
              <div className="mt-4 space-y-4">
                {(
                  [
                    {
                      id: 'currentPassword',
                      label: 'Current password',
                      key: 'current' as const,
                    },
                    {
                      id: 'newPassword',
                      label: 'New password',
                      key: 'new' as const,
                    },
                    {
                      id: 'confirmPassword',
                      label: 'Confirm password',
                      key: 'confirm' as const,
                    },
                  ] as const
                ).map(({ id, label, key }) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <div className="relative">
                      <Input
                        id={id}
                        type={showPasswords[key] ? 'text' : 'password'}
                        value={passwordForm[id]}
                        onChange={e =>
                          setPasswordForm(prev => ({
                            ...prev,
                            [id]: e.target.value,
                          }))
                        }
                        className="bg-white/5 border-white/10 pr-10"
                        autoComplete={
                          id === 'currentPassword'
                            ? 'current-password'
                            : 'new-password'
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords(prev => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        aria-label={
                          showPasswords[key] ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPasswords[key] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={handlePasswordSubmit}
                  disabled={
                    isChangingPassword ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                  variant="outline"
                  className="border-white/10 hover:bg-white/5"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
