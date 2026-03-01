'use client';

/**
 * Notifications Tab Component
 * Notification preferences and channels
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Mail, MessageSquare, Smartphone, Loader2, Save } from '@/components/icons';
import type { NotificationSettings } from './types';

interface NotificationsTabProps {
  settings: NotificationSettings;
  onSettingChange: (field: keyof NotificationSettings, value: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function NotificationsTab({
  settings,
  onSettingChange,
  onSave,
  isSaving,
}: NotificationsTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose how you want to be notified</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channels */}
        <div>
          <h4 className="text-sm font-medium text-white mb-4">Notification Channels</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="font-medium text-white">Email Notifications</p>
                  <p className="text-sm text-slate-400">Receive updates via email</p>
                </div>
              </div>
              <Switch
                checked={settings.email}
                onCheckedChange={(checked) => onSettingChange('email', checked)}
                aria-label="Email notifications"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="font-medium text-white">Push Notifications</p>
                  <p className="text-sm text-slate-400">Browser and mobile push alerts</p>
                </div>
              </div>
              <Switch
                checked={settings.push}
                onCheckedChange={(checked) => onSettingChange('push', checked)}
                aria-label="Push notifications"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="font-medium text-white">SMS Notifications</p>
                  <p className="text-sm text-slate-400">Text message alerts for urgent updates</p>
                </div>
              </div>
              <Switch
                checked={settings.sms}
                onCheckedChange={(checked) => onSettingChange('sms', checked)}
                aria-label="SMS notifications"
              />
            </div>
          </div>
        </div>

        {/* Types */}
        <div>
          <h4 className="text-sm font-medium text-white mb-4">Notification Types</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Weekly Report</Label>
                <p className="text-sm text-slate-400">Get a weekly summary of your performance</p>
              </div>
              <Switch
                checked={settings.weeklyReport}
                onCheckedChange={(checked) => onSettingChange('weeklyReport', checked)}
                aria-label="Weekly report"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Viral Content Alert</Label>
                <p className="text-sm text-slate-400">Get notified when your content goes viral</p>
              </div>
              <Switch
                checked={settings.viralAlert}
                onCheckedChange={(checked) => onSettingChange('viralAlert', checked)}
                aria-label="Viral content alert"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">System Updates</Label>
                <p className="text-sm text-slate-400">Important platform updates and announcements</p>
              </div>
              <Switch
                checked={settings.systemUpdates}
                onCheckedChange={(checked) => onSettingChange('systemUpdates', checked)}
                aria-label="System updates"
              />
            </div>
          </div>
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
              Save Preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
