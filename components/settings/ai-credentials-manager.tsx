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
import { toast } from 'sonner';

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
    description: 'Required — powers all AI features via 100+ models',
    placeholder: 'sk-or-v1-...',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    required: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models (Haiku, Sonnet, Opus)',
    placeholder: 'sk-ant-...',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    required: false,
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini models (Flash, Pro)',
    placeholder: 'AIza...',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    required: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models (direct API)',
    placeholder: 'sk-...',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    required: false,
  },
];

/** Popular models available via OpenRouter */
const OPENROUTER_MODELS = [
  // Premium tier
  { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', tier: 'premium' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', tier: 'premium' },
  { id: 'openai/gpt-5.3-codex', name: 'GPT-5.3 Codex', tier: 'premium' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'premium' },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tier: 'premium' },
  // Budget tier
  { id: 'google/gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', tier: 'budget' },
  { id: 'qwen/qwen3.5-35b-a3b', name: 'Qwen 3.5 35B', tier: 'budget' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'budget' },
  { id: 'anthropic/claude-haiku-4', name: 'Claude Haiku 4', tier: 'budget' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', tier: 'budget' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', tier: 'budget' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'budget' },
];

export function AICredentialsManager() {
  const [credentials, setCredentials] = useState<AICredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-opus-4.6');
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
        // Save model preference when OpenRouter key is added
        if (selectedProvider === 'openrouter' && selectedModel) {
          try {
            await fetch('/api/user/profile', {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ openrouterModel: selectedModel }),
            });
          } catch { /* non-critical */ }
        }
        setShowAddForm(false);
        setSelectedProvider('');
        setApiKeyInput('');
        setSelectedModel('openai/gpt-4o');
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
            Add your API keys to power AI features. <strong className="text-purple-400">OpenRouter is required</strong> to
            get started — it gives you access to 100+ models with a single key.
            All keys are encrypted at rest and never exposed.
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
                        : provider.required && !existingProviders.has(provider.id)
                          ? 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <p className={`text-sm font-medium ${provider.color}`}>
                      {provider.name}
                      {provider.required && !existingProviders.has(provider.id) && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase tracking-wide">Required</span>
                      )}
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
              <div className="space-y-4">
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

                {/* Model selector for OpenRouter */}
                {selectedProvider === 'openrouter' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Default Model
                    </label>
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 text-sm"
                    >
                      <optgroup label="Premium">
                        {OPENROUTER_MODELS.filter(m => m.tier === 'premium').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Budget-friendly">
                        {OPENROUTER_MODELS.filter(m => m.tier === 'budget').map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose which model Synthex uses for content generation. You can change this anytime.
                    </p>
                  </div>
                )}
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
            <Key className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">
              No AI provider keys configured
            </p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Add your <strong className="text-purple-400">OpenRouter</strong> API key to unlock all AI features.
              One key gives you access to GPT-4o, Claude, Gemini, and 100+ other models.
            </p>
            <Button
              onClick={() => { setShowAddForm(true); setSelectedProvider('openrouter'); }}
              size="sm"
              className="mt-3 gradient-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add OpenRouter Key
            </Button>
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
