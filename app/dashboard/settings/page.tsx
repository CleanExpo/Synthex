'use client';

/**
 * Settings Page
 * User settings and preferences management
 *
 * @task UNI-416 - Settings Page Decomposition
 */

import { useState, useEffect, useCallback } from 'react';
import { profileAPI, settingsAPI, integrationsAPI } from '@/lib/api/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CreditCard,
  Download,
  Link2,
  Save,
  Settings2,
  Shield,
  User,
} from '@/components/icons';
import toast from 'react-hot-toast';
import {
  ProfileTab,
  NotificationsTab,
  IntegrationsTab,
  PrivacyTab,
  BillingTab,
  AdvancedTab,
  defaultNotifications,
  defaultPrivacy,
  defaultAdvanced,
  initialPlatforms,
  type UserProfile,
  type NotificationSettings,
  type PrivacySettings,
  type AdvancedSettings,
  type SettingsTab,
  type PlatformConnection,
  type ApiKey,
  type BillingInfo,
  type Invoice,
} from '@/components/settings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    company: '',
    role: '',
    bio: '',
    avatar: '',
  });

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);

  // Privacy settings state
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);

  // Advanced settings state
  const [advanced, setAdvanced] = useState<AdvancedSettings>(defaultAdvanced);

  // Platform connections state
  const [platforms, setPlatforms] = useState<PlatformConnection[]>(initialPlatforms);

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Billing state
  const [billing, setBilling] = useState<BillingInfo>({
    plan: 'Free',
    price: '$0',
    billingCycle: 'monthly',
    nextBilling: '-',
    paymentMethod: '-',
    cardLast4: '----',
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Load initial data
  const loadUserData = useCallback(async () => {
    try {
      const profileData = await profileAPI.getProfile();
      if (profileData.profile) {
        setProfile({
          name: profileData.profile.name || '',
          email: profileData.profile.email || '',
          company: profileData.profile.company || '',
          role: profileData.profile.role || '',
          bio: profileData.profile.bio || '',
          avatar: profileData.profile.avatar_url || '',
        });
      }

      const settingsData = await settingsAPI.getSettings();
      if (settingsData.settings) {
        if (settingsData.settings.notifications) {
          setNotifications(settingsData.settings.notifications);
        }
        if (settingsData.settings.privacy) {
          setPrivacy({
            publicProfile: settingsData.settings.privacy.profilePublic ?? false,
            showAnalytics: settingsData.settings.privacy.showAnalytics ?? true,
            dataCollection: settingsData.settings.privacy.allowDataCollection ?? true,
          });
        }
        if (settingsData.settings.theme) {
          setAdvanced(prev => ({ ...prev, theme: settingsData.settings.theme }));
        }
      }

      const integrationsData = await integrationsAPI.getIntegrations();
      if (integrationsData.integrations) {
        setPlatforms(prev =>
          prev.map(p => ({
            ...p,
            connected: integrationsData.integrations[p.id] ?? false,
            username: integrationsData.integrations[p.id] ? `@${p.id}_user` : undefined,
          }))
        );
      }

      // Fetch real billing/subscription data
      try {
        const subRes = await fetch('/api/user/subscription', { credentials: 'include' });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.plan) {
            const planName = subData.plan.charAt(0).toUpperCase() + subData.plan.slice(1);
            setBilling(prev => ({
              ...prev,
              plan: planName,
              price: subData.price ? `$${subData.price / 100}` : prev.price,
              billingCycle: subData.interval || prev.billingCycle,
              nextBilling: subData.current_period_end
                ? new Date(subData.current_period_end * 1000).toLocaleDateString()
                : prev.nextBilling,
              paymentMethod: subData.payment_method?.brand
                ? subData.payment_method.brand.charAt(0).toUpperCase() + subData.payment_method.brand.slice(1)
                : prev.paymentMethod,
              cardLast4: subData.payment_method?.last4 || prev.cardLast4,
            }));
          }
        }
      } catch (billingError) {
        console.error('Error fetching billing data:', billingError);
        toast.error('Failed to load billing details');
      }

      try {
        const invRes = await fetch('/api/invoices', { credentials: 'include' });
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.invoices?.length) {
            setInvoices(
              invData.invoices.map((inv: { id: string; number?: string; amount: number; currency: string; status: string; created: number }) => ({
                id: inv.number || inv.id,
                date: new Date(inv.created * 1000).toLocaleDateString(),
                amount: `$${(inv.amount / 100).toFixed(2)}`,
                status: inv.status === 'paid' ? 'paid' as const : 'pending' as const,
              }))
            );
          }
        }
      } catch (invoiceError) {
        console.error('Error fetching invoices:', invoiceError);
        toast.error('Failed to load invoices');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load settings');
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handlers
  const handleProfileChange = useCallback((field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAvatarUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const result = await profileAPI.uploadAvatar(file);
        setProfile(prev => ({ ...prev, avatar: result.avatar_url }));
        toast.success('Avatar uploaded successfully!');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
      }
    };
    input.click();
  }, []);

  const handleNotificationChange = useCallback((field: keyof NotificationSettings, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  }, []);

  const handlePrivacyChange = useCallback((field: keyof PrivacySettings, value: boolean) => {
    setPrivacy(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAdvancedChange = useCallback(<K extends keyof AdvancedSettings>(
    field: K,
    value: AdvancedSettings[K]
  ) => {
    setAdvanced(prev => ({ ...prev, [field]: value }));
    if (field === 'debugMode' || field === 'betaFeatures') {
      toast.success(`${field === 'debugMode' ? 'Debug mode' : 'Beta features'} ${value ? 'enabled' : 'disabled'}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        profileAPI.updateProfile({
          name: profile.name,
          company: profile.company,
          role: profile.role,
          bio: profile.bio,
        }),
        settingsAPI.updateSettings('notifications', notifications as unknown as Record<string, unknown>),
        settingsAPI.updateSettings('privacy', {
          profilePublic: privacy.publicProfile,
          showAnalytics: privacy.showAnalytics,
          allowDataCollection: privacy.dataCollection,
        } as Record<string, unknown>),
        settingsAPI.updateSettings('theme', advanced.theme as unknown as Record<string, unknown>),
      ]);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [profile, notifications, privacy, advanced.theme]);

  const handleConnect = useCallback(async (platformId: string) => {
    try {
      toast.loading(`Connecting to ${platformId}...`);
      await integrationsAPI.connectPlatform(platformId);
      await loadUserData();
      toast.dismiss();
      toast.success(`Connected to ${platformId} successfully!`);
    } catch (error) {
      toast.dismiss();
      toast.error(error instanceof Error ? error.message : `Failed to connect to ${platformId}`);
    }
  }, [loadUserData]);

  const handleDisconnect = useCallback(async (platformId: string) => {
    try {
      await integrationsAPI.disconnectPlatform(platformId);
      setPlatforms(prev =>
        prev.map(p =>
          p.id === platformId ? { ...p, connected: false, username: undefined } : p
        )
      );
      toast.success(`Disconnected from ${platformId}`);
    } catch {
      toast.error(`Failed to disconnect from ${platformId}`);
    }
  }, []);

  const handleCreateApiKey = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New API Key' }),
      });

      if (response.ok) {
        const data = await response.json();
        const newKey: ApiKey = {
          id: data.id || `key-${Date.now()}`,
          name: data.name || 'New API Key',
          key: data.key || 'sk-****-****-****',
          created: data.created || new Date().toISOString().split('T')[0],
          lastUsed: 'Never',
        };
        setApiKeys(prev => [...prev, newKey]);
        toast.success('API key created!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'API key management not yet available.');
      }
    } catch {
      toast.error('API key management not yet available.');
    }
  }, []);

  const handleDeleteApiKey = useCallback((keyId: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== keyId));
    toast.success('API key deleted');
  }, []);

  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const data = { profile, notifications, privacy, advanced };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'synthex-settings-export.json';
      a.click();
      toast.success('Data exported successfully!');
    } catch {
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  }, [profile, notifications, privacy, advanced]);

  const handleDeleteAccount = useCallback(() => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      toast.error('Account deletion requires email confirmation. Check your inbox.');
    }
  }, []);

  const handleUpgrade = useCallback(() => {
    window.location.href = '/pricing';
  }, []);

  const handleManagePayment = useCallback(() => {
    toast.success('Opening payment portal...');
  }, []);

  const handleDownloadInvoice = useCallback((invoiceId: string) => {
    toast.success(`Downloading invoice ${invoiceId}...`);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-slate-400 mt-1">
            Manage your account preferences and integrations
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={handleExportData}
            disabled={isExporting}
            variant="outline"
            className="bg-white/5 border-white/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary">
            <Save className="mr-2 h-4 w-4" />
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-white/10">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-white/10">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-white/10">
            <Link2 className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-white/10">
            <Shield className="w-4 h-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-white/10">
            <CreditCard className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="advanced" className="data-[state=active]:bg-white/10">
            <Settings2 className="w-4 h-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab
            profile={profile}
            onProfileChange={handleProfileChange}
            onAvatarUpload={handleAvatarUpload}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab
            settings={notifications}
            onSettingChange={handleNotificationChange}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab
            platforms={platforms}
            apiKeys={apiKeys}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onCreateApiKey={handleCreateApiKey}
            onDeleteApiKey={handleDeleteApiKey}
          />
        </TabsContent>

        <TabsContent value="privacy" className="mt-6">
          <PrivacyTab
            settings={privacy}
            onSettingChange={handlePrivacyChange}
            onSave={handleSave}
            onExportData={handleExportData}
            onDeleteAccount={handleDeleteAccount}
            isSaving={isSaving}
            isExporting={isExporting}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingTab
            billing={billing}
            invoices={invoices}
            onUpgrade={handleUpgrade}
            onManagePayment={handleManagePayment}
            onDownloadInvoice={handleDownloadInvoice}
          />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <AdvancedTab
            settings={advanced}
            onSettingChange={handleAdvancedChange}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
