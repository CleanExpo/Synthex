'use client';

/**
 * Vault Manager Component
 *
 * Admin tab for managing org-scoped encrypted secrets.
 * Data source: /api/admin/vault (SWR with query params)
 *
 * Features:
 *   - List all secrets (masked values)
 *   - Create new secrets via dialog
 *   - Rotate existing secrets
 *   - Soft-delete secrets
 *   - Filter by type and provider
 *   - Expiry badges (green/amber/red)
 *   - Usage stats (last used, usage count)
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Key,
  Plus,
  RotateCcw,
  Trash2,
  RefreshCw,
  Shield,
  Clock,
  Search,
  Filter,
  Eye,
  Copy,
  Zap,
} from '@/components/icons';
import { VaultSecretDialog, type SecretFormData } from './vault-secret-dialog';

// =============================================================================
// Types
// =============================================================================

interface VaultSecret {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  secretType: string;
  provider: string | null;
  maskedValue: string;
  isActive: boolean;
  isRotatable: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  lastRotatedAt: string | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VaultApiResponse {
  secrets: VaultSecret[];
  total: number;
}

// =============================================================================
// SWR Fetcher
// =============================================================================

function fetchJson(url: string) {
  return fetch(url, { credentials: 'include' }).then((r) => r.json());
}

// =============================================================================
// Helpers
// =============================================================================

const TYPE_LABELS: Record<string, string> = {
  api_key: 'API Key',
  oauth_token: 'OAuth Token',
  oauth_refresh_token: 'Refresh Token',
  env_var: 'Env Var',
  custom: 'Custom',
};

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
  stripe: 'Stripe',
  custom: 'Custom',
};

function getExpiryBadge(expiresAt: string | null): React.ReactNode {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (daysUntil <= 7) {
    return <Badge variant="destructive">Expires in {daysUntil}d</Badge>;
  }
  if (daysUntil <= 30) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-500">
        Expires in {daysUntil}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500 text-emerald-500">
      {daysUntil}d remaining
    </Badge>
  );
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU');
}

// =============================================================================
// Component Props
// =============================================================================

interface VaultManagerProps {
  organizationId: string;
}

// =============================================================================
// VaultManager
// =============================================================================

export function VaultManager({ organizationId }: VaultManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'rotate'>('create');
  const [rotateSlug, setRotateSlug] = useState('');
  const [rotateName, setRotateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // SWR fetch
  const swrKey = organizationId
    ? `/api/admin/vault?organizationId=${organizationId}${filterType !== 'all' ? `&secretType=${filterType}` : ''}${filterProvider !== 'all' ? `&provider=${filterProvider}` : ''}`
    : null;

  const { data, isLoading, mutate } = useSWR<VaultApiResponse>(swrKey, fetchJson);

  const secrets = data?.secrets ?? [];

  // Client-side search
  const filteredSecrets = secrets.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.provider ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOpenCreate = useCallback(() => {
    setDialogMode('create');
    setRotateSlug('');
    setRotateName('');
    setDialogOpen(true);
  }, []);

  const handleOpenRotate = useCallback((secret: VaultSecret) => {
    setDialogMode('rotate');
    setRotateSlug(secret.slug);
    setRotateName(secret.name);
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (formData: SecretFormData, mode: 'create' | 'rotate') => {
      setIsSaving(true);
      try {
        if (mode === 'create') {
          const res = await fetch('/api/admin/vault', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              name: formData.name,
              secretType: formData.secretType,
              provider: formData.provider || undefined,
              value: formData.value,
              description: formData.description || undefined,
              expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
              isRotatable: formData.isRotatable,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? 'Failed to create secret');
          toast.success(`Secret "${formData.name}" stored successfully`);
        } else {
          const res = await fetch('/api/admin/vault', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              slug: rotateSlug,
              newValue: formData.value,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? 'Failed to rotate secret');
          toast.success(`Secret "${rotateName}" rotated successfully`);
        }

        setDialogOpen(false);
        mutate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Operation failed');
      } finally {
        setIsSaving(false);
      }
    },
    [organizationId, rotateSlug, rotateName, mutate]
  );

  const handleDelete = useCallback(
    async (secret: VaultSecret) => {
      if (!confirm(`Delete secret "${secret.name}"? This will deactivate it.`)) return;

      try {
        const res = await fetch('/api/admin/vault', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, slug: secret.slug }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to delete secret');
        toast.success(`Secret "${secret.name}" deleted`);
        mutate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [organizationId, mutate]
  );

  const handleCopyMasked = useCallback((maskedValue: string) => {
    navigator.clipboard.writeText(maskedValue);
    toast.success('Masked value copied');
  }, []);

  const handleSeedAll = useCallback(async () => {
    if (!confirm('Seed platform AI keys (OpenRouter, OpenAI, etc.) into ALL businesses? Existing secrets will not be overwritten.')) return;
    setIsSeeding(true);
    try {
      const res = await fetch('/api/admin/vault/seed-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Seed failed');
      const { summary } = json;
      toast.success(
        `Seeded ${summary.totalSeeded} keys across ${summary.organisations} businesses (${summary.totalSkipped} already existed)`
      );
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed all failed');
    } finally {
      setIsSeeding(false);
    }
  }, [mutate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!organizationId) {
    return (
      <Card variant="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Select an organisation to manage vault secrets.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Vault Secrets
              </CardTitle>
              <CardDescription>
                Encrypted credentials for AI agent operations and platform integrations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedAll}
                disabled={isSeeding}
                title="Seed platform AI keys into all businesses"
              >
                <Zap className={`h-4 w-4 mr-1 ${isSeeding ? 'animate-pulse' : ''}`} />
                {isSeeding ? 'Seeding...' : 'Seed All'}
              </Button>
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add Secret
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search secrets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="oauth_token">OAuth Token</SelectItem>
                <SelectItem value="oauth_refresh_token">Refresh Token</SelectItem>
                <SelectItem value="env_var">Env Var</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span>{filteredSecrets.length} secret{filteredSecrets.length !== 1 ? 's' : ''}</span>
            {secrets.filter((s) => {
              if (!s.expiresAt) return false;
              const days = Math.ceil(
                (new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return days <= 7 && days >= 0;
            }).length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {secrets.filter((s) => {
                  if (!s.expiresAt) return false;
                  const days = Math.ceil(
                    (new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return days <= 7 && days >= 0;
                }).length}{' '}
                expiring soon
              </Badge>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : filteredSecrets.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Key className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">No secrets found</p>
              <p className="text-sm">
                {secrets.length === 0
                  ? 'Add your first secret to get started.'
                  : 'No secrets match your current filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSecrets.map((secret) => (
                <div
                  key={secret.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors"
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{secret.name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {TYPE_LABELS[secret.secretType] ?? secret.secretType}
                      </Badge>
                      {secret.provider && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {PROVIDER_LABELS[secret.provider] ?? secret.provider}
                        </Badge>
                      )}
                      {getExpiryBadge(secret.expiresAt)}
                      {!secret.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                        {secret.maskedValue}
                      </code>
                      <button
                        onClick={() => handleCopyMasked(secret.maskedValue)}
                        className="hover:text-foreground"
                        title="Copy masked value"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Used {formatRelativeTime(secret.lastUsedAt)}
                      </span>
                      <span>
                        {secret.usageCount} use{secret.usageCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground/60">
                        {secret.source}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenRotate(secret)}
                      title="Rotate secret"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(secret)}
                      title="Delete secret"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VaultSecretDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        rotateSlug={rotateSlug}
        rotateName={rotateName}
        organizationId={organizationId}
        onSubmit={handleSubmit}
        isSaving={isSaving}
      />
    </>
  );
}
