'use client';

/**
 * Investment Form
 *
 * @description Modal form for adding/editing investments.
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
import type {
  ContentInvestment,
  InvestmentType,
  InvestmentCategory,
  CreateInvestmentInput,
} from '@/lib/roi/roi-service';

interface InvestmentFormProps {
  entry?: ContentInvestment | null;
  onSubmit: (data: CreateInvestmentInput) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

const TYPES: { value: InvestmentType; label: string; description: string }[] = [
  { value: 'time', label: 'Time', description: 'Hours spent on content' },
  { value: 'money', label: 'Money', description: 'Financial investment' },
];

const CATEGORIES: { value: InvestmentCategory; label: string }[] = [
  { value: 'creation', label: 'Content Creation' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'software', label: 'Software & Tools' },
  { value: 'promotion', label: 'Promotion & Ads' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  'YouTube',
  'Instagram',
  'TikTok',
  'Twitter',
  'LinkedIn',
  'Facebook',
  'Pinterest',
  'Reddit',
  'Threads',
  'Other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'];

function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function InvestmentForm({
  entry,
  onSubmit,
  onClose,
  isSubmitting,
}: InvestmentFormProps) {
  const isEditing = !!entry;

  // Form state
  const [type, setType] = useState<InvestmentType>(entry?.type || 'time');
  const [category, setCategory] = useState<InvestmentCategory>(entry?.category || 'creation');
  const [amount, setAmount] = useState(entry?.amount?.toString() || '');
  const [currency, setCurrency] = useState(entry?.currency || 'USD');
  const [description, setDescription] = useState(entry?.description || '');
  const [platform, setPlatform] = useState(entry?.platform || '');
  const [investedAt, setInvestedAt] = useState(
    entry?.investedAt ? formatDateForInput(entry.investedAt) : formatDateForInput(new Date())
  );
  const [error, setError] = useState<string | null>(null);

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setType(entry.type);
      setCategory(entry.category);
      setAmount(entry.amount.toString());
      setCurrency(entry.currency || 'USD');
      setDescription(entry.description || '');
      setPlatform(entry.platform || '');
      setInvestedAt(formatDateForInput(entry.investedAt));
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

    if (!investedAt) {
      setError('Please select a date');
      return;
    }

    try {
      await onSubmit({
        type,
        category,
        amount: amountNum,
        currency: type === 'money' ? currency : undefined,
        description: description || undefined,
        platform: platform || undefined,
        investedAt: new Date(investedAt),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save investment');
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
            {isEditing ? 'Edit Investment' : 'Add Investment'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close form"
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Investment Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    type === t.value
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-white/10 bg-gray-800 hover:border-white/20'
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    type === t.value ? 'text-cyan-400' : 'text-white'
                  )}>
                    {t.label}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as InvestmentCategory)}>
              <SelectTrigger className="bg-gray-800 border-white/10">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount + Currency (for money type) */}
          <div className={cn('grid gap-3', type === 'money' ? 'grid-cols-3' : 'grid-cols-1')}>
            <div className={cn('space-y-2', type === 'money' ? 'col-span-2' : '')}>
              <Label htmlFor="amount">
                {type === 'time' ? 'Hours' : 'Amount'}
              </Label>
              <Input
                id="amount"
                type="number"
                step={type === 'time' ? '0.25' : '0.01'}
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={type === 'time' ? 'e.g., 2.5' : '0.00'}
                className="bg-gray-800 border-white/10"
                required
              />
            </div>
            {type === 'money' && (
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
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'time' ? 'e.g., Editing YouTube video' : 'e.g., Camera equipment'}
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

          {/* Investment Date */}
          <div className="space-y-2">
            <Label htmlFor="investedAt">Date</Label>
            <Input
              id="investedAt"
              type="date"
              value={investedAt}
              onChange={(e) => setInvestedAt(e.target.value)}
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
                'Update Investment'
              ) : (
                'Add Investment'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InvestmentForm;
