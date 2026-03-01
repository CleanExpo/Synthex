'use client';

/**
 * Settings Page
 * User settings and preferences management
 *
 * @task UNI-416 - Settings Page Decomposition
 */

import { useState } from 'react';
import { useSettingsData, isEnterprisePlan } from '@/hooks/use-settings-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CreditCard,
  Download,
  Link2,
  Palette,
  Save,
  Settings2,
  Shield,
  User,
  Zap,
} from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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
  } = useSettingsData();

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
          <TabsTrigger value="branding" className="data-[state=active]:bg-white/10">
            <Palette className="w-4 h-4 mr-2" />
            Branding
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
            activeBusinessName={activeBusiness?.organizationName ?? null}
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

        <TabsContent value="branding" className="mt-6">
          {isEnterprisePlan(billing.plan) ? (
            <BrandingTab onSave={handleSave} isSaving={isSaving} />
          ) : (
            <Card variant="glass">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Palette className="w-12 h-12 text-slate-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      White-Label Branding
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      Customise your platform with your own logo, colours, domain, and more.
                      This feature is available on Enterprise plans.
                    </p>
                  </div>
                  <Button onClick={handleUpgrade} className="gradient-primary">
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade to Enterprise
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
