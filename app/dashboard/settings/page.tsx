'use client';

import { useState, useEffect, useCallback } from 'react';
import { profileAPI, settingsAPI, integrationsAPI, billingAPI } from '@/lib/api/settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Key,
  Globe,
  Palette,
  Zap,
  Users,
  Settings2,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  Lock,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Loader2,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Link2,
  Unlink,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  Camera,
} from '@/components/icons';
import toast from 'react-hot-toast';

const defaultNotifications = {
  email: true,
  push: false,
  sms: false,
  weeklyReport: true,
  viralAlert: true,
  systemUpdates: false,
};

const defaultPrivacy = {
  profilePublic: false,
  showAnalytics: true,
  allowDataCollection: true,
};

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    bio: '',
    avatar_url: '',
  });
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [integrations, setIntegrations] = useState({
    twitter: false,
    linkedin: false,
    instagram: false,
    facebook: false,
    tiktok: false,
  });

  // Load initial data
  const loadUserData = useCallback(async () => {
    try {
      // Load profile
      const profileData = await profileAPI.getProfile();
      if (profileData.profile) {
        setProfile(profileData.profile);
      }

      // Load settings
      const settingsData = await settingsAPI.getSettings();
      if (settingsData.settings) {
        setNotifications(settingsData.settings.notifications || defaultNotifications);
        setPrivacy(settingsData.settings.privacy || defaultPrivacy);
        setTheme(settingsData.settings.theme || 'dark');
      }

      // Load integrations
      const integrationsData = await integrationsAPI.getIntegrations();
      if (integrationsData.integrations) {
        setIntegrations(integrationsData.integrations);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load settings');
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleSave = async (section: string) => {
    setIsLoading(true);
    try {
      switch (section) {
        case 'Profile':
          await profileAPI.updateProfile(profile);
          break;
        case 'Notifications':
          await settingsAPI.updateSettings('notifications', notifications);
          break;
        case 'Privacy':
          await settingsAPI.updateSettings('privacy', privacy);
          break;
        case 'Advanced':
          await settingsAPI.updateSettings('theme', theme);
          break;
      }
      toast.success(`${section} settings saved successfully!`);
    } catch (error) {
      console.error(`Error saving ${section}:`, error);
      toast.error(`Failed to save ${section.toLowerCase()} settings`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const result = await profileAPI.uploadAvatar(file);
      setProfile(prev => ({ ...prev, avatar_url: result.avatar_url }));
      toast.success('Avatar uploaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConnect = async (platform: string) => {
    try {
      toast.loading(`Connecting to ${platform}...`);
      await integrationsAPI.connectPlatform(platform.toLowerCase());
      await loadUserData(); // Reload integrations
      toast.success(`Connected to ${platform} successfully!`);
    } catch (error: any) {
      toast.error(error.message || `Failed to connect to ${platform}`);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await integrationsAPI.disconnectPlatform(platform.toLowerCase());
      setIntegrations(prev => ({ ...prev, [platform.toLowerCase()]: false }));
      toast.success(`Disconnected from ${platform}`);
    } catch (error) {
      toast.error(`Failed to disconnect from ${platform}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-gray-400 mt-1">
            Manage your account preferences and integrations
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button className="gradient-primary text-white">
            <Save className="mr-2 h-4 w-4" />
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-white/10">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-white/10">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-white/10">
            <Link2 className="mr-2 h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-white/10">
            <Shield className="mr-2 h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-white/10">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="advanced" className="data-[state=active]:bg-white/10">
            <Settings2 className="mr-2 h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription className="text-gray-400">
                Update your personal information and profile settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center space-x-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <label htmlFor="avatar-upload">
                    <Button
                      variant="outline"
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      disabled={uploadingAvatar}
                      asChild
                    >
                      <span>
                        {uploadingAvatar ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                        ) : (
                          <><Camera className="mr-2 h-4 w-4" />Change Avatar</>
                        )}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-gray-400">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-gray-400">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="company" className="text-gray-400">Company</Label>
                  <Input
                    id="company"
                    value={profile.company}
                    onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-gray-400">Role</Label>
                  <Input
                    id="role"
                    value={profile.role}
                    onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="bio" className="text-gray-400">Bio</Label>
                  <textarea
                    id="bio"
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white mt-1"
                    value={profile.bio}
                    onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSave('Profile')}
                  disabled={isLoading}
                  className="gradient-primary text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription className="text-gray-400">
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notification Channels */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Channels</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-white">Email Notifications</p>
                        <p className="text-sm text-gray-400">Receive notifications via email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, email: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Monitor className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-white">Push Notifications</p>
                        <p className="text-sm text-gray-400">Browser push notifications</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, push: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-white">SMS Notifications</p>
                        <p className="text-sm text-gray-400">Text message alerts</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, sms: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Alert Types</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">Weekly Performance Report</p>
                      <p className="text-sm text-gray-400">Summary of your weekly metrics</p>
                    </div>
                    <Switch
                      checked={notifications.weeklyReport}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, weeklyReport: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">Viral Content Alert</p>
                      <p className="text-sm text-gray-400">When your content goes viral</p>
                    </div>
                    <Switch
                      checked={notifications.viralAlert}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, viralAlert: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">System Updates</p>
                      <p className="text-sm text-gray-400">Platform updates and maintenance</p>
                    </div>
                    <Switch
                      checked={notifications.systemUpdates}
                      onCheckedChange={(checked) =>
                        setNotifications(prev => ({ ...prev, systemUpdates: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSave('Notifications')}
                  disabled={isLoading}
                  className="gradient-primary text-white"
                >
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Platform Integrations</CardTitle>
              <CardDescription className="text-gray-400">
                Connect your social media accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform Connections */}
              {[
                { key: 'twitter', name: 'Twitter', icon: Twitter, color: 'text-blue-400' },
                { key: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
                { key: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
                { key: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500' },
                { key: 'tiktok', name: 'TikTok', icon: Video, color: 'text-gray-300' },
              ].map((platform) => (
                <div
                  key={platform.key}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <platform.icon className={`h-6 w-6 ${platform.color}`} />
                    <div>
                      <p className="text-white font-medium">{platform.name}</p>
                      {integrations[platform.key as keyof typeof integrations] ? (
                        <p className="text-sm text-green-400 flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">Not connected</p>
                      )}
                    </div>
                  </div>
                  {integrations[platform.key as keyof typeof integrations] ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(platform.name)}
                      className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(platform.name)}
                      className="gradient-primary text-white"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription className="text-gray-400">
                Manage your API keys and webhooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="api-key" className="text-gray-400">API Key</Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="api-key"
                    type="password"
                    value="sk-proj-xxxxxxxxxxxxxxxxxxxx"
                    readOnly
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="webhook" className="text-gray-400">Webhook URL</Label>
                <Input
                  id="webhook"
                  type="url"
                  placeholder="https://your-domain.com/webhook"
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Control your data and privacy preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Public Profile</p>
                    <p className="text-sm text-gray-400">Make your profile visible to others</p>
                  </div>
                  <Switch
                    checked={privacy.profilePublic}
                    onCheckedChange={(checked) =>
                      setPrivacy(prev => ({ ...prev, profilePublic: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Show Analytics</p>
                    <p className="text-sm text-gray-400">Display performance metrics publicly</p>
                  </div>
                  <Switch
                    checked={privacy.showAnalytics}
                    onCheckedChange={(checked) =>
                      setPrivacy(prev => ({ ...prev, showAnalytics: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Data Collection</p>
                    <p className="text-sm text-gray-400">Allow anonymous usage analytics</p>
                  </div>
                  <Switch
                    checked={privacy.allowDataCollection}
                    onCheckedChange={(checked) =>
                      setPrivacy(prev => ({ ...prev, allowDataCollection: checked }))
                    }
                  />
                </div>
              </div>

              {/* Data Management */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10">
                    <Download className="mr-2 h-4 w-4" />
                    Download My Data
                  </Button>
                  <Button variant="outline" className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete My Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Subscription & Billing</CardTitle>
              <CardDescription className="text-gray-400">
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Plan */}
              <div className="p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Pro Plan</h3>
                    <p className="text-gray-400">$49/month</p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-400" />
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-300 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                    Unlimited AI content generation
                  </p>
                  <p className="text-sm text-gray-300 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                    Advanced analytics & insights
                  </p>
                  <p className="text-sm text-gray-300 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                    Priority support
                  </p>
                </div>
                <Button className="w-full gradient-primary text-white">
                  Upgrade Plan
                </Button>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-white">•••• •••• •••• 4242</p>
                        <p className="text-sm text-gray-400">Expires 12/25</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-gray-400">
                      Edit
                    </Button>
                  </div>
                </div>
              </div>

              {/* Billing History */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Recent Invoices</h3>
                <div className="space-y-2">
                  {[
                    { date: 'Nov 1, 2024', amount: '$49.00', status: 'Paid' },
                    { date: 'Oct 1, 2024', amount: '$49.00', status: 'Paid' },
                    { date: 'Sep 1, 2024', amount: '$49.00', status: 'Paid' },
                  ].map((invoice, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="text-white">{invoice.date}</p>
                        <p className="text-sm text-gray-400">{invoice.amount}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-green-400">{invoice.status}</span>
                        <Button size="sm" variant="ghost" className="text-gray-400">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Developer options and advanced configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme */}
              <div>
                <Label className="text-gray-400">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center">
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center">
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center">
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div>
                <Label className="text-gray-400">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time Zone */}
              <div>
                <Label className="text-gray-400">Time Zone</Label>
                <Select defaultValue="utc-5">
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc-8">Pacific Time (UTC-8)</SelectItem>
                    <SelectItem value="utc-5">Eastern Time (UTC-5)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="utc+1">Central European Time (UTC+1)</SelectItem>
                    <SelectItem value="utc+9">Japan Standard Time (UTC+9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Developer Options */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Developer Options</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">Debug Mode</p>
                      <p className="text-sm text-gray-400">Show detailed error messages</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white">Beta Features</p>
                      <p className="text-sm text-gray-400">Access experimental features</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => handleSave('Advanced')}
                  disabled={isLoading}
                  className="gradient-primary text-white"
                >
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
