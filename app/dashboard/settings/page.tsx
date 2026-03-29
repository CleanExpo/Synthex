'use client';

/**
 * Settings Page
 * User settings and preferences management
 *
 * @task UNI-416 - Settings Page Decomposition
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSettingsData, isEnterprisePlan } from '@/hooks/use-settings-data';
import {
  Bell,
  Building,
  ChevronRight,
  CreditCard,
  Download,
  Link2,
  Palette,
  Save,
  Settings2,
  Shield,
  Sparkles,
  User,
  Zap,
} from '@/components/icons';
import {
  ProfileTab,
  NotificationsTab,
  IntegrationsTab,
  PrivacyTab,
  BillingTab,
  BrandingTab,
  AdvancedTab,
  type SettingsTab,
} from '@/components/settings';
import { cn } from '@/lib/utils';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'profile';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const {
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
    handleChangePassword,
  } = useSettingsData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
              Account
            </span>
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
              Settings
            </h1>
            <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
              Manage your account preferences and integrations
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 border-[0.5px] border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] rounded-sm text-xs text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export Data
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-[#050508] text-xs font-semibold tracking-wide rounded-sm transition-colors disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="mt-5 h-px bg-white/[0.06]" />
      </div>

      {/* Tab bar */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-1 flex flex-wrap gap-0.5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs rounded-sm transition-colors whitespace-nowrap',
              activeTab === id
                ? 'bg-white/[0.08] text-white border-[0.5px] border-white/[0.1]'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <ProfileTab
              profile={profile}
              onProfileChange={handleProfileChange}
              onAvatarUpload={handleAvatarUpload}
              onSave={handleSave}
              isSaving={isSaving}
              onChangePassword={handleChangePassword}
            />
            {/* Brand quick-links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/dashboard/settings/brand-profile">
                <div className="flex items-center justify-between py-4 px-5 border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] rounded-sm transition-colors cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-amber-500/70" />
                    <div>
                      <p className="text-sm font-light text-white">
                        Brand Profile
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Logo, colours, website, and social handles
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 flex-shrink-0" />
                </div>
              </Link>
              <Link href="/dashboard/settings/brand-setup">
                <div className="flex items-center justify-between py-4 px-5 border-[0.5px] border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/[0.06] hover:border-amber-500/30 rounded-sm transition-colors cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-light text-white">
                        Brand Setup Wizard
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Guided onboarding with AI BrandDNA
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 flex-shrink-0" />
                </div>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            settings={notifications}
            onSettingChange={handleNotificationChange}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsTab
            platforms={platforms}
            apiKeys={apiKeys}
            activeBusinessName={activeBusiness?.organizationName ?? null}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onCreateApiKey={handleCreateApiKey}
            onDeleteApiKey={handleDeleteApiKey}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacyTab
            settings={privacy}
            onSettingChange={handlePrivacyChange}
            onSave={handleSave}
            onExportData={handleExportData}
            onDeleteAccount={handleDeleteAccount}
            isSaving={isSaving}
            isExporting={isExporting}
          />
        )}

        {activeTab === 'billing' && (
          <BillingTab
            billing={billing}
            invoices={invoices}
            onUpgrade={handleUpgrade}
            onManagePayment={handleManagePayment}
            onDownloadInvoice={handleDownloadInvoice}
          />
        )}

        {activeTab === 'branding' &&
          (isEnterprisePlan(billing.plan) ? (
            <BrandingTab onSave={handleSave} isSaving={isSaving} />
          ) : (
            <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
              <div className="py-16 px-8 text-center space-y-5">
                <div className="w-12 h-12 border-[0.5px] border-white/[0.08] bg-white/[0.02] rounded-sm flex items-center justify-center mx-auto">
                  <Palette className="w-5 h-5 text-white/50" />
                </div>
                <div>
                  <h2 className="text-lg font-light text-white mb-1">
                    White-Label Branding
                  </h2>
                  <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                    Customise your platform with your own logo, colours, domain,
                    and more. This feature is available on Enterprise plans.
                  </p>
                </div>
                <button
                  onClick={handleUpgrade}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-[#050508] text-xs font-semibold tracking-wide rounded-sm transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade to Enterprise
                </button>
              </div>
            </div>
          ))}

        {activeTab === 'advanced' && (
          <AdvancedTab
            settings={advanced}
            onSettingChange={handleAdvancedChange}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}
