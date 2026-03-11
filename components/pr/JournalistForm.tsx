'use client';

/**
 * PR Journalist CRM — Journalist Create/Edit Form (Phase 92)
 *
 * Modal form for creating or editing a journalist contact.
 *
 * @module components/pr/JournalistForm
 */

import { useState } from 'react';
import { X, Loader2 } from '@/components/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalistFormData {
  name: string;
  outlet: string;
  outletDomain: string;
  email: string;
  title: string;
  location: string;
  beats: string;
  twitterHandle: string;
  linkedinUrl: string;
  notes: string;
  tier: 'cold' | 'warm' | 'hot' | 'advocate';
}

interface JournalistFormProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Partial<JournalistFormData>;
  journalistId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JournalistForm({ onClose, onSaved, initialData, journalistId }: JournalistFormProps) {
  const [form, setForm] = useState<JournalistFormData>({
    name:          initialData?.name ?? '',
    outlet:        initialData?.outlet ?? '',
    outletDomain:  initialData?.outletDomain ?? '',
    email:         initialData?.email ?? '',
    title:         initialData?.title ?? '',
    location:      initialData?.location ?? '',
    beats:         initialData?.beats ?? '',
    twitterHandle: initialData?.twitterHandle ?? '',
    linkedinUrl:   initialData?.linkedinUrl ?? '',
    notes:         initialData?.notes ?? '',
    tier:          initialData?.tier ?? 'cold',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const beatsArray = form.beats
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      const payload = {
        ...form,
        beats: beatsArray,
        email:         form.email         || undefined,
        title:         form.title         || undefined,
        location:      form.location      || undefined,
        twitterHandle: form.twitterHandle || undefined,
        linkedinUrl:   form.linkedinUrl   || undefined,
        notes:         form.notes         || undefined,
      };

      const url = journalistId
        ? `/api/pr/journalists/${journalistId}`
        : '/api/pr/journalists';
      const method = journalistId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Request failed');

      onSaved();
    } catch {
      setError('Failed to save journalist. Please check your inputs and try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof JournalistFormData,
    label: string,
    type: string = 'text',
    placeholder?: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {journalistId ? 'Edit Journalist' : 'New Journalist Contact'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {field('name', 'Full Name *', 'text', 'Jane Smith')}
          <div className="grid grid-cols-2 gap-4">
            {field('outlet', 'Outlet *', 'text', 'The Australian')}
            {field('outletDomain', 'Outlet Domain *', 'text', 'theaustralian.com.au')}
          </div>
          {field('email', 'Email', 'email', 'jane@theaustralian.com.au')}
          <div className="grid grid-cols-2 gap-4">
            {field('title', 'Title / Role', 'text', 'Senior Tech Reporter')}
            {field('location', 'Location', 'text', 'Sydney, NSW')}
          </div>
          {field('beats', 'Beats (comma-separated)', 'text', 'technology, startups, AI')}
          <div className="grid grid-cols-2 gap-4">
            {field('twitterHandle', 'Twitter / X Handle', 'text', '@janesmith')}
            {field('linkedinUrl', 'LinkedIn URL', 'url', 'https://linkedin.com/in/janesmith')}
          </div>

          {/* Tier select */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Relationship Tier</label>
            <select
              value={form.tier}
              onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as JournalistFormData['tier'] }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="cold">Cold — No prior contact</option>
              <option value="warm">Warm — Some prior contact</option>
              <option value="hot">Hot — Active relationship</option>
              <option value="advocate">Advocate — Champions your brand</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Previous interactions, preferences, do's and don'ts..."
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name || !form.outlet || !form.outletDomain}
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {journalistId ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
