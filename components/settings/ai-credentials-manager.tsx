'use client';

/**
 * AI Credentials Manager
 *
 * Allows users to add, view, test, and delete their AI provider API keys
 * (OpenRouter, Anthropic, Google, OpenAI). These keys are encrypted at rest
 * and used by the AI provider factory when generating content.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Check,
  Key,
  Plus,
  Trash2,
} from '@/components/icons';
import toast from 'react-hot-toast';

interface AICredential {
  id: string;
  provider: string;
  maskedKey: string;
  isValid: boolean;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  validationError: string | null;
  createdAt: string;
}

const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access 100+ models via one API key',
    placeholder: 'sk-or-v1-...',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models (Haiku, Sonnet, Opus)',
    placeholder: 'sk-ant-...',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini models (Flash, Pro)',
    placeholder: 'AIza...',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models (routed via OpenRouter)',
    placeholder: 'sk-...',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
];

export function AICredentialsManager() {
  const [credentials, setCredentials] = useState<AICredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch credentials
  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-credentials', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
      }
    } catch (error) {
      console.error('Failed to load AI credentials:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Add or update a credential
  const handleAddCredential = useCallback(async () => {
    if (!selectedProvider || !apiKeyInput.trim()) {
      toast.error('Please select a provider and enter an API key');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/settings/api-credentials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`${getProviderName(selectedProvider)} key saved and validated!`);
        setShowAddForm(false);
        setSelectedProvider('');
        setApiKeyInput('');
        await loadCredentials();
      } else {
        toast.error(data.error || 'Failed to save API key');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProvider, apiKeyInput, loadCredentials]);

  // Delete a credential
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/settings/api-credentials', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast.success('API key removed');
        setCredentials(prev => prev.filter(c => c.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove key');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const getProviderName = (id: string) =>
    PROVIDERS.find(p => p.id === id)?.name || id;

  const getProviderConfig = (id: string) =>
    PROVIDERS.find(p => p.id === id);

  // Which providers already have credentials
  const existingProviders = new Set(credentials.map(c => c.provider));

  return (
    <Card variant="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            AI Provider Keys
          </CardTitle>
          <CardDescription>
            Add your own API keys to use AI features with your own quota.
            Keys are encrypted at rest and never exposed.
          </CardDescription>
        </div>
        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
            className="gradient-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Key
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        {showAddForm && (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedProvider === provider.id
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <p className={`text-sm font-medium ${provider.color}`}>
                      {provider.name}
                      {existingProviders.has(provider.id) && (
                        <span className="text-xs text-slate-500 ml-1">(update)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{provider.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {selectedProvider && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={getProviderConfig(selectedProvider)?.placeholder || 'Enter your API key'}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Your key will be validated with {getProviderName(selectedProvider)} before saving.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedProvider('');
                  setApiKeyInput('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gradient-primary"
                disabled={!selectedProvider || !apiKeyInput.trim() || isSubmitting}
                onClick={handleAddCredential}
              >
                {isSubmitting ? 'Validating...' : 'Save Key'}
              </Button>
            </div>
          </div>
        )}

        {/* Credentials list */}
        {isLoading ? (
          <div className="text-center py-8 text-slate-500">
            Loading credentials...
          </div>
        ) : credentials.length === 0 && !showAddForm ? (
          <div className="text-center py-8">
            <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              No AI provider keys configured.
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Add your own keys to use AI features with your own quota,
              or the platform will use its shared keys.
            </p>
          </div>
        ) : (
          credentials.map(cred => {
            const config = getProviderConfig(cred.provider);
            return (
              <div
                key={cred.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${config?.bgColor || 'bg-white/10'} flex items-center justify-center`}>
                    <Key className={`w-5 h-5 ${config?.color || 'text-cyan-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {config?.name || cred.provider}
                    </p>
                    <p className="text-sm text-slate-400 font-mono">
                      {cred.maskedKey}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {cred.isValid ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <Check className="w-3 h-3 mr-1" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Invalid
                      </Badge>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Added {new Date(cred.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingId === cred.id}
                    onClick={() => handleDelete(cred.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
