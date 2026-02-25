'use client';

/**
 * Website Analyzer Component
 *
 * @description Inline URL input with animated analysis loading state.
 * Used on Step 1 of onboarding to trigger AI website analysis.
 */

import React from 'react';
import { Globe, Loader2, CheckCircle, AlertCircle } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WebsiteAnalyzerProps {
  url: string;
  onUrlChange: (url: string) => void;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string | null;
}

const ANALYSIS_STEPS = [
  'Scanning website content...',
  'Extracting brand identity...',
  'Detecting social accounts...',
  'Analyzing content themes...',
  'Generating business profile...',
];

export function WebsiteAnalyzer({ url, onUrlChange, status, error }: WebsiteAnalyzerProps) {
  const [animationStep, setAnimationStep] = React.useState(0);

  // Cycle through analysis step messages during loading
  React.useEffect(() => {
    if (status !== 'loading') return;

    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % ANALYSIS_STEPS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="space-y-3">
      <Label htmlFor="website-url" className="text-gray-300">
        Website URL
        <span className="text-gray-500 font-normal ml-2">(optional)</span>
      </Label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          <Globe className="w-4 h-4" />
        </div>
        <Input
          id="website-url"
          type="url"
          placeholder="https://your-business.com"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={status === 'loading'}
          className="pl-10 bg-[#0a1628]/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 disabled:opacity-50"
        />
      </div>

      {url && (
        <p className="text-xs text-gray-500">
          We&apos;ll use this to auto-fill your business details with AI
        </p>
      )}

      {/* Loading State */}
      {status === 'loading' && (
        <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
            </div>
            <div>
              <p className="text-sm font-medium text-cyan-300">
                Analyzing your website...
              </p>
              <p className="text-xs text-gray-400 mt-0.5 transition-all duration-300">
                {ANALYSIS_STEPS[animationStep]}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-[#0a1628] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-[2500ms] ease-linear"
              style={{ width: `${((animationStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-300">
              Analysis complete! Review the details on the next step.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && error && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-sm text-amber-300">{error}</p>
          </div>
          <p className="text-xs text-gray-400 mt-1 ml-6">
            You can enter your details manually in the next step.
          </p>
        </div>
      )}
    </div>
  );
}
