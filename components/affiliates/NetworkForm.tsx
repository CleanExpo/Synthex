'use client';

/**
 * Network Form
 *
 * @description Modal form for adding/editing affiliate networks.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Globe, Loader2 } from '@/components/icons';
import type { AffiliateNetwork, CreateNetworkInput, UpdateNetworkInput } from '@/hooks/useAffiliateLinks';
import { NETWORK_SLUGS, NETWORK_LABELS, NETWORK_COLORS, type NetworkSlug } from '@/hooks/useAffiliateLinks';

interface NetworkFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateNetworkInput | UpdateNetworkInput) => Promise<void>;
  network?: AffiliateNetwork | null;
  isLoading?: boolean;
}

export function NetworkForm({
  isOpen,
  onClose,
  onSubmit,
  network,
  isLoading,
}: NetworkFormProps) {
  const isEditing = !!network;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState<NetworkSlug>('amazon');
  const [trackingId, setTrackingId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Reset form when network changes
  useEffect(() => {
    if (network) {
      setName(network.name);
      setSlug(network.slug as NetworkSlug);
      setTrackingId(network.trackingId || '');
      setApiKey(network.apiKey || '');
      setCommissionRate(network.commissionRate?.toString() || '');
      setIsActive(network.isActive);
    } else {
      setName('');
      setSlug('amazon');
      setTrackingId('');
      setApiKey('');
      setCommissionRate('');
      setIsActive(true);
    }
  }, [network, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateNetworkInput | UpdateNetworkInput = {
      name,
      ...(isEditing ? {} : { slug }),
      trackingId: trackingId || undefined,
      apiKey: apiKey || undefined,
      commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      isActive,
    };

    await onSubmit(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-950 border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Network' : 'Add Network'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Amazon Account"
              required
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* Network Type */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Network *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {NETWORK_SLUGS.map((s) => {
                  const color = NETWORK_COLORS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlug(s)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                        slug === s
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <Globe className="h-5 w-5" style={{ color }} />
                      <span className="text-xs text-white/70">{NETWORK_LABELS[s]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tracking ID */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Tracking/Affiliate ID
            </label>
            <input
              type="text"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="Your affiliate ID"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              API Key (optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="For automated reporting"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* Commission Rate */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Default Commission Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="e.g., 5.00"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-white/70">Active</span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                isActive ? 'bg-cyan-600' : 'bg-white/20'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                  isActive && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600/50 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Network'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NetworkForm;
