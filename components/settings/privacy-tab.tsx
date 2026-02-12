'use client';

/**
 * Privacy Tab Component
 * Privacy settings and data management
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Download, Loader2, Save, Trash2 } from '@/components/icons';
import type { PrivacySettings } from './types';

interface PrivacyTabProps {
  settings: PrivacySettings;
  onSettingChange: (field: keyof PrivacySettings, value: boolean) => void;
  onSave: () => void;
  onExportData: () => void;
  onDeleteAccount: () => void;
  isSaving: boolean;
  isExporting: boolean;
}

export function PrivacyTab({
  settings,
  onSettingChange,
  onSave,
  onExportData,
  onDeleteAccount,
  isSaving,
  isExporting,
}: PrivacyTabProps) {
  return (
    <div className="space-y-6">
      {/* Privacy Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>Control your data and visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Public Profile</Label>
                <p className="text-sm text-slate-400">Allow others to see your profile</p>
              </div>
              <Switch
                checked={settings.publicProfile}
                onCheckedChange={(checked) => onSettingChange('publicProfile', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Show Analytics</Label>
                <p className="text-sm text-slate-400">Display your performance metrics publicly</p>
              </div>
              <Switch
                checked={settings.showAnalytics}
                onCheckedChange={(checked) => onSettingChange('showAnalytics', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Data Collection</Label>
                <p className="text-sm text-slate-400">Allow us to collect usage data for improvements</p>
              </div>
              <Switch
                checked={settings.dataCollection}
                onCheckedChange={(checked) => onSettingChange('dataCollection', checked)}
              />
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
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or delete your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
            <div>
              <p className="font-medium text-white">Export Your Data</p>
              <p className="text-sm text-slate-400">Download a copy of all your data</p>
            </div>
            <Button
              variant="outline"
              onClick={onExportData}
              disabled={isExporting}
              className="bg-white/5 border-white/10"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-white">Delete Account</p>
                <p className="text-sm text-red-400">Permanently delete your account and all data</p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={onDeleteAccount}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
