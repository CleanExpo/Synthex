'use client';

/**
 * ApiKeyGate
 *
 * Wraps any feature that requires a third-party API key.
 * If the user has the key configured → renders children.
 * If the key is missing → renders a locked-state card with a setup CTA.
 *
 * Usage:
 *   <ApiKeyGate provider="elevenlabs" featureName="Video Voiceover">
 *     <VoiceoverControls />
 *   </ApiKeyGate>
 *
 * The gate checks /api/api-keys/status via SWR and re-validates after
 * the user saves a key (call refresh() from useApiKeyStatus elsewhere).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Key } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';
import { getProviderConfig } from '@/lib/api-key-gate/providers';
import { ApiKeySetupModal } from './ApiKeySetupModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKeyGateProps {
  /** Provider ID — must match a key in PROVIDER_CONFIGS */
  provider: string;
  /** Human-readable name of the feature being gated */
  featureName: string;
  /** Content to render when the key is present */
  children: React.ReactNode;
  /** Optional custom locked-state; defaults to the built-in card */
  fallback?: React.ReactNode;
  /** Extra classes for the locked-state wrapper */
  className?: string;
}

// ── Locked state card ─────────────────────────────────────────────────────────

function LockedCard({
  provider,
  featureName,
  onSetup,
}: {
  provider: string;
  featureName: string;
  onSetup: () => void;
}) {
  const config = getProviderConfig(provider);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] text-center">
      <div className="p-3 rounded-full bg-amber-500/10">
        <Key className="h-6 w-6 text-amber-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">
          {config.name} API Key Required
        </p>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          {featureName} needs your {config.name} key to generate content. Setup
          takes about 2 minutes.
        </p>
      </div>
      <Button
        onClick={onSetup}
        size="sm"
        className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
      >
        <Key className="h-3.5 w-3.5 mr-1.5" />
        Set Up {config.name} Key
      </Button>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function GateSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] h-48" />
  );
}

// ── Gate ─────────────────────────────────────────────────────────────────────

export function ApiKeyGate({
  provider,
  featureName,
  children,
  fallback,
  className,
}: ApiKeyGateProps) {
  const { isAvailable, isLoading } = useApiKeyStatus();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) return <GateSkeleton />;

  if (!isAvailable(provider)) {
    return (
      <div className={cn(className)}>
        {fallback ?? (
          <LockedCard
            provider={provider}
            featureName={featureName}
            onSetup={() => setShowModal(true)}
          />
        )}
        <ApiKeySetupModal
          open={showModal}
          onClose={() => setShowModal(false)}
          provider={provider}
          featureName={featureName}
        />
      </div>
    );
  }

  return <>{children}</>;
}
