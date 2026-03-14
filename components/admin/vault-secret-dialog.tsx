'use client';

/**
 * Vault Secret Dialog
 *
 * Radix Dialog for creating or rotating vault secrets.
 * Used by VaultManager component.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, Key, Lock } from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

export interface SecretFormData {
  name: string;
  secretType: string;
  provider: string;
  value: string;
  description: string;
  expiresAt: string;
  isRotatable: boolean;
}

interface VaultSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'rotate';
  /** Pre-filled slug when rotating */
  rotateSlug?: string;
  /** Pre-filled name when rotating */
  rotateName?: string;
  organizationId: string;
  onSubmit: (data: SecretFormData, mode: 'create' | 'rotate') => Promise<void>;
  isSaving: boolean;
}

const SECRET_TYPES = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth_token', label: 'OAuth Token' },
  { value: 'oauth_refresh_token', label: 'OAuth Refresh Token' },
  { value: 'env_var', label: 'Environment Variable' },
  { value: 'custom', label: 'Custom' },
];

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'custom', label: 'Custom / Other' },
];

// =============================================================================
// Component
// =============================================================================

export function VaultSecretDialog({
  open,
  onOpenChange,
  mode,
  rotateSlug,
  rotateName,
  organizationId,
  onSubmit,
  isSaving,
}: VaultSecretDialogProps) {
  const [showValue, setShowValue] = useState(false);
  const [form, setForm] = useState<SecretFormData>({
    name: '',
    secretType: 'api_key',
    provider: '',
    value: '',
    description: '',
    expiresAt: '',
    isRotatable: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form, mode);
    // Reset form on success
    setForm({
      name: '',
      secretType: 'api_key',
      provider: '',
      value: '',
      description: '',
      expiresAt: '',
      isRotatable: false,
    });
    setShowValue(false);
  };

  const title = mode === 'create' ? 'Add Secret' : `Rotate: ${rotateName ?? rotateSlug}`;
  const description =
    mode === 'create'
      ? 'Store a new encrypted secret in the vault.'
      : 'Replace the current value with a new one. The old value cannot be recovered.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'create' ? <Key className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Name (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="secret-name">Name</Label>
                <Input
                  id="secret-name"
                  placeholder="e.g., OpenRouter API Key"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}

            {/* Type (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.secretType}
                  onValueChange={(v) => setForm((f) => ({ ...f, secretType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECRET_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Provider (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Value (both modes) */}
            <div className="space-y-2">
              <Label htmlFor="secret-value">
                {mode === 'create' ? 'Secret Value' : 'New Value'}
              </Label>
              <div className="relative">
                <Input
                  id="secret-value"
                  type={showValue ? 'text' : 'password'}
                  placeholder="Paste your secret here..."
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Description (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="secret-desc">Description (optional)</Label>
                <Input
                  id="secret-desc"
                  placeholder="What is this key used for?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            )}

            {/* Expiry (create only) */}
            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="secret-expiry">Expiry Date (optional)</Label>
                <Input
                  id="secret-expiry"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.value}>
              {isSaving
                ? mode === 'create'
                  ? 'Encrypting...'
                  : 'Rotating...'
                : mode === 'create'
                  ? 'Add Secret'
                  : 'Rotate Secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
