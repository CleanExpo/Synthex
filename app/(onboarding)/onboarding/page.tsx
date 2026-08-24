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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BrandMirror, OnboardingSplit } from '@/components/onboarding';
import { HelpVideo } from '@/components/ui/HelpVideo';
import {
  BRAND_MIRROR_COOKIE,
  SEASONAL_BRIEF_ENABLED,
} from '@/lib/constants/onboarding';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';
import { fireEvent } from '@/lib/analytics/onboarding-events';
import { MascotCard } from '@/components/mascots/MascotCard';
import { useMascot } from '@/hooks/use-mascot';
import { toast } from 'sonner';

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
  const [description, setDescription] = useState('');

  // Pipeline / phase state
  const [phase, setPhase] = useState<Phase>('form');
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  // SYN-1022: message shown after a name-only discovery pass (confirm/choose URL).
  const [discoveryNotice, setDiscoveryNotice] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(
    null
  );

  // Chrome Extension detection
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);

  // Completion guard — true until we confirm the user has NOT already finished
  // onboarding. Prevents flashing the empty "Analyse My Business" form to a
  // returning user before the redirect to /dashboard lands (see effect below).
  const [checkingComplete, setCheckingComplete] = useState(true);

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Completion guard — a user who has already completed onboarding must not be
  // re-onboarded. Without this, landing on /onboarding (bookmark, browser back,
  // or the post-login redirect) shows the empty entry form again, dead-ending a
  // returning user and risking a duplicate org/persona if they re-run the flow.
  // Honour the docstring contract: existing users skip directly to the dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/user', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.user?.onboardingComplete === true) {
            router.replace('/dashboard');
            return; // keep the spinner up while the redirect lands
          }
        }
      } catch {
        // Non-fatal — fall through and show the onboarding form
      }
      if (!cancelled) setCheckingComplete(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

    if (!trimmedName) return;

    // Ensure URL has protocol (only when a URL was supplied)
    let finalUrl = trimmedUrl;
    if (
      finalUrl &&
      !finalUrl.startsWith('http://') &&
      !finalUrl.startsWith('https://')
    ) {
      finalUrl = `https://${finalUrl}`;
    }

    setPhase('scanning');
    setError(null);
    setDiscoveryNotice(null);
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
    }, 30000);
    timeoutRef.current = clientTimeout;

    try {
      const res = await fetch('/api/onboarding/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(finalUrl && { url: finalUrl }),
          businessName: trimmedName,
          ...(industry && { industry }),
          ...(description.trim() && { description: description.trim() }),
        }),
        signal: abortController.signal,
      });

      // Clear stagger timers and client timeout
      newTimers.forEach(clearTimeout);
      timersRef.current = [];
      clearTimeout(clientTimeout);
      timeoutRef.current = null;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Pipeline failed. Please try again.');
      }

      const data = await res.json();

      // Name-only discovery response (SYN-1022): no profile scraped yet —
      // confirm or choose a URL, then re-submit to run the full pipeline.
      if (data?.mode === 'discovery') {
        const d = data.discovery;
        setPhase('form');
        if (d?.status === 'resolved' && d.url) {
          setWebsiteUrl(d.url);
          setDiscoveryNotice(
            `We found ${d.url}. Press "Analyse My Business" again to confirm and scan it.`
          );
        } else if (d?.status === 'review' && d.candidates?.length) {
          setWebsiteUrl(d.candidates[0].url);
          setDiscoveryNotice(
            `We found a few possible sites and picked ${d.candidates[0].url}. Edit the URL if that's not right, then press "Analyse My Business" again.`
          );
        } else {
          setDiscoveryNotice(
            "We couldn't find your website automatically. Please enter your website URL to continue."
          );
        }
        return;
      }

      const result: PipelineResult = data;

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
          ? 'Analysis is taking longer than usual. This can happen with complex websites. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.'
      );
      setPhase('form');
    }
  };

  // Brand Mirror — persist org + analysis, then connect accounts
  const handleMirrorContinue = async () => {
    document.cookie = `${BRAND_MIRROR_COOKIE}=1; path=/; max-age=3600; SameSite=Lax`;
    if (pipelineResult) {
      try {
        await fetch('/api/onboarding/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            businessName: pipelineResult.businessName,
            industry: pipelineResult.industry,
            teamSize: pipelineResult.teamSize,
            description: pipelineResult.description,
            brandColours: pipelineResult.brandColours,
            socialProfiles: pipelineResult.socialProfiles,
            seoScore: pipelineResult.seoScore,
            pageSpeed: pipelineResult.pageSpeed,
            overallHealth: pipelineResult.overallHealth,
            quickWins: pipelineResult.quickWins,
            contentGaps: pipelineResult.contentGaps,
            keyTopics: pipelineResult.keyTopics,
            targetAudience: pipelineResult.targetAudience,
            suggestedTone: pipelineResult.suggestedTone,
            suggestedPersonaName: pipelineResult.suggestedPersonaName,
            structuredData: pipelineResult.structuredData,
            logoUrl: pipelineResult.logoUrl,
            faviconUrl: pipelineResult.faviconUrl,
            url: pipelineResult.url,
          }),
        });
      } catch {
        toast.error(
          'Could not save your analysis. You can still continue — we will retry on finish.'
        );
      }
    }
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

  // Scan phase — cancel returns to the form. Incomplete users cannot leave
  // onboarding for the dashboard (proxy + layout also bounce them back).
  const handleScanSkip = () => {
    fireEvent('onboarding_skipped');
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPhase('form');
    setCurrentStage(0);
    setCompletedStages([]);
    setError(null);
  };

  // URL is optional (SYN-1022): a name alone triggers website discovery.
  const isValid = businessName.trim().length > 0;

  // ── Completion guard — show a spinner while we confirm the user hasn't
  //     already finished onboarding (avoids flashing the form before redirect).
  if (checkingComplete) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    );
  }

  // ── Brand Mirror phase ───────────────────────────────────────────────
  if (phase === 'mirror' && pipelineResult) {
    return (
      <OnboardingSplit
        currentStep={1}
        eyebrow="Brand mirror"
        title="Here's what we found"
        description="Confirm your brand voice before connecting platforms."
      >
        <BrandMirror
          result={pipelineResult}
          onContinue={handleMirrorContinue}
          onSkip={handleMirrorSkip}
        />
      </OnboardingSplit>
    );
  }

  return (
    <OnboardingSplit
      currentStep={1}
      eyebrow="Step 1 · Your website"
      title="Welcome to Synthex"
      description="Tell us about your business. We'll analyse the site and set up your workspace — usually about 15 seconds."
      aside={
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-2">
            <HelpVideo videoId="onboarding-connect-social" />
            <HelpVideo videoId="onboarding-connect-gmb" />
            <HelpVideo videoId="onboarding-setup-ai" />
          </div>
          <MascotCard
            persona={ceoPersna}
            imageUrl={ceoImageUrl}
            variant="compact"
            className="max-w-sm text-left"
          />
        </div>
      }
    >
      {/* Form or Pipeline Progress */}
      {phase === 'form' ? (
        <div className="space-y-5 w-full">
          <div className="p-6 sm:p-8 lg:p-10 rounded-sm bg-white/1 border-[0.5px] border-white/6 space-y-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-sm bg-orange-500/15 border-[0.5px] border-orange-500/30 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                  Business profile
                </p>
                <p className="text-sm text-white/55 font-light">
                  Required: name · Optional: description, URL, industry
                </p>
              </div>
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <Label
                htmlFor="businessName"
                className="text-white/70 text-sm font-light"
              >
                Business name <span className="text-orange-400">*</span>
              </Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Marketing Co"
                className="h-11 rounded-sm bg-black/30 border-white/10 text-white placeholder:text-white/30 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                autoFocus
              />
            </div>

            {/* Description — optional */}
            <div className="space-y-2">
              <Label
                htmlFor="businessDescription"
                className="text-white/70 text-sm font-light"
              >
                Description{' '}
                <span className="text-white/35 text-xs font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="businessDescription"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does your business do? Who do you serve?"
                rows={3}
                maxLength={2000}
                className="rounded-sm bg-black/30 border-white/10 text-white placeholder:text-white/30 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20 resize-y min-h-[88px]"
              />
              <p className="text-xs text-white/30 text-right tabular-nums">
                {description.length}/2000
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Website URL */}
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="websiteUrl"
                  className="text-white/70 text-sm font-light"
                >
                  Website URL{' '}
                  <span className="text-white/35 text-xs font-normal">
                    (optional — we&apos;ll find it from your name)
                  </span>
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && isValid && runPipeline()}
                  placeholder="https://yoursite.com.au"
                  className="h-11 rounded-sm bg-black/30 border-white/10 text-white placeholder:text-white/30 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20"
                />
              </div>

              {/* Industry */}
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="industry"
                  className="text-white/70 text-sm font-light"
                >
                  Industry{' '}
                  <span className="text-white/35 text-xs font-normal">
                    (optional — AI will detect it)
                  </span>
                </Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger
                    id="industry"
                    className="h-11 rounded-sm bg-black/30 border-white/10 text-white focus:border-orange-500/50 focus:ring-orange-500/20 data-[placeholder]:text-white/30"
                  >
                    <SelectValue placeholder="Select your industry…" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-dark border-white/10 rounded-sm">
                    {INDUSTRY_OPTIONS.map(opt => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-white/80 focus:bg-orange-500/10 focus:text-white rounded-sm"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chrome Extension hint */}
            {extensionDetected && extensionUrl && (
              <button
                onClick={useExtensionUrl}
                className="w-full p-3 rounded-sm bg-orange-500/5 border-[0.5px] border-orange-500/20 text-left flex items-center gap-3 hover:bg-orange-500/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-sm bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-orange-400 font-medium">
                    Chrome Extension detected
                  </p>
                  <p className="text-xs text-white/40 truncate max-w-[420px]">
                    Use current tab: {extensionUrl}
                  </p>
                </div>
              </button>
            )}
          </div>

          {/* Discovery notice (SYN-1022) */}
          {discoveryNotice && (
            <div className="p-4 rounded-sm bg-orange-500/10 border-[0.5px] border-orange-500/20 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-200">{discoveryNotice}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-sm bg-red-500/10 border-[0.5px] border-red-500/20 space-y-3">
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
                  className="text-xs rounded-sm border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  Try again
                </Button>
                <button
                  onClick={() => router.push('/onboarding/review')}
                  className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                >
                  Skip analysis
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <p className="text-xs text-white/35">
              AI-powered analysis &middot; Takes about 20 seconds
            </p>
            <Button
              size="lg"
              onClick={runPipeline}
              disabled={!isValid}
              className="bg-orange-500 hover:bg-orange-400 text-black shadow-none rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-8 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Analyse my business
            </Button>
          </div>
        </div>
      ) : (
        /* Pipeline Progress (phase === 'scanning') */
        <div className="w-full">
          <div className="p-6 sm:p-8 lg:p-10 rounded-sm bg-white/1 border-[0.5px] border-white/6 space-y-4">
            <div className="mb-2">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35 mb-1">
                Analysing
              </p>
              <p className="text-sm text-white/55">
                <span className="text-orange-400 font-medium">
                  {websiteUrl || businessName}
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
                      'flex items-center gap-3 p-3 rounded-sm transition-all duration-500',
                      isCompleted
                        ? 'bg-orange-500/5'
                        : isCurrent
                          ? 'bg-orange-500/10 border-[0.5px] border-orange-500/20'
                          : 'opacity-40'
                    )}
                  >
                    <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-orange-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      ) : (
                        <Icon
                          className={cn(
                            'w-5 h-5',
                            isPending ? 'text-white/25' : 'text-white/40'
                          )}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm font-light',
                          isCompleted
                            ? 'text-orange-400'
                            : isCurrent
                              ? 'text-white'
                              : 'text-white/40'
                        )}
                      >
                        {isCompleted
                          ? stage.label.replace('…', ' ✓')
                          : stage.label}
                      </span>
                      {(isCurrent || isCompleted) && (
                        <p className="text-xs text-white/35 mt-0.5">
                          {stage.subLabel}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pulsing progress bar */}
            <div className="mt-4 h-1 bg-white/5 rounded-sm overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-sm transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(((currentStage + 1) / PIPELINE_STAGES.length) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Cancel analysis — stay on onboarding; dashboard is blocked until complete */}
          <div className="mt-5">
            <button
              onClick={handleScanSkip}
              className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
            >
              Cancel analysis
            </button>
          </div>
        </div>
      )}
    </OnboardingSplit>
  );
}
