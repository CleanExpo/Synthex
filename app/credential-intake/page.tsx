'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';

type Provider = 'facebook' | 'instagram' | 'linkedin' | 'reddit';

interface IntakeMetadata {
  success: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  providers: Provider[];
  expiresAt: string | null;
}

interface IntakeEntry {
  provider: Provider;
  label: string;
  secretType: 'api_key' | 'oauth_token' | 'oauth_refresh_token' | 'custom';
  value: string;
  notes: string;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
};

const DEFAULT_LABELS: Record<Provider, string> = {
  facebook: 'Page or Business Manager details',
  instagram: 'Business account details',
  linkedin: 'Company page details',
  reddit: 'Account or app details',
};

function blankEntry(provider: Provider): IntakeEntry {
  return {
    provider,
    label: DEFAULT_LABELS[provider],
    secretType: 'custom',
    value: '',
    notes: '',
  };
}

export default function CredentialIntakePage() {
  const [token, setToken] = useState('');
  const [metadata, setMetadata] = useState<IntakeMetadata | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get('token');
    if (!nextToken) {
      setError('Credential link is missing.');
      setLoading(false);
      return;
    }
    setToken(nextToken);

    fetch(`/api/credential-intake?token=${encodeURIComponent(nextToken)}`, {
      credentials: 'omit',
    })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Credential link failed.');
        return body as IntakeMetadata;
      })
      .then(body => {
        setMetadata(body);
        setEntries([blankEntry(body.providers[0] ?? 'facebook')]);
      })
      .catch(err => {
        setError(
          err instanceof Error ? err.message : 'Credential link failed.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const providerOptions = useMemo(
    () => metadata?.providers ?? [],
    [metadata?.providers]
  );

  function updateEntry(index: number, patch: Partial<IntakeEntry>) {
    setEntries(current =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  function addEntry() {
    const provider = providerOptions[0] ?? 'facebook';
    setEntries(current => [...current, blankEntry(provider)]);
  }

  function removeEntry(index: number) {
    setEntries(current => current.filter((_, i) => i !== index));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        token,
        entries: entries.map(entry => ({
          provider: entry.provider,
          label: entry.label,
          secretType: entry.secretType,
          value: entry.value,
          notes: entry.notes || undefined,
        })),
      };
      const res = await fetch('/api/credential-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error || 'Credential submission failed.');
      setSubmitted(true);
      setEntries([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Credential submission failed.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </main>
    );
  }

  if (error && !metadata) {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-red-500/25 bg-red-500/10 rounded p-6">
          <AlertTriangle className="h-5 w-5 text-red-300 mb-4" />
          <h1 className="text-xl font-medium">Link unavailable</h1>
          <p className="mt-2 text-sm text-white/65">{error}</p>
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-emerald-500/25 bg-emerald-500/10 rounded p-6">
          <CheckCircle2 className="h-5 w-5 text-emerald-300 mb-4" />
          <h1 className="text-xl font-medium">Details received</h1>
          <p className="mt-2 text-sm text-white/65">
            The credentials were stored securely for{' '}
            {metadata?.organization.name}.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] text-white p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-5">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-300">
            Synthex Secure Intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {metadata?.organization.name}
          </h1>
          {metadata?.expiresAt && (
            <p className="mt-2 text-sm text-white/55">
              Link expires {new Date(metadata.expiresAt).toLocaleString()}.
            </p>
          )}
        </header>

        {error && (
          <div className="border border-red-500/25 bg-red-500/10 rounded p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="border border-white/10 bg-white/[0.03] rounded p-4 space-y-4"
            >
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1">
                  <span className="text-xs text-white/55">Platform</span>
                  <select
                    className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm"
                    value={entry.provider}
                    onChange={event => {
                      const provider = event.target.value as Provider;
                      updateEntry(index, {
                        provider,
                        label: DEFAULT_LABELS[provider],
                      });
                    }}
                  >
                    {providerOptions.map(provider => (
                      <option key={provider} value={provider}>
                        {PROVIDER_LABELS[provider]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-white/55">Type</span>
                  <select
                    className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm"
                    value={entry.secretType}
                    onChange={event =>
                      updateEntry(index, {
                        secretType: event.target
                          .value as IntakeEntry['secretType'],
                      })
                    }
                  >
                    <option value="custom">Details</option>
                    <option value="oauth_token">OAuth token</option>
                    <option value="oauth_refresh_token">Refresh token</option>
                    <option value="api_key">API key</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  disabled={entries.length === 1}
                  className="h-10 self-end inline-flex items-center justify-center rounded border border-white/10 px-3 text-white/70 disabled:opacity-35"
                  aria-label="Remove credential"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-white/55">Label</span>
                <input
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm"
                  value={entry.label}
                  onChange={event =>
                    updateEntry(index, { label: event.target.value })
                  }
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-white/55">
                  Credential details
                </span>
                <textarea
                  className="min-h-32 w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono"
                  value={entry.value}
                  onChange={event =>
                    updateEntry(index, { value: event.target.value })
                  }
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-white/55">Notes</span>
                <input
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm"
                  value={entry.notes}
                  onChange={event =>
                    updateEntry(index, { notes: event.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </section>

        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addEntry}
            disabled={entries.length >= 12}
            className="inline-flex items-center justify-center gap-2 rounded border border-white/10 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add another
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              entries.length === 0 ||
              entries.some(entry => !entry.label.trim() || !entry.value)
            }
            className="inline-flex items-center justify-center gap-2 rounded bg-amber-400 px-5 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit
          </button>
        </footer>
      </div>
    </main>
  );
}
