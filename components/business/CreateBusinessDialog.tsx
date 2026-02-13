'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X } from '@/components/icons';

interface CreateBusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateBusinessDialog({ open, onOpenChange, onCreated }: CreateBusinessDialogProps) {
  const [businessName, setBusinessName] = useState('');
  const [displayLabel, setDisplayLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Business name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: businessName.trim(),
          displayName: displayLabel.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create business');
      }

      // Reset form
      setBusinessName('');
      setDisplayLabel('');
      setError(null);

      // Notify parent and close
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setBusinessName('');
      setDisplayLabel('');
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-gray-950 border border-cyan-500/10">
        <CardHeader className="border-b border-cyan-500/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-white">
              Create New Business
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-8 w-8 p-0 hover:bg-cyan-500/10"
            >
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business Name Field */}
            <div className="space-y-2">
              <label htmlFor="businessName" className="text-sm font-medium text-white">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Corporation"
                className="w-full px-3 py-2 bg-[#0f172a]/80 border border-cyan-500/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-gray-500">
                This will be used as your organization name
              </p>
            </div>

            {/* Display Label Field */}
            <div className="space-y-2">
              <label htmlFor="displayLabel" className="text-sm font-medium text-white">
                Display Label <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                id="displayLabel"
                type="text"
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                placeholder="Acme Corp - Marketing"
                className="w-full px-3 py-2 bg-[#0f172a]/80 border border-cyan-500/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                A friendly name to help you identify this business
              </p>
            </div>

            {/* Pricing Notice */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Plus className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Additional Business Pricing</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Each additional business is <span className="text-cyan-400 font-semibold">$249/month</span>.
                    You can manage billing in your account settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
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
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 bg-transparent border-cyan-500/10 text-white hover:bg-cyan-500/10 hover:border-cyan-500/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !businessName.trim()}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Business
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
