'use client';

/**
 * Onboarding Entry Page — URL-First Design
 *
 * The only required human input: website URL + business name.
 * AI does everything else via the unified pipeline API.
 *
 * Flow:
 *   1. User enters URL + business name
 *   2. Pipeline runs (~15-20s) with animated progress stages
 *   3. On success → navigate to /onboarding/review with pre-filled data
 *
 * Chrome Extension integration: if detected, offers to use current tab URL.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, ArrowRight, Loader2, Sparkles, CheckCircle, AlertCircle, Zap } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';

// ============================================================================
// CONSTANTS
// ============================================================================

const PIPELINE_STAGES = [
  { id: 'scraping', label: 'Scanning your website…', icon: Globe, delay: 0 },
  { id: 'seo', label: 'Analysing SEO signals…', icon: Zap, delay: 3000 },
  { id: 'speed', label: 'Running page speed tests…', icon: Zap, delay: 7000 },
  { id: 'ai', label: 'Extracting brand identity…', icon: Sparkles, delay: 12000 },
  { id: 'social', label: 'Detecting social profiles…', icon: Globe, delay: 16000 },
  { id: 'plan', label: 'Generating your marketing plan…', icon: Sparkles, delay: 19000 },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export default function OnboardingPage() {
  const router = useRouter();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Pipeline state
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Chrome Extension detection
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Check for Chrome Extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNTHEX_EXTENSION_PONG') {
        setExtensionDetected(true);
        if (event.data.currentTabUrl) {
          setExtensionUrl(event.data.currentTabUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    // Ping the extension
    window.postMessage({ type: 'SYNTHEX_EXTENSION_PING' }, '*');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const useExtensionUrl = useCallback(() => {
    if (extensionUrl) {
      setWebsiteUrl(extensionUrl);
      // Try to extract business name from URL
      try {
        const hostname = new URL(extensionUrl).hostname.replace(/^www\./, '');
        const domain = hostname.split('.')[0] ?? '';
        if (domain && !businessName) {
          setBusinessName(domain.charAt(0).toUpperCase() + domain.slice(1));
        }
      } catch {
        // Invalid URL — ignore
      }
    }
  }, [extensionUrl, businessName]);

  const runPipeline = async () => {
    const trimmedUrl = websiteUrl.trim();
    const trimmedName = businessName.trim();

    if (!trimmedUrl || !trimmedName) return;

    // Ensure URL has protocol
    let finalUrl = trimmedUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    setRunning(true);
    setError(null);
    setCurrentStage(0);
    setCompletedStages([]);

    // Stagger loading stage animations
    const newTimers: NodeJS.Timeout[] = [];
    PIPELINE_STAGES.forEach((stage, idx) => {
      if (idx === 0) return; // Start at stage 0 immediately
      const timer = setTimeout(() => {
        setCurrentStage(idx);
        // Mark previous stages as complete
        setCompletedStages((prev) => {
          const newCompleted = [...prev];
          for (let i = 0; i < idx; i++) {
            if (!newCompleted.includes(i)) newCompleted.push(i);
          }
          return newCompleted;
        });
      }, stage.delay);
      newTimers.push(timer);
    });
    timersRef.current = newTimers;

    try {
      const res = await fetch('/api/onboarding/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: finalUrl, businessName: trimmedName }),
      });

      // Clear stagger timers
      newTimers.forEach(clearTimeout);
      timersRef.current = [];

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Pipeline failed. Please try again.');
      }

      const result = await res.json();

      // Store result in sessionStorage for the review page
      sessionStorage.setItem('synthex_pipeline_result', JSON.stringify(result));

      // Mark all stages complete, then navigate
      setCompletedStages(PIPELINE_STAGES.map((_, i) => i));
      setCurrentStage(PIPELINE_STAGES.length);

      // Brief pause to show completion, then navigate
      setTimeout(() => {
        router.push('/onboarding/review');
      }, 800);
    } catch (err) {
      newTimers.forEach(clearTimeout);
      timersRef.current = [];
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setRunning(false);
    }
  };

  const isValid = businessName.trim().length > 0 && websiteUrl.trim().length > 0;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgressV2 currentStep={1} />

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
          <Globe className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white">
          Welcome to SYNTHEX
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Enter your website URL and we&apos;ll set up everything automatically.
          Our AI analyses your business in about 20 seconds.
        </p>
      </div>

      {/* Form or Pipeline Progress */}
      {!running ? (
        <div className="max-w-lg mx-auto space-y-5">
          <div className="p-6 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-5">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-300">
                Business Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Marketing Co"
                className="bg-surface-dark/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                autoFocus
              />
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-gray-300">
                Website URL <span className="text-red-400">*</span>
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isValid && runPipeline()}
                placeholder="https://yoursite.com.au"
                className="bg-surface-dark/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
            </div>

            {/* Chrome Extension hint */}
            {extensionDetected && extensionUrl && (
              <button
                onClick={useExtensionUrl}
                className="w-full p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-left flex items-center gap-3 hover:bg-cyan-500/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-cyan-400 font-medium">Chrome Extension detected</p>
                  <p className="text-xs text-gray-500 truncate max-w-[300px]">
                    Use current tab: {extensionUrl}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-center pt-2">
            <Button
              size="lg"
              onClick={runPipeline}
              disabled={!isValid}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed px-8"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Analyse My Business
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500">
            AI-powered analysis &middot; Takes about 20 seconds
          </p>
        </div>
      ) : (
        /* Pipeline Progress */
        <div className="max-w-lg mx-auto">
          <div className="p-6 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-gray-400">
                Analysing <span className="text-cyan-400 font-medium">{websiteUrl}</span>
              </p>
            </div>

            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isCompleted = completedStages.includes(idx);
                const isCurrent = currentStage === idx && !isCompleted;
                const isPending = currentStage < idx && !isCompleted;
                const Icon = stage.icon;

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all duration-500',
                      isCompleted
                        ? 'bg-cyan-500/5'
                        : isCurrent
                        ? 'bg-cyan-500/10 border border-cyan-500/20'
                        : 'opacity-40',
                    )}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-cyan-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      ) : (
                        <Icon className={cn('w-5 h-5', isPending ? 'text-gray-600' : 'text-gray-400')} />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCompleted ? 'text-cyan-400' : isCurrent ? 'text-white' : 'text-gray-500',
                      )}
                    >
                      {isCompleted ? stage.label.replace('…', ' ✓') : stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pulsing progress bar */}
            <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(((currentStage + 1) / PIPELINE_STAGES.length) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
