'use client';

/**
 * Advanced Tab Component
 * Theme, language, timezone, and developer settings
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, Beaker, Globe, Loader2, Moon, Save } from '@/components/icons';
import { languages, timezones, themes } from './settings-config';
import type { AdvancedSettings } from './types';

interface AdvancedTabProps {
  settings: AdvancedSettings;
  onSettingChange: <K extends keyof AdvancedSettings>(field: K, value: AdvancedSettings[K]) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function AdvancedTab({
  settings,
  onSettingChange,
  onSave,
  isSaving,
}: AdvancedTabProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
        <CardDescription>Customize your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Appearance */}
        <div>
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Moon className="w-4 h-4" />
            Appearance
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) => onSettingChange('theme', value as AdvancedSettings['theme'])}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Localization */}
        <div>
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Localization
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={settings.language}
                onValueChange={(value) => onSettingChange('language', value)}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => onSettingChange('timezone', value)}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Developer Options */}
        <div>
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Developer Options
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Debug Mode</Label>
                <p className="text-sm text-slate-400">Show detailed error messages and logs</p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => onSettingChange('debugMode', checked)}
                aria-label="Debug mode"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-cyan-500" />
                <div>
                  <Label className="text-white">Beta Features</Label>
                  <p className="text-sm text-slate-400">Try experimental features early</p>
                </div>
              </div>
              <Switch
                checked={settings.betaFeatures}
                onCheckedChange={(checked) => onSettingChange('betaFeatures', checked)}
                aria-label="Beta features"
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
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
