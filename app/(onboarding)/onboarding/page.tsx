'use client';

/**
 * Onboarding Entry Page — URL-First Design (SYN-503)
 *
 * The only required human input: business name + website URL.
 * Industry is optional — AI auto-detects it, user can override.
 *
 * Flow (Board Session 3: Client Journey Optimisation — SYN-502):
 *   1. User enters business name + URL (+ optional industry)
 *   2. Pipeline runs (~20s) with animated progress stages
 *   3. Brand Mirror shows extracted brand voice + sample caption
 *   4. "Connect accounts" CTA → /onboarding/connect
 *      OR "edit first" → /onboarding/review (existing flow)
 *
 * Existing users with connected accounts skip directly to dashboard (no change).
 * Chrome Extension integration: if detected, offers to use current tab URL.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Zap,
} from '@/components/icons';
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
import { StepProgressV2, BrandMirror } from '@/components/onboarding';
import { HelpVideo } from '@/components/ui/HelpVideo';
import {
  BRAND_MIRROR_COOKIE,
  SEASONAL_BRIEF_ENABLED,
} from '@/lib/constants/onboarding';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';
import { fireEvent } from '@/lib/analytics/onboarding-events';
import { MascotCard } from '@/components/mascots/MascotCard';
import { useMascot } from '@/hooks/use-mascot';

// ============================================================================
// CONSTANTS
// ============================================================================

const PIPELINE_STAGES = [
  {
    id: 'scraping',
    label: 'Scanning your website…',
    subLabel: 'Reading your pages, copy, and structure',
    icon: Globe,
    delay: 0,
  },
  {
    id: 'seo',
    label: 'Analysing SEO signals…',
    subLabel: 'Checking your search visibility score',
    icon: Zap,
    delay: 3000,
  },
  {
    id: 'speed',
    label: 'Running page speed tests…',
    subLabel: 'Measuring load times and performance metrics',
    icon: Zap,
    delay: 7000,
  },
  {
    id: 'ai',
    label: 'Extracting brand identity…',
    subLabel: 'Identifying colours, tone of voice, and USP',
    icon: Sparkles,
    delay: 12000,
  },
  {
    id: 'social',
    label: 'Detecting social profiles…',
    subLabel: 'Finding your existing audience across platforms',
    icon: Globe,
    delay: 16000,
  },
  {
    id: 'plan',
    label: 'Generating your brand mirror…',
    subLabel: 'Building your brand voice profile',
    icon: Sparkles,
    delay: 19000,
  },
] as const;

const INDUSTRY_OPTIONS = [
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'hospitality', label: 'Hospitality & Food' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'health-wellness', label: 'Health & Wellness' },
  { value: 'trades', label: 'Trades & Construction' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'beauty', label: 'Beauty & Personal Care' },
  { value: 'education', label: 'Education & Training' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
] as const;

type Phase = 'form' | 'scanning' | 'mirror';

// ============================================================================
// COMPONENT
// ============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const { persona: ceoPersna, imageUrl: ceoImageUrl } =
    useMascot('onboarding-welcome');

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');

  // Pipeline / phase state
  const [phase, setPhase] = useState<Phase>('form');
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(
    null
  );

  // Chrome Extension detection
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Cleanup timers and abort controller on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
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

    setPhase('scanning');
    setError(null);
    setCurrentStage(0);
    setCompletedStages([]);

    fireEvent('onboarding_form_submitted');
    fireEvent('brand_scan_initiated');

    const scanStart = Date.now();

    // Stagger loading stage animations
    const newTimers: NodeJS.Timeout[] = [];
    PIPELINE_STAGES.forEach((stage, idx) => {
      if (idx === 0) return; // Start at stage 0 immediately
      const timer = setTimeout(() => {
        setCurrentStage(idx);
        // Mark previous stages as complete
        setCompletedStages(prev => {
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

    // Set up 45s client-side timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const clientTimeout = setTimeout(() => {
      abortController.abort();
    }, 45000);
    timeoutRef.current = clientTimeout;

    try {
      const res = await fetch('/api/onboarding/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: finalUrl,
          businessName: trimmedName,
          ...(industry && { industry }),
        }),
        signal: abortController.signal,
      });

      // Clear stagger timers and client timeout
      newTimers.forEach(clearTimeout);
      timersRef.current = [];
      clearTimeout(clientTimeout);
      timeoutRef.current = null;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Pipeline failed. Please try again.');
      }

      const result: PipelineResult = await res.json();

      // Store result in sessionStorage for the review page
      sessionStorage.setItem('synthex_pipeline_result', JSON.stringify(result));

      // Persist to server (fire-and-forget) so data survives sessionStorage loss
      fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result),
      }).catch(() => {
        // Non-blocking — review page will fall back to server or redirect to entry
      });

      // Mark all stages complete
      setCompletedStages(PIPELINE_STAGES.map((_, i) => i));
      setCurrentStage(PIPELINE_STAGES.length);

      const scanDuration = Math.round((Date.now() - scanStart) / 1000);
      fireEvent('brand_scan_complete', {
        confidence_score: result.confidence,
        scan_duration_seconds: scanDuration,
      });

      // Brief pause to show completion, then show Brand Mirror
      setTimeout(() => {
        setPipelineResult(result);
        setPhase('mirror');

        if (result.confidence < 60) {
          fireEvent('brand_mirror_fallback_shown', {
            confidence_score: result.confidence,
          });
        } else {
          fireEvent('brand_mirror_shown');
        }
      }, 800);
    } catch (err) {
      newTimers.forEach(clearTimeout);
      timersRef.current = [];
      clearTimeout(clientTimeout);
      timeoutRef.current = null;

      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError';
      setError(
        isTimeout
          ? 'Analysis is taking longer than usual. This can happen with complex websites. Try again, or skip this step.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.'
      );
      setPhase('form');
    }
  };

  // Brand Mirror — "connect accounts" CTA
  const handleMirrorContinue = () => {
    // Set the brand mirror viewed cookie (1 hour) — read by SYN-504 routing gate
    document.cookie = `${BRAND_MIRROR_COOKIE}=1; path=/; max-age=3600; SameSite=Lax`;
    // SYN-548: insert Season Brief screen between Brand Mirror and Connect Accounts
    router.push(
      SEASONAL_BRIEF_ENABLED
        ? '/onboarding/season-brief'
        : '/onboarding/connect'
    );
  };

  // Brand Mirror — "edit first" fallback → existing review page
  const handleMirrorSkip = () => {
    router.push('/onboarding/review');
  };

  const isValid =
    businessName.trim().length > 0 && websiteUrl.trim().length > 0;

  // ── Brand Mirror phase ───────────────────────────────────────────────
  if (phase === 'mirror' && pipelineResult) {
    return (
      <div className="space-y-8">
        <StepProgressV2 currentStep={1} />
        <BrandMirror
          result={pipelineResult}
          onContinue={handleMirrorContinue}
          onSkip={handleMirrorSkip}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgressV2 currentStep={1} />

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
          <Globe className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white">Welcome to SYNTHEX</h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Enter your website URL and we&apos;ll set up everything automatically.
          Our AI analyses your business in about 20 seconds.
        </p>
        {/* Tutorial shortcuts — preview the upcoming setup steps */}
        <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
          <HelpVideo videoId="onboarding-connect-social" />
          <HelpVideo videoId="onboarding-connect-gmb" />
          <HelpVideo videoId="onboarding-setup-ai" />
        </div>
        {/* CEO mascot welcome */}
        <div className="flex justify-center pt-2">
          <MascotCard
            persona={ceoPersna}
            imageUrl={ceoImageUrl}
            variant="compact"
            className="max-w-xs text-left"
          />
        </div>
      </div>

      {/* Form or Pipeline Progress */}
      {phase === 'form' ? (
        <div className="max-w-lg mx-auto space-y-5">
          <div className="p-6 rounded-xl bg-surface-base/80 border border-orange-500/10 backdrop-blur-sm space-y-5">
            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-gray-300">
                Business Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Marketing Co"
                className="bg-surface-dark/50 border-orange-500/20 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
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
                onChange={e => setWebsiteUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && isValid && runPipeline()}
                placeholder="https://yoursite.com.au"
                className="bg-surface-dark/50 border-orange-500/20 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
              />
            </div>

            {/* Industry — optional, helps AI analyse your brand */}
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-gray-300">
                Industry{' '}
                <span className="text-gray-500 text-xs font-normal">
                  (optional — AI will detect it)
                </span>
              </Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger
                  id="industry"
                  className="bg-surface-dark/50 border-orange-500/20 text-white focus:border-orange-500/50 focus:ring-orange-500/20 data-[placeholder]:text-gray-500"
                >
                  <SelectValue placeholder="Select your industry…" />
                </SelectTrigger>
                <SelectContent className="bg-surface-dark border-orange-500/20">
                  {INDUSTRY_OPTIONS.map(opt => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-gray-200 focus:bg-orange-500/10 focus:text-white"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chrome Extension hint */}
            {extensionDetected && extensionUrl && (
              <button
                onClick={useExtensionUrl}
                className="w-full p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 text-left flex items-center gap-3 hover:bg-orange-500/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-orange-400 font-medium">
                    Chrome Extension detected
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[300px]">
                    Use current tab: {extensionUrl}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <div className="flex items-center gap-3 pl-6">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    runPipeline();
                  }}
                  className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  Try again
                </Button>
                <button
                  onClick={() => router.push('/onboarding/review')}
                  className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                >
                  Skip analysis
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-center pt-2">
            <Button
              size="lg"
              onClick={runPipeline}
              disabled={!isValid}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed px-8"
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
        /* Pipeline Progress (phase === 'scanning') */
        <div className="max-w-lg mx-auto">
          <div className="p-6 rounded-xl bg-surface-base/80 border border-orange-500/10 backdrop-blur-sm space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-gray-400">
                Analysing{' '}
                <span className="text-orange-400 font-medium">
                  {websiteUrl}
                </span>
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
                        ? 'bg-orange-500/5'
                        : isCurrent
                          ? 'bg-orange-500/10 border border-orange-500/20'
                          : 'opacity-40'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-orange-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      ) : (
                        <Icon
                          className={cn(
                            'w-5 h-5',
                            isPending ? 'text-gray-600' : 'text-gray-400'
                          )}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isCompleted
                            ? 'text-orange-400'
                            : isCurrent
                              ? 'text-white'
                              : 'text-gray-500'
                        )}
                      >
                        {isCompleted
                          ? stage.label.replace('…', ' ✓')
                          : stage.label}
                      </span>
                      {(isCurrent || isCompleted) && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {stage.subLabel}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pulsing progress bar */}
            <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-1000 ease-out"
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
