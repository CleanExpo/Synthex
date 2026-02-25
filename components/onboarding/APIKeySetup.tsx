'use client';

/**
 * API Key Setup Component
 *
 * @description Form for inputting and validating API credentials for OpenAI, Anthropic,
 * Google, and OpenRouter. Validates keys via /api/onboarding/api-credentials endpoint
 * and displays masked keys with validation status.
 */

import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2, X, Eye, EyeOff, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// TYPES
// ============================================================================

type APIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

interface APICredential {
  provider: APIProvider;
  maskedKey: string;
  isValid: boolean;
  isActive: boolean;
  lastValidatedAt?: string;
}

interface APIKeySetupProps {
  onComplete: (credentials: Record<APIProvider, string>) => void;
  minProviders?: number;
}

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const PROVIDERS: Record<
  APIProvider,
  { label: string; description: string; keyFormat: string }
> = {
  openai: {
    label: 'OpenAI',
    description: 'For GPT-4, GPT-4 Turbo, and other OpenAI models',
    keyFormat: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic',
    description: 'For Claude models (required)',
    keyFormat: 'sk-ant-...',
  },
  google: {
    label: 'Google AI',
    description: 'For Gemini models',
    keyFormat: 'GOOGLE_API_KEY',
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'For access to multiple model providers',
    keyFormat: 'sk-or-...',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function APIKeySetup({
  onComplete,
  minProviders = 1,
}: APIKeySetupProps) {
  const [selectedProvider, setSelectedProvider] = useState<APIProvider>('anthropic');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Map<APIProvider, APICredential>>(
    new Map()
  );

  const currentProviderConfig = PROVIDERS[selectedProvider];
  const isKeyAdded = credentials.has(selectedProvider);
  const currentCredential = credentials.get(selectedProvider);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleValidateAndAdd = async () => {
    if (!keyInput.trim()) {
      setError('API key cannot be empty');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: keyInput.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Validation failed');
      }

      const data = await response.json();

      // Store credential
      setCredentials((prev) => {
        const next = new Map(prev);
        next.set(selectedProvider, {
          provider: selectedProvider,
          maskedKey: data.maskedKey,
          isValid: data.isValid,
          isActive: data.isActive,
          lastValidatedAt: data.lastValidatedAt,
        });
        return next;
      });

      setKeyInput('');
      setShowKey(false);

      // If key is invalid, show warning
      if (!data.isValid) {
        setError(`⚠️ Key validation warning: ${data.error || 'Unable to validate'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCredential = (provider: APIProvider) => {
    setCredentials((prev) => {
      const next = new Map(prev);
      next.delete(provider);
      return next;
    });
  };

  const handleComplete = () => {
    const credentialRecord: Record<APIProvider, string> = {} as any;
    credentials.forEach((cred, provider) => {
      credentialRecord[provider] = cred.maskedKey;
    });
    onComplete(credentialRecord);
  };

  const canComplete = credentials.size >= minProviders;

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Connect Your API Keys</h3>
        <p className="text-sm text-gray-400">
          Add your API keys so SYNTHEX can use your preferred AI providers. Your keys are
          encrypted and never shared.
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
        <div className="flex gap-3">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <p className="text-xs text-cyan-300">
            You pay for your own API usage. SYNTHEX will use your keys to call AI models
            on your behalf. Minimum {minProviders} provider required.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        {/* Provider Select */}
        <div className="space-y-2">
          <Label htmlFor="provider" className="text-gray-300">
            Select Provider
          </Label>
          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as APIProvider)}>
            <SelectTrigger className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0f172a] border-cyan-500/20">
              {Object.entries(PROVIDERS).map(([key, config]) => (
                <SelectItem
                  key={key}
                  value={key}
                  className="text-gray-300 focus:bg-cyan-500/20 focus:text-white"
                  disabled={credentials.has(key as APIProvider)}
                >
                  {config.label}
                  {credentials.has(key as APIProvider) ? ' (added)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">{currentProviderConfig.description}</p>
        </div>

        {/* API Key Input */}
        {!isKeyAdded ? (
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-gray-300">
              API Key
            </Label>
            <div className="relative">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setError(null);
                }}
                placeholder={`Paste your ${currentProviderConfig.label} API key (${currentProviderConfig.keyFormat})`}
                className="w-full rounded-md bg-[#0a1628]/50 border border-cyan-500/20 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 p-2.5 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Add Button */}
            <Button
              onClick={handleValidateAndAdd}
              disabled={isValidating || !keyInput.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-700 disabled:text-gray-500"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Add & Validate'
              )}
            </Button>
          </div>
        ) : (
          /* Added Key Display */
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-white">
                    {currentProviderConfig.label} added
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Key: <code className="text-gray-300">{currentCredential?.maskedKey}</code>
                </p>
                {currentCredential?.lastValidatedAt && (
                  <p className="text-xs text-gray-500">
                    Validated:{' '}
                    {new Date(currentCredential.lastValidatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCredential(selectedProvider)}
                className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Added Credentials Summary */}
      {credentials.size > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Added Providers</h4>
          <div className="space-y-2">
            {Array.from(credentials.entries()).map(([provider, cred]) => (
              <div
                key={provider}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0a1628]/50 border border-cyan-500/10"
              >
                <div className="flex items-center gap-3">
                  {cred.isValid ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {PROVIDERS[provider].label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cred.maskedKey}
                      {!cred.isValid && ' (Warning: validation failed)'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleRemoveCredential(provider);
                    setSelectedProvider(provider);
                  }}
                  className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete Button */}
      {credentials.size > 0 && (
        <Button
          onClick={handleComplete}
          disabled={!canComplete}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-700 disabled:text-gray-500"
        >
          {canComplete
            ? '✓ Continue with API Keys'
            : `Add ${minProviders - credentials.size} more provider(s)`}
        </Button>
      )}

      {/* Providers status indicator */}
      {credentials.size === 0 && (
        <div className="pt-2 text-center">
          <p className="text-xs text-gray-600">
            {minProviders} of 4 providers configured
          </p>
        </div>
      )}
      {credentials.size > 0 && credentials.size < 4 && (
        <div className="pt-2 text-center">
          <p className="text-xs text-gray-500">
            {credentials.size} of 4 providers configured
          </p>
        </div>
      )}
    </div>
  );
}
