'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, AlertCircle } from '@/components/icons';
import type { ConnectDialogProps } from './types';

export function ConnectDialog({
  open,
  onOpenChange,
  provider,
  providerName,
  requiredFields,
  oauthSupported,
  onSubmit,
}: ConnectDialogProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // Validate required fields for non-OAuth providers
    if (!oauthSupported) {
      const missing = requiredFields.filter((f) => !formValues[f]?.trim());
      if (missing.length > 0) {
        setError(`Please fill in: ${missing.join(', ')}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(formValues);
      setFormValues({});
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormValues({});
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const fieldLabels: Record<string, string> = {
    accessToken: 'Access Token',
    apiKey: 'API Key',
    webhookUrl: 'Webhook URL',
    refreshToken: 'Refresh Token',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent variant="glass">
        <DialogHeader>
          <DialogTitle>Connect {providerName}</DialogTitle>
          <DialogDescription>
            {oauthSupported
              ? `Authorize Synthex to connect with your ${providerName} account.`
              : `Enter your ${providerName} credentials to connect.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {oauthSupported ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Click the button below to authorize access via {providerName}&apos;s secure OAuth flow.
              </p>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full gradient-primary text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Authorize with {providerName}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {requiredFields.map((field) => (
                <div key={field} className="space-y-2">
                  <label
                    htmlFor={`${provider}-${field}`}
                    className="text-sm font-medium text-gray-300"
                  >
                    {fieldLabels[field] || field}
                  </label>
                  <input
                    id={`${provider}-${field}`}
                    type={field.toLowerCase().includes('key') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                    value={formValues[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter your ${fieldLabels[field] || field}`}
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {!oauthSupported && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gradient-primary text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
