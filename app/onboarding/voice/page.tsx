'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2 } from '@/components/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WizardAnswers {
  industry: string;
  targetCustomer: string;
  differentiator: string;
  tone: string;
  firstPostTopic: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step data
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const INDUSTRY_OPTIONS = [
  { value: 'trades', label: 'Trades', emoji: '🔧' },
  { value: 'cafe', label: 'Café/Restaurant', emoji: '☕' },
  { value: 'salon', label: 'Salon/Beauty', emoji: '💇' },
  { value: 'gym', label: 'Gym/Fitness', emoji: '💪' },
  { value: 'clinic', label: 'Medical/Dental Clinic', emoji: '🏥' },
  { value: 'retail', label: 'Retail Shop', emoji: '🛍️' },
] as const;

const TONE_OPTIONS = [
  { value: 'friendly', label: 'Friendly & Approachable' },
  { value: 'professional', label: 'Professional & Expert' },
  { value: 'bold', label: 'Bold & Confident' },
  { value: 'warm', label: 'Warm & Caring' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function VoiceOnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answers, setAnswers] = useState<WizardAnswers>({
    industry: '',
    targetCustomer: '',
    differentiator: '',
    tone: '',
    firstPostTopic: '',
  });

  // ─── Navigation helpers ───────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    switch (step) {
      case 1:
        return answers.industry.length > 0;
      case 2:
        return answers.targetCustomer.trim().length >= 2;
      case 3:
        return answers.differentiator.trim().length >= 2;
      case 4:
        return answers.tone.length > 0;
      case 5:
        return answers.firstPostTopic.trim().length >= 2;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(answers),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      router.push('/dashboard/content?onboarded=1');
    } catch {
      // Non-fatal toast would go here; for now just re-enable the button
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              What type of business do you run?
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {INDUSTRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setAnswers(a => ({ ...a, industry: opt.value }))
                  }
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors',
                    answers.industry === opt.value
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/80'
                  )}
                >
                  <span className="text-2xl" role="img" aria-label={opt.label}>
                    {opt.emoji}
                  </span>
                  <span className="text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Who is your ideal customer?
            </h2>
            <Input
              value={answers.targetCustomer}
              onChange={e =>
                setAnswers(a => ({ ...a, targetCustomer: e.target.value }))
              }
              placeholder="e.g. Busy homeowners in Sydney's inner west who need reliable tradespeople"
              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50 focus:ring-orange-500/20"
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              What makes you different?
            </h2>
            <Textarea
              value={answers.differentiator}
              onChange={e =>
                setAnswers(a => ({ ...a, differentiator: e.target.value }))
              }
              placeholder="e.g. Same-day service with upfront pricing — no surprises"
              rows={4}
              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50 focus:ring-orange-500/20 resize-none"
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              What&apos;s your brand voice?
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TONE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswers(a => ({ ...a, tone: opt.value }))}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-sm text-left transition-colors',
                    answers.tone === opt.value
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              What do you want your first post to be about?
            </h2>
            <Textarea
              value={answers.firstPostTopic}
              onChange={e =>
                setAnswers(a => ({ ...a, firstPostTopic: e.target.value }))
              }
              placeholder="e.g. We just completed a bathroom renovation in Parramatta — here's the reveal"
              rows={4}
              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50 focus:ring-orange-500/20 resize-none"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-orange-500">
            Synthex
          </p>
          <h1 className="text-2xl font-bold text-white">
            Let&apos;s set up your account
          </h1>
          <p className="text-sm text-white/40">
            5 quick questions to personalise your content
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                i < step ? 'bg-orange-500' : 'bg-white/10'
              )}
            />
          ))}
        </div>

        {/* Step counter */}
        <p className="text-xs text-white/30 text-right">
          Step {step} of {TOTAL_STEPS}
        </p>

        {/* Step card */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className="text-white/50 hover:text-white hover:bg-white/[0.05]"
          >
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40"
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canAdvance() || isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 min-w-[160px]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Get my first post'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
