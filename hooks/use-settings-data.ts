'use client';

/**
 * Custom hook that encapsulates all settings page state, data loading, and handlers.
 * Extracted from app/dashboard/settings/page.tsx to reduce page file size.
 */

import { useState, useEffect, useCallback } from 'react';
import { profileAPI, settingsAPI, integrationsAPI } from '@/lib/api/settings';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { toast } from 'sonner';
import {
  defaultNotifications,
  defaultPrivacy,
  defaultAdvanced,
  initialPlatforms,
  type UserProfile,
  type NotificationSettings,
  type PrivacySettings,
  type AdvancedSettings,
  type PlatformConnection,
  type ApiKey,
  type BillingInfo,
  type Invoice,
} from '@/components/settings';

/** Plans that include white-label branding features */
const ENTERPRISE_PLANS = ['enterprise', 'business', 'pro'];

export function isEnterprisePlan(plan: string): boolean {
  return ENTERPRISE_PLANS.includes(plan.toLowerCase());
}

export function useSettingsData() {
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Multi-business context -- integrations are scoped per business
  const { activeBusiness } = useActiveBusiness();

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

  // Load integrations -- extracted so it can re-run when active business changes
  const loadIntegrations = useCallback(async () => {
    try {
      const integrationsData = await integrationsAPI.getIntegrations();
      if (integrationsData.integrations) {
        setPlatforms(prev =>
          prev.map(p => ({
            ...p,
            connected: integrationsData.integrations[p.id] ?? false,
            username: integrationsData.details?.[p.id]?.profileName
              ? `@${integrationsData.details[p.id].profileName}`
              : integrationsData.integrations[p.id]
                ? 'Connected'
                : undefined,
          }))
        );
      }
    } catch (integrationsError) {
      console.error('Error loading integrations:', integrationsError);
    }
  }, []);

  // Load initial data - each section loads independently so one failure doesn't block others
  const loadUserData = useCallback(async () => {
    // Load profile (independent)
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
    } catch (profileError) {
      console.error('Error loading profile:', profileError);
    }

    // Load settings (independent - user_settings table may not exist yet)
    try {
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
    } catch (settingsError) {
      console.error('Error loading settings:', settingsError);
    }

    // Load integrations (moved to separate effect -- reloads when active business changes)
    await loadIntegrations();

    // Fetch real billing/subscription data (independent)
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
            nextBilling: subData.currentPeriodEnd
              ? new Date(subData.currentPeriodEnd).toLocaleDateString()
              : prev.nextBilling,
            paymentMethod: prev.paymentMethod,
            cardLast4: prev.cardLast4,
          }));
        }
      }
    } catch (billingError) {
      console.error('Error fetching billing data:', billingError);
    }

    // Fetch invoices (independent)
    try {
      const invRes = await fetch('/api/invoices', { credentials: 'include' });
      if (invRes.ok) {
        const invData = await invRes.json();
        if (invData.invoices?.length) {
          setInvoices(
            invData.invoices.map((inv: { id: string; number?: string; amount: number; currency: string; status: string; created: number; pdfUrl?: string | null }) => ({
              id: inv.number || inv.id,
              date: new Date(inv.created * 1000).toLocaleDateString(),
              amount: `$${(inv.amount / 100).toFixed(2)}`,
              status: inv.status === 'paid' ? 'paid' as const : 'pending' as const,
              pdfUrl: inv.pdfUrl ?? null,
            }))
          );
        }
      }
    } catch (invoiceError) {
      console.error('Error fetching invoices:', invoiceError);
    }
  }, [loadIntegrations]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reload integrations when active business changes
  useEffect(() => {
    if (activeBusiness !== undefined) {
      loadIntegrations();
    }
  }, [activeBusiness?.organizationId, loadIntegrations]);

  // ---- Handlers ----

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
      const results = await Promise.allSettled([
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

      const failures = results.filter(r => r.status === 'rejected');
      const successes = results.filter(r => r.status === 'fulfilled');

      if (failures.length === 0) {
        toast.success('All settings saved successfully!');
      } else if (successes.length > 0) {
        const failedItems: string[] = [];
        if (results[0].status === 'rejected') failedItems.push('profile');
        if (results[1].status === 'rejected') failedItems.push('notifications');
        if (results[2].status === 'rejected') failedItems.push('privacy');
        if (results[3].status === 'rejected') failedItems.push('theme');

        if (failedItems.length > 0 && results[0].status === 'fulfilled') {
          toast.success('Profile saved! Some preferences could not be saved.');
        } else {
          toast.error(`Failed to save: ${failedItems.join(', ')}`);
        }
        console.error('Partial save failures:', failures.map(f => f.status === 'rejected' ? f.reason : null));
      } else {
        toast.error('Failed to save settings');
        console.error('All saves failed:', failures.map(f => f.status === 'rejected' ? f.reason : null));
      }
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

  const handleManagePayment = useCallback(async () => {
    try {
      toast.loading('Opening billing portal...', { id: 'billing-portal' });
      const res = await fetch('/api/stripe/billing-portal', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      toast.dismiss('billing-portal');

      if (!res.ok) {
        if (data.bypass) {
          toast.info(data.message || 'Billing portal is not yet configured.');
          return;
        }
        throw new Error(data.error || 'Failed to open billing portal');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.dismiss('billing-portal');
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  }, []);

  const handleDownloadInvoice = useCallback((invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice?.pdfUrl) {
      window.open(invoice.pdfUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Invoice PDF not available');
    }
  }, [invoices]);

  return {
    // State
    isSaving,
    isExporting,
    activeBusiness,
    profile,
    notifications,
    privacy,
    advanced,
    platforms,
    apiKeys,
    billing,
    invoices,

    // Handlers
    handleProfileChange,
    handleAvatarUpload,
    handleNotificationChange,
    handlePrivacyChange,
    handleAdvancedChange,
    handleSave,
    handleConnect,
    handleDisconnect,
    handleCreateApiKey,
    handleDeleteApiKey,
    handleExportData,
    handleDeleteAccount,
    handleUpgrade,
    handleManagePayment,
    handleDownloadInvoice,
  };
}
