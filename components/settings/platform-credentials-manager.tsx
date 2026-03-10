'use client';

/**
 * Platform Credentials Manager
 *
 * Owner-only component for managing OAuth Client ID / Client Secret
 * pairs for all 9 social platforms. Follows the same design pattern
 * as AICredentialsManager.
 *
 * The component self-gates: it calls GET /api/admin/platform-credentials
 * on mount. If the API returns 403 the component renders nothing.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Trash2,
  Globe,
  Search,
  BarChart2,
  HardDrive,
} from '@/components/icons';
import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  TikTok,
  Youtube,
  Pinterest,
  Reddit,
  Threads,
} from '@/components/icons/social';
import { toast } from 'sonner';
import type { ComponentType, SVGProps } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformCredential {
  id: string;
  platform: string;
  maskedClientId: string;
  createdAt: string;
  updatedAt: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; className?: string }>;
  color: string;
  bgColor: string;
  devPortalUrl: string;
  devPortalLabel: string;
}

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'twitter',
    name: 'X (Twitter)',
    Icon: Twitter as PlatformConfig['Icon'],
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/20',
    devPortalUrl: 'https://developer.twitter.com/en/portal',
    devPortalLabel: 'Twitter Developer Portal',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    Icon: Linkedin as PlatformConfig['Icon'],
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    devPortalUrl: 'https://www.linkedin.com/developers/apps',
    devPortalLabel: 'LinkedIn Developer Apps',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    Icon: Instagram as PlatformConfig['Icon'],
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    devPortalUrl: 'https://developers.facebook.com',
    devPortalLabel: 'Meta Business Suite',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    Icon: Facebook as PlatformConfig['Icon'],
    color: 'text-blue-500',
    bgColor: 'bg-blue-600/20',
    devPortalUrl: 'https://developers.facebook.com',
    devPortalLabel: 'Facebook Developers',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    Icon: TikTok as PlatformConfig['Icon'],
    color: 'text-white',
    bgColor: 'bg-white/10',
    devPortalUrl: 'https://developers.tiktok.com',
    devPortalLabel: 'TikTok for Developers',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    Icon: Youtube as PlatformConfig['Icon'],
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    devPortalUrl: 'https://console.cloud.google.com',
    devPortalLabel: 'Google Cloud Console (YouTube Data API v3)',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    Icon: Pinterest as PlatformConfig['Icon'],
    color: 'text-red-500',
    bgColor: 'bg-red-600/20',
    devPortalUrl: 'https://developers.pinterest.com',
    devPortalLabel: 'Pinterest Developers',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    Icon: Reddit as PlatformConfig['Icon'],
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    devPortalUrl: 'https://www.reddit.com/prefs/apps',
    devPortalLabel: 'Reddit App Preferences',
  },
  {
    id: 'threads',
    name: 'Threads',
    Icon: Threads as PlatformConfig['Icon'],
    color: 'text-slate-300',
    bgColor: 'bg-slate-400/20',
    devPortalUrl: 'https://developers.facebook.com',
    devPortalLabel: 'Meta Developers (same as Instagram)',
  },
  {
    id: 'searchconsole',
    name: 'Google Search Console',
    Icon: Search as PlatformConfig['Icon'],
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    devPortalLabel: 'Google Cloud Console (same OAuth client as YouTube)',
  },
  {
    id: 'googleanalytics',
    name: 'Google Analytics (GA4)',
    Icon: BarChart2 as PlatformConfig['Icon'],
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    devPortalLabel: 'Google Cloud Console (same OAuth client as YouTube)',
  },
  {
    id: 'googledrive',
    name: 'Google Drive',
    Icon: HardDrive as PlatformConfig['Icon'],
    color: 'text-blue-300',
    bgColor: 'bg-blue-400/20',
    devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    devPortalLabel: 'Google Cloud Console (same OAuth client as YouTube)',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatformCredentialsManager() {
  // Access gate — null means "still loading", false = not owner, true = owner
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<PlatformCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPlatform, setDeletingPlatform] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-credentials', {
        credentials: 'include',
      });

      if (res.status === 403) {
        setHasAccess(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setHasAccess(true);
        setCredentials(data.credentials || []);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Failed to load platform credentials:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!editingPlatform || !clientIdInput.trim() || !clientSecretInput.trim()) {
      toast.error('Please enter both Client ID and Client Secret');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/platform-credentials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editingPlatform,
          clientId: clientIdInput.trim(),
          clientSecret: clientSecretInput.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const platformName = PLATFORMS.find(p => p.id === editingPlatform)?.name || editingPlatform;
        toast.success(`${platformName} credentials saved!`);
        closeForm();
        await loadCredentials();
      } else {
        toast.error(data.error || 'Failed to save credentials');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingPlatform, clientIdInput, clientSecretInput, loadCredentials]);

  const handleDelete = useCallback(async (platform: string) => {
    setDeletingPlatform(platform);
    try {
      const res = await fetch('/api/admin/platform-credentials', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });

      if (res.ok) {
        const platformName = PLATFORMS.find(p => p.id === platform)?.name || platform;
        toast.success(`${platformName} credentials removed`);
        setCredentials(prev => prev.filter(c => c.platform !== platform));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove credentials');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeletingPlatform(null);
    }
  }, []);

  const openForm = useCallback((platformId: string) => {
    setEditingPlatform(platformId);
    setClientIdInput('');
    setClientSecretInput('');
    setShowClientId(false);
    setShowClientSecret(false);
  }, []);

  const closeForm = useCallback(() => {
    setEditingPlatform(null);
    setClientIdInput('');
    setClientSecretInput('');
    setShowClientId(false);
    setShowClientSecret(false);
  }, []);

  const copyCallbackUrl = useCallback((platform: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/auth/callback/${platform}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Callback URL copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy URL');
    });
  }, []);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const configuredPlatforms = new Set(credentials.map(c => c.platform));

  const getCredentialForPlatform = (platformId: string) =>
    credentials.find(c => c.platform === platformId);

  const getPlatformConfig = (platformId: string) =>
    PLATFORMS.find(p => p.id === platformId);

  // -----------------------------------------------------------------------
  // Access gate: hide entirely if not the owner or still loading access
  // -----------------------------------------------------------------------

  if (hasAccess === null && isLoading) {
    return null; // Don't flash a loading spinner for a gate check
  }

  if (hasAccess === false) {
    return null; // Not the owner — render nothing
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Card variant="glass">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Platform OAuth Credentials
          </CardTitle>
          <CardDescription>
            Configure OAuth Client ID and Client Secret for each social platform.
            These credentials enable user OAuth sign-in flows for connecting accounts.
            <strong className="text-amber-400 ml-1">Owner only.</strong>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">
            Loading platform credentials...
          </div>
        ) : (
          <>
            {/* Platform list */}
            {PLATFORMS.map(platform => {
              const isConfigured = configuredPlatforms.has(platform.id);
              const credential = getCredentialForPlatform(platform.id);
              const isEditing = editingPlatform === platform.id;
              const IconComponent = platform.Icon;

              return (
                <div key={platform.id} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                  {/* Platform row */}
                  <div
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                      isEditing ? 'bg-white/[0.03]' : ''
                    }`}
                    onClick={() => {
                      if (isEditing) {
                        closeForm();
                      } else {
                        openForm(platform.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${platform.bgColor} flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${platform.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{platform.name}</p>
                        {isConfigured && credential ? (
                          <p className="text-sm text-slate-400 font-mono">
                            {credential.maskedClientId}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">Not configured</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <Check className="w-3 h-3 mr-1" />
                            Configured
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingPlatform === platform.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(platform.id);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            aria-label={`Delete ${platform.name} credentials`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                          Not configured
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5">
                      {/* Developer portal link */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                        <a
                          href={platform.devPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-cyan-400 transition-colors underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {platform.devPortalLabel}
                        </a>
                      </div>

                      {/* Callback URL */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Callback URL
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-mono truncate">
                            {typeof window !== 'undefined'
                              ? `${window.location.origin}/api/auth/callback/${platform.id}`
                              : `/api/auth/callback/${platform.id}`}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyCallbackUrl(platform.id);
                            }}
                            className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 flex-shrink-0"
                            aria-label="Copy callback URL"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Client ID */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          Client ID
                        </label>
                        <div className="relative">
                          <input
                            type={showClientId ? 'text' : 'password'}
                            value={clientIdInput}
                            onChange={e => setClientIdInput(e.target.value)}
                            placeholder="Enter Client ID"
                            className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-0 font-mono text-sm"
                            autoComplete="off"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Client ID"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowClientId(!showClientId);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label={showClientId ? 'Hide Client ID' : 'Show Client ID'}
                          >
                            {showClientId ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Client Secret */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                          Client Secret
                        </label>
                        <div className="relative">
                          <input
                            type={showClientSecret ? 'text' : 'password'}
                            value={clientSecretInput}
                            onChange={e => setClientSecretInput(e.target.value)}
                            placeholder="Enter Client Secret"
                            className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-0 font-mono text-sm"
                            autoComplete="off"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Client Secret"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowClientSecret(!showClientSecret);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label={showClientSecret ? 'Hide Client Secret' : 'Show Client Secret'}
                          >
                            {showClientSecret ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="gradient-primary"
                          disabled={!clientIdInput.trim() || !clientSecretInput.trim() || isSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSave();
                          }}
                        >
                          {isSubmitting ? 'Saving...' : isConfigured ? 'Update Credentials' : 'Save Credentials'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary footer */}
            <div className="pt-2 text-xs text-slate-500 text-center">
              {configuredPlatforms.size} of {PLATFORMS.length} platforms configured
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
