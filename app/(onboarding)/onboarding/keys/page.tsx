'use client';

/**
 * Onboarding — Step 1: BYOK API Key Collection (UNI-1186)
 *
 * Collects user-supplied API keys for AI providers.
 * Tier gating:
 *   Free        → OpenRouter only
 *   Professional → OpenRouter + Anthropic + OpenAI
 *   Business/Custom → All 4 (+ Gemini)
 *
 * Keys are validated live via POST /api/onboarding/validate-key,
 * then stored encrypted via POST /api/onboarding/api-credentials.
 *
 * At least one valid key is required to proceed.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Key, CheckCircle, XCircle, Loader2, Lock, ExternalLink,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

interface ProviderConfig {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  prefix: string;
  docsUrl: string;
  requiredPlan: 'free' | 'professional' | 'business';
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Access 200+ models via a single key. Best starting point.',
    placeholder: 'sk-or-v1-…',
    prefix: 'sk-or-',
    docsUrl: 'https://openrouter.ai/keys',
    requiredPlan: 'free',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: 'Direct access to Claude Haiku, Sonnet and Opus.',
    placeholder: 'sk-ant-api03-…',
    prefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/keys',
    requiredPlan: 'professional',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
    description: 'Direct access to GPT-4o-mini, GPT-4o and o3.',
    placeholder: 'sk-proj-…',
    prefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    requiredPlan: 'professional',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    description: 'Access Gemini 2.0 Flash and Gemini 2.5 Pro.',
    placeholder: 'AIza…',
    prefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/apikey',
    requiredPlan: 'business',
  },
];

// ============================================================================
// TYPES
// ============================================================================

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

interface ProviderState {
  key: string;
  status: ValidationStatus;
  error?: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ProviderCard({
  provider,
  state,
  locked,
  lockedReason,
  onChange,
  onValidate,
}: {
  provider: ProviderConfig;
  state: ProviderState;
  locked: boolean;
  lockedReason?: string;
  onChange: (key: string) => void;
  onValidate: () => void;
}) {
  return (
    <div
      className={cn(
        'p-5 rounded-xl border transition-all duration-200',
        locked
          ? 'bg-white/2 border-white/5 opacity-60'
          : state.status === 'valid'
          ? 'bg-cyan-500/5 border-cyan-500/30'
          : 'bg-surface-base/80 border-cyan-500/10 backdrop-blur-sm'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{provider.label}</span>
            {state.status === 'valid' && (
              <CheckCircle className="w-4 h-4 text-green-400" />
            )}
            {state.status === 'invalid' && (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            {locked && <Lock className="w-3.5 h-3.5 text-gray-500 ml-1" />}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{provider.description}</p>
        </div>
        {!locked && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors shrink-0 ml-3"
          >
            Get key <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {locked ? (
        <p className="text-xs text-gray-500 italic">{lockedReason}</p>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={state.key}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => state.key && state.status === 'idle' && onValidate()}
              placeholder={provider.placeholder}
              type="password"
              className={cn(
                'bg-surface-dark/50 border text-white placeholder:text-gray-600 focus:ring-cyan-500/20 text-sm',
                state.status === 'valid'
                  ? 'border-green-500/40 focus:border-green-500/60'
                  : state.status === 'invalid'
                  ? 'border-red-500/40 focus:border-red-500/60'
                  : 'border-cyan-500/20 focus:border-cyan-500/50'
              )}
              disabled={state.status === 'validating'}
            />
            {state.status === 'validating' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              </div>
            )}
          </div>
          {state.status === 'invalid' && state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}
          {state.status === 'valid' && (
            <p className="text-xs text-green-400">Key validated ✓</p>
          )}
          {state.key && state.status === 'idle' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onValidate}
              className="text-xs bg-white/5 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
            >
              Validate key
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function OnboardingKeysPage() {
  const router = useRouter();
  const { subscription, isLoading: subLoading } = useSubscription();

  const [states, setStates] = useState<Record<string, ProviderState>>({
    openrouter: { key: '', status: 'idle' },
    anthropic: { key: '', status: 'idle' },
    openai: { key: '', status: 'idle' },
    google: { key: '', status: 'idle' },
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Determine which providers are accessible by plan
  const plan = subscription?.plan ?? 'free';
  const isProviderLocked = (provider: ProviderConfig): boolean => {
    if (provider.requiredPlan === 'free') return false;
    if (provider.requiredPlan === 'professional') return plan === 'free';
    if (provider.requiredPlan === 'business') return plan === 'free' || plan === 'professional';
    return false;
  };

  const lockedReason = (provider: ProviderConfig): string => {
    if (provider.requiredPlan === 'professional') return 'Available on Professional plan and above';
    if (provider.requiredPlan === 'business') return 'Available on Business plan and above';
    return 'Upgrade to unlock';
  };

  const updateState = (id: string, update: Partial<ProviderState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  };

  const validateKey = async (providerId: string) => {
    const key = states[providerId].key.trim();
    if (!key) return;

    updateState(providerId, { status: 'validating', error: undefined });

    try {
      const res = await fetch('/api/onboarding/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: providerId, apiKey: key }),
      });

      const data = await res.json() as { valid: boolean; error?: string };

      if (data.valid) {
        updateState(providerId, { status: 'valid' });
      } else {
        updateState(providerId, { status: 'invalid', error: data.error ?? 'Invalid API key' });
      }
    } catch {
      updateState(providerId, { status: 'invalid', error: 'Failed to reach validation endpoint' });
    }
  };

  // At least one key must be validated
  const validProviders = Object.entries(states).filter(([, s]) => s.status === 'valid');
  const canProceed = validProviders.length > 0;

  const handleContinue = async () => {
    if (!canProceed) return;

    setSaving(true);
    setSaveError(null);

    try {
      // Save all validated keys
      for (const [providerId, state] of validProviders) {
        const res = await fetch('/api/onboarding/api-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ provider: providerId, apiKey: state.key }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? `Failed to save ${providerId} key`);
        }
      }

      router.push('/onboarding/audit');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save keys');
    } finally {
      setSaving(false);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgressV2 currentStep={1} />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Key className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Connect your AI providers</h1>
        <p className="text-gray-400 max-w-sm mx-auto">
          Add your API keys to power SYNTHEX. Keys are encrypted and never shared.
          {plan === 'free' && (
            <span className="block mt-1 text-xs text-amber-400">
              Free plan: OpenRouter only. Upgrade to unlock more providers.
            </span>
          )}
        </p>
      </div>

      {/* Provider Cards */}
      <div className="max-w-lg mx-auto space-y-3">
        {PROVIDERS.map((provider) => {
          const locked = isProviderLocked(provider);
          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={states[provider.id]}
              locked={locked}
              lockedReason={locked ? lockedReason(provider) : undefined}
              onChange={(key) => updateState(provider.id, { key, status: 'idle', error: undefined })}
              onValidate={() => validateKey(provider.id)}
            />
          );
        })}
      </div>

      {/* Error */}
      {saveError && (
        <div className="max-w-lg mx-auto p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
          {saveError}
        </div>
      )}

      {/* Actions */}
      <div className="max-w-lg mx-auto flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/onboarding/audit')}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip for now
        </button>

        <Button
          onClick={handleContinue}
          disabled={!canProceed || saving}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-gray-600 pb-2">
        You can add or change keys anytime in Settings → API Keys
      </p>
    </div>
  );
}
