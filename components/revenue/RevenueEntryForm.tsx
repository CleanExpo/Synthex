'use client';

/**
 * Revenue Entry Form
 *
 * @description Modal form for adding/editing revenue entries.
 */

import { useState, useEffect } from 'react';
import { X, Loader2 } from '@/components/icons';
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
import { cn } from '@/lib/utils';
import type { RevenueEntry, RevenueSource, CreateRevenueInput } from '@/lib/revenue/revenue-service';

interface RevenueEntryFormProps {
  entry?: RevenueEntry | null;
  onSubmit: (data: CreateRevenueInput) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

const SOURCES: { value: RevenueSource; label: string }[] = [
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'affiliate', label: 'Affiliate Commission' },
  { value: 'ads', label: 'Ad Revenue' },
  { value: 'tips', label: 'Tips & Donations' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  'YouTube',
  'Instagram',
  'TikTok',
  'Twitter',
  'LinkedIn',
  'Facebook',
  'Twitch',
  'Patreon',
  'Ko-fi',
  'Other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'];

function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function RevenueEntryForm({
  entry,
  onSubmit,
  onClose,
  isSubmitting,
}: RevenueEntryFormProps) {
  const isEditing = !!entry;

  // Form state
  const [source, setSource] = useState<RevenueSource>(entry?.source || 'sponsorship');
  const [amount, setAmount] = useState(entry?.amount?.toString() || '');
  const [currency, setCurrency] = useState(entry?.currency || 'USD');
  const [description, setDescription] = useState(entry?.description || '');
  const [platform, setPlatform] = useState(entry?.platform || '');
  const [brandName, setBrandName] = useState(entry?.brandName || '');
  const [paidAt, setPaidAt] = useState(
    entry?.paidAt ? formatDateForInput(entry.paidAt) : formatDateForInput(new Date())
  );
  const [error, setError] = useState<string | null>(null);

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setSource(entry.source);
      setAmount(entry.amount.toString());
      setCurrency(entry.currency);
      setDescription(entry.description || '');
      setPlatform(entry.platform || '');
      setBrandName(entry.brandName || '');
      setPaidAt(formatDateForInput(entry.paidAt));
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!paidAt) {
      setError('Please select a date');
      return;
    }

    try {
      await onSubmit({
        source,
        amount: amountNum,
        currency,
        description: description || undefined,
        platform: platform || undefined,
        brandName: brandName || undefined,
        paidAt: new Date(paidAt),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Revenue Entry' : 'Add Revenue Entry'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as RevenueSource)}>
              <SelectTrigger className="bg-gray-800 border-white/10">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-gray-800 border-white/10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-gray-800 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Brand deal with Nike"
              className="bg-gray-800 border-white/10"
            />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform (optional)</Label>
            <Select value={platform || 'none'} onValueChange={(v) => setPlatform(v === 'none' ? '' : v)}>
              <SelectTrigger className="bg-gray-800 border-white/10">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No platform</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand Name (for sponsorships) */}
          {source === 'sponsorship' && (
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g., Nike, Adidas"
                className="bg-gray-800 border-white/10"
              />
            </div>
          )}

          {/* Paid Date */}
          <div className="space-y-2">
            <Label htmlFor="paidAt">Payment Date</Label>
            <Input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="bg-gray-800 border-white/10"
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn('flex-1', isSubmitting && 'opacity-50')}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                'Update Entry'
              ) : (
                'Add Entry'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RevenueEntryForm;
