'use client';

/**
 * Activation Checklist Component
 *
 * 5-step onboarding sequence that gates the automation flywheel.
 * Once all 5 steps are complete, Synthex can run fully autonomous
 * campaigns for the client.
 *
 * Steps:
 *   1. URL Health Check     → business website audited, BrandDNA created
 *   2. Social Connection    → at least one social platform connected
 *   3. GMB Connection       → Google Business Profile connected
 *   4. LLM Integration      → AI provider key configured
 *   5. Generate First Post  → first piece of content created
 *
 * @see UNI-1615 First-time user activation checklist
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Rocket,
  CheckCircle,
  X,
  ChevronRight,
  Globe,
  Link2,
  MapPin,
  BrainCircuit,
  Sparkles,
} from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import type { ChecklistStatus } from '@/app/api/onboarding/checklist/route';
import { HelpVideo } from '@/components/ui/HelpVideo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>;

interface ChecklistStep {
  id: keyof ChecklistStatus;
  title: string;
  description: string;
  href: string;
  icon: IconComponent;
  completed: boolean;
  videoId?: string;
  toastOnComplete?: {
    message: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'synthex_activation_dismissed';
const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GetStartedChecklist({ className }: { className?: string }) {
  const { status, completedCount, allComplete, isLoading } =
    useActivationChecklist();
  const [dismissed, setDismissed] = useState<boolean>(true);
  const router = useRouter();

  const prevStatus = useRef<ChecklistStatus | null>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === 'true');
    } catch {
      setDismissed(false);
    }
    hasMounted.current = true;
  }, []);

  // Fire toasts when individual steps flip to complete
  useEffect(() => {
    if (!hasMounted.current || !prevStatus.current) {
      prevStatus.current = status;
      return;
    }

    const prev = prevStatus.current;

    if (!prev.social_connection && status.social_connection) {
      toast.success('Social platform connected!', {
        description: "Now let's connect your Google Business Profile.",
        action: {
          label: 'Connect GMB',
          onClick: () => router.push('/dashboard/platforms'),
        },
        duration: 6000,
      });
    }
    if (!prev.gmb_connection && status.gmb_connection) {
      toast.success('Google Business Profile connected!', {
        description: 'Configure your AI integration next.',
        action: {
          label: 'Set up AI',
          onClick: () => router.push('/dashboard/settings/integrations'),
        },
        duration: 6000,
      });
    }
    if (!prev.llm_integration && status.llm_integration) {
      toast.success('AI integration ready!', {
        description: 'Time to generate your first post.',
        action: {
          label: 'Create Post',
          onClick: () => router.push('/dashboard/content'),
        },
        duration: 6000,
      });
    }
    if (!prev.first_post && status.first_post) {
      toast.success('First post created! The automation flywheel is ready.', {
        description:
          'Synthex can now run autonomous campaigns for your client.',
        duration: 8000,
        icon: <Sparkles className="h-5 w-5 text-orange-400" />,
      });
    }

    prevStatus.current = status;
  }, [status, router]);

  const handleDismiss = useCallback(() => {
    if (completedCount === 0) {
      toast.info('Complete at least one step before dismissing.', {
        description: 'These steps unlock the full Synthex automation flywheel.',
        duration: 3000,
      });
      return;
    }
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Silently fail
    }
  }, [completedCount]);

  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        id: 'url_health_check',
        title: 'URL Health Check',
        description:
          'Run a brand audit on your website to extract colours, tone, and audience insights.',
        href: '/dashboard/onboarding',
        icon: Globe,
        completed: status.url_health_check,
      },
      {
        id: 'social_connection',
        title: 'Connect a Social Media Account',
        description:
          'Link Instagram, LinkedIn, Facebook, TikTok, or another platform to start publishing.',
        href: '/dashboard/platforms',
        icon: Link2,
        completed: status.social_connection,
        videoId: 'onboarding-connect-social',
      },
      {
        id: 'gmb_connection',
        title: 'Connect Google Business Profile',
        description:
          'Link your GMB listing to manage reviews, posts, and local search presence.',
        href: '/dashboard/platforms',
        icon: MapPin,
        completed: status.gmb_connection,
        videoId: 'onboarding-connect-gmb',
      },
      {
        id: 'llm_integration',
        title: 'Configure AI Integration',
        description:
          'Add an API key for OpenRouter, Google, Anthropic, or OpenAI to power content generation.',
        href: '/dashboard/settings/integrations',
        icon: BrainCircuit,
        completed: status.llm_integration,
        videoId: 'onboarding-setup-ai',
      },
      {
        id: 'first_post',
        title: 'Generate Your First Post',
        description:
          'Create a piece of AI-generated content — this unlocks the full automation flywheel.',
        href: '/dashboard/content',
        icon: Sparkles,
        completed: status.first_post,
      },
    ],
    [status]
  );

  const progressPercent = Math.round((completedCount / TOTAL_STEPS) * 100);

  if (isLoading) return null;
  if (allComplete) return null;
  if (dismissed && completedCount >= 1) return null;

  return (
    <div
      className={cn(
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 border-[0.5px] border-orange-500/30 bg-orange-500/10 rounded-sm flex items-center justify-center flex-shrink-0">
              <Rocket className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-base font-light text-white tracking-tight">
                Activate the Automation Flywheel
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Complete these 5 steps to unlock fully autonomous campaigns
              </p>
            </div>
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss activation checklist"
              className="p-2 rounded-sm text-white/50 hover:text-white/50 hover:bg-white/[0.05] transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50">
              {completedCount} of {TOTAL_STEPS} complete
            </span>
            <span className="font-mono text-[10px] text-orange-400 tabular-nums">
              {progressPercent}%
            </span>
          </div>
          <div className="h-px bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="border-t-[0.5px] border-white/[0.06] divide-y-[0.5px] divide-white/[0.04]">
        {steps.map(step => (
          <Link
            key={step.id}
            href={step.href}
            className={cn(
              'flex items-center gap-3 px-6 py-4 transition-all group',
              step.completed
                ? 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.05]'
                : 'hover:bg-white/[0.02]'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'h-8 w-8 border-[0.5px] rounded-sm flex items-center justify-center flex-shrink-0 transition-colors',
                step.completed
                  ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                  : 'border-white/[0.08] bg-white/[0.02] group-hover:border-orange-500/30 group-hover:bg-orange-500/[0.08]'
              )}
            >
              {step.completed ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <step.icon className="h-3.5 w-3.5 text-white/40 group-hover:text-orange-400 transition-colors" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm',
                  step.completed
                    ? 'text-emerald-300/70 line-through decoration-emerald-500/40'
                    : 'text-white/70 group-hover:text-white transition-colors'
                )}
              >
                {step.title}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5 hidden sm:block">
                {step.description}
              </p>
              {!step.completed && step.videoId && (
                <div className="mt-1.5" onClick={e => e.preventDefault()}>
                  <HelpVideo videoId={step.videoId} />
                </div>
              )}
            </div>

            {!step.completed && (
              <ChevronRight className="h-3.5 w-3.5 text-white/50 group-hover:text-orange-400 transition-colors flex-shrink-0" />
            )}
          </Link>
        ))}
      </div>

      {/* Dismiss link */}
      {completedCount > 0 && (
        <div className="border-t-[0.5px] border-white/[0.06] px-6 py-3 text-center">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[10px] text-white/50 hover:text-white/40 transition-colors"
          >
            I know my way around — hide this
          </button>
        </div>
      )}
    </div>
  );
}
