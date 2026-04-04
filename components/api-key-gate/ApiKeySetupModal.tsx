'use client';

/**
 * ApiKeySetupModal
 *
 * Shown when a feature requires an API key the user hasn't configured yet.
 * Displays:
 *   - Which provider is required and why
 *   - Step-by-step instructions to obtain the key
 *   - A YouTube tutorial link (when provided)
 *   - A direct link to Settings → Integrations to save the key
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Key, Youtube } from '@/components/icons';
import { cn } from '@/lib/utils';
import { getProviderConfig } from '@/lib/api-key-gate/providers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKeySetupModalProps {
  open: boolean;
  onClose: () => void;
  /** The provider ID (e.g. 'openai', 'elevenlabs') */
  provider: string;
  /** Display name of the feature that needs this key (e.g. 'Video Voiceover') */
  featureName: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApiKeySetupModal({
  open,
  onClose,
  provider,
  featureName,
}: ApiKeySetupModalProps) {
  const config = getProviderConfig(provider);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-gray-950 border border-white/10 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Key className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-base">
                API Key Required
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm mt-0.5">
                {featureName} needs your {config.name} key to work
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Steps */}
        <div className="space-y-2 mt-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            How to get your {config.name} key
          </p>

          <ol className="space-y-2">
            {config.instructions.map((step, i) => (
              <li
                key={i}
                className="flex gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <span
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5',
                    copiedStep === i
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-amber-500/20 text-amber-400'
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-gray-300 leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-4">
          {/* YouTube tutorial (when available) */}
          {config.youtubeUrl && (
            <a
              href={config.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-colors"
            >
              <Youtube className="h-4 w-4" />
              Watch Tutorial on YouTube
            </a>
          )}

          {/* Provider docs */}
          <a
            href={config.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 text-sm hover:bg-white/[0.08] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open {config.name} Key Dashboard
          </a>

          {/* Go to settings */}
          <Link href={config.settingsPath} onClick={onClose}>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold">
              <Key className="h-4 w-4 mr-2" />
              Save My {config.name} Key
            </Button>
          </Link>

          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            I'll do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
