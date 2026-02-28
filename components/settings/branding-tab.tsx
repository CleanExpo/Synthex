'use client';

/**
 * Branding Tab Component
 * White-label branding configuration for enterprise tenants
 *
 * @task UNI-683 - White-label UI tenant branding system
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Globe,
  Link2,
  Loader2,
  Palette,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from '@/components/icons';
import { toast } from 'sonner';

interface FooterLink {
  label: string;
  url: string;
}

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  companyName: string;
  customDomain: string;
  customCss: string;
  footerLinks: FooterLink[];
}

const DEFAULT_CONFIG: BrandingConfig = {
  primaryColor: '#6366f1',
  secondaryColor: '#06b6d4',
  logoUrl: '',
  faviconUrl: '',
  companyName: '',
  customDomain: '',
  customCss: '',
  footerLinks: [],
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

interface BrandingTabProps {
  onSave?: () => void;
  isSaving?: boolean;
}

export function BrandingTab({ onSave, isSaving: externalSaving }: BrandingTabProps) {
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BrandingConfig, string>>>({});

  // Load current branding config
  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/white-label/config', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load branding config');
      }

      const data = await response.json();
      if (data.theme) {
        setConfig({
          primaryColor: data.theme.primaryColor || DEFAULT_CONFIG.primaryColor,
          secondaryColor: data.theme.secondaryColor || DEFAULT_CONFIG.secondaryColor,
          logoUrl: data.theme.logoUrl || '',
          faviconUrl: data.theme.faviconUrl || '',
          companyName: data.theme.companyName || '',
          customDomain: data.theme.customDomain || '',
          customCss: data.theme.customCss || '',
          footerLinks: data.theme.footerLinks || [],
        });
      }
    } catch (error) {
      console.error('Error loading branding config:', error);
      toast.error('Failed to load branding configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Field change handler
  const handleChange = useCallback(
    (field: keyof BrandingConfig, value: string) => {
      setConfig((prev) => ({ ...prev, [field]: value }));

      // Clear error on change
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  // Validate config before saving
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof BrandingConfig, string>> = {};

    if (config.primaryColor && !HEX_COLOR_REGEX.test(config.primaryColor)) {
      newErrors.primaryColor = 'Must be a valid hex colour (e.g. #6366f1)';
    }
    if (config.secondaryColor && !HEX_COLOR_REGEX.test(config.secondaryColor)) {
      newErrors.secondaryColor = 'Must be a valid hex colour (e.g. #06b6d4)';
    }
    if (config.companyName && config.companyName.length > 100) {
      newErrors.companyName = 'Company name must be 100 characters or fewer';
    }
    if (config.customCss && config.customCss.length > 10000) {
      newErrors.customCss = 'Custom CSS must be 10,000 characters or fewer';
    }
    if (config.logoUrl && !isValidUrl(config.logoUrl)) {
      newErrors.logoUrl = 'Must be a valid URL';
    }
    if (config.faviconUrl && !isValidUrl(config.faviconUrl)) {
      newErrors.faviconUrl = 'Must be a valid URL';
    }

    // Validate footer links
    for (let i = 0; i < config.footerLinks.length; i++) {
      const link = config.footerLinks[i];
      if (!link.label.trim()) {
        newErrors.footerLinks = `Footer link ${i + 1} must have a label`;
        break;
      }
      if (link.label.length > 50) {
        newErrors.footerLinks = `Footer link "${link.label}" label must be 50 characters or fewer`;
        break;
      }
      if (!isValidUrl(link.url)) {
        newErrors.footerLinks = `Footer link "${link.label}" must have a valid URL`;
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [config]);

  // Save branding config
  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (config.primaryColor) payload.primaryColor = config.primaryColor;
      if (config.secondaryColor) payload.secondaryColor = config.secondaryColor;
      if (config.logoUrl) payload.logoUrl = config.logoUrl;
      if (config.faviconUrl) payload.faviconUrl = config.faviconUrl;
      if (config.companyName) payload.companyName = config.companyName;
      if (config.customDomain) payload.customDomain = config.customDomain;
      if (config.customCss) payload.customCss = config.customCss;
      if (config.footerLinks.length > 0) payload.footerLinks = config.footerLinks;

      const response = await fetch('/api/white-label/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save branding config');
      }

      toast.success('Branding configuration saved successfully!');
      onSave?.();
    } catch (error) {
      console.error('Error saving branding config:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save branding configuration'
      );
    } finally {
      setIsSaving(false);
    }
  }, [config, validate, onSave]);

  // Footer link handlers
  const addFooterLink = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      footerLinks: [...prev.footerLinks, { label: '', url: '' }],
    }));
  }, []);

  const removeFooterLink = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      footerLinks: prev.footerLinks.filter((_, i) => i !== index),
    }));
    // Clear footer link errors
    setErrors((prev) => {
      const next = { ...prev };
      delete next.footerLinks;
      return next;
    });
  }, []);

  const updateFooterLink = useCallback(
    (index: number, field: keyof FooterLink, value: string) => {
      setConfig((prev) => ({
        ...prev,
        footerLinks: prev.footerLinks.map((link, i) =>
          i === index ? { ...link, [field]: value } : link
        ),
      }));
      // Clear footer link errors on edit
      setErrors((prev) => {
        const next = { ...prev };
        delete next.footerLinks;
        return next;
      });
    },
    []
  );

  const saving = externalSaving || isSaving;

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-slate-400">Loading branding configuration...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Identity */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-cyan-400" />
            Brand Identity
          </CardTitle>
          <CardDescription>
            Configure your organisation&apos;s logo, colours, and identity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={config.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="Your Company Name"
              maxLength={100}
              className="bg-white/5 border-white/10"
            />
            {errors.companyName && (
              <p className="text-sm text-red-400">{errors.companyName}</p>
            )}
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <div className="flex gap-3">
              <Input
                id="logoUrl"
                value={config.logoUrl}
                onChange={(e) => handleChange('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="bg-white/5 border-white/10 flex-1"
              />
              {config.logoUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange('logoUrl', '')}
                  className="bg-white/5 border-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {errors.logoUrl && (
              <p className="text-sm text-red-400">{errors.logoUrl}</p>
            )}
            <p className="text-xs text-slate-500">
              Enter the URL of your company logo. Recommended: PNG or SVG, at least 200x50px.
            </p>
          </div>

          {/* Favicon URL */}
          <div className="space-y-2">
            <Label htmlFor="faviconUrl">Favicon URL</Label>
            <div className="flex gap-3">
              <Input
                id="faviconUrl"
                value={config.faviconUrl}
                onChange={(e) => handleChange('faviconUrl', e.target.value)}
                placeholder="https://example.com/favicon.ico"
                className="bg-white/5 border-white/10 flex-1"
              />
              {config.faviconUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange('faviconUrl', '')}
                  className="bg-white/5 border-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {errors.faviconUrl && (
              <p className="text-sm text-red-400">{errors.faviconUrl}</p>
            )}
            <p className="text-xs text-slate-500">
              Enter the URL of your favicon. Recommended: ICO or PNG, 32x32px.
            </p>
          </div>

          {/* Colours */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Colour</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded-md border border-white/10 bg-transparent cursor-pointer"
                />
                <Input
                  id="primaryColor"
                  value={config.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  placeholder="#6366f1"
                  className="bg-white/5 border-white/10 flex-1 font-mono"
                />
              </div>
              {errors.primaryColor && (
                <p className="text-sm text-red-400">{errors.primaryColor}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Colour</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={config.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded-md border border-white/10 bg-transparent cursor-pointer"
                />
                <Input
                  id="secondaryColor"
                  value={config.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  placeholder="#06b6d4"
                  className="bg-white/5 border-white/10 flex-1 font-mono"
                />
              </div>
              {errors.secondaryColor && (
                <p className="text-sm text-red-400">{errors.secondaryColor}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Custom Domain
          </CardTitle>
          <CardDescription>
            Configure a custom domain for your white-label instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customDomain">Domain</Label>
            <Input
              id="customDomain"
              value={config.customDomain}
              onChange={(e) => handleChange('customDomain', e.target.value)}
              placeholder="app.yourdomain.com"
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-slate-500">
              Enter your custom domain. You will need to configure DNS records separately.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Links */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-cyan-400" />
              Footer Links
            </CardTitle>
            <CardDescription>
              Add custom links to your application footer
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addFooterLink}
            className="bg-white/5 border-white/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.footerLinks.length === 0 ? (
            <div className="text-center py-6">
              <Link2 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                No footer links configured. Click &quot;Add Link&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {config.footerLinks.map((link, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-start p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex-1 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Label</Label>
                      <Input
                        value={link.label}
                        onChange={(e) =>
                          updateFooterLink(index, 'label', e.target.value)
                        }
                        placeholder="Link text"
                        maxLength={50}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">URL</Label>
                      <Input
                        value={link.url}
                        onChange={(e) =>
                          updateFooterLink(index, 'url', e.target.value)
                        }
                        placeholder="https://example.com"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFooterLink(index)}
                    className="text-slate-400 hover:text-red-400 mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {errors.footerLinks && (
            <p className="text-sm text-red-400">{errors.footerLinks}</p>
          )}
        </CardContent>
      </Card>

      {/* Custom CSS */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Custom CSS
          </CardTitle>
          <CardDescription>
            Add custom CSS to further customise your branding (max 10,000 characters)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={config.customCss}
              onChange={(e) => handleChange('customCss', e.target.value)}
              placeholder={`/* Custom CSS overrides */\n.header {\n  background: var(--brand-primary);\n}`}
              className="bg-white/5 border-white/10 min-h-[160px] font-mono text-sm"
              maxLength={10000}
            />
            <div className="flex justify-between items-center">
              {errors.customCss && (
                <p className="text-sm text-red-400">{errors.customCss}</p>
              )}
              <p className="text-xs text-slate-500 ml-auto">
                {config.customCss.length.toLocaleString()} / 10,000 characters
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            See how your branding will look in the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border border-white/10 overflow-hidden"
            style={{ background: '#0f172a' }}
          >
            {/* Preview Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-white/10"
              style={{ background: config.primaryColor + '20' }}
            >
              <div className="flex items-center gap-3">
                {config.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={config.logoUrl}
                    alt="Logo preview"
                    className="h-8 w-auto max-w-[120px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: config.primaryColor }}
                  >
                    {(config.companyName || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white font-semibold text-sm">
                  {config.companyName || 'Your Company'}
                </span>
              </div>
              <div className="flex gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: config.primaryColor }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: config.secondaryColor }}
                />
              </div>
            </div>

            {/* Preview Body */}
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div
                  className="px-3 py-1.5 rounded-md text-white text-xs font-medium"
                  style={{ background: config.primaryColor }}
                >
                  Primary Button
                </div>
                <div
                  className="px-3 py-1.5 rounded-md text-white text-xs font-medium"
                  style={{ background: config.secondaryColor }}
                >
                  Secondary Button
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: config.primaryColor }}
                />
                <span className="text-slate-300 text-xs">
                  Accent elements use your brand colours
                </span>
              </div>
              <div
                className="h-1 rounded-full w-2/3"
                style={{
                  background: `linear-gradient(to right, ${config.primaryColor}, ${config.secondaryColor})`,
                }}
              />
            </div>

            {/* Preview Footer */}
            {config.footerLinks.length > 0 && (
              <div className="px-4 py-2 border-t border-white/10 flex gap-4">
                {config.footerLinks.map((link, i) => (
                  <span
                    key={i}
                    className="text-xs hover:underline"
                    style={{ color: config.secondaryColor }}
                  >
                    {link.label || `Link ${i + 1}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gradient-primary"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Branding
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Utility
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
