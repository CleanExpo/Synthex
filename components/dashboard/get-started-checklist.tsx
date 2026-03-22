'use client';

/**
 * Get Started Checklist Component
 * Guides new users through essential onboarding steps.
 * Non-dismissible until at least one task is completed.
 *
 * @see UNI-628 Dashboard has no empty state for new users
 * @see UNI-681 New user empty state — build "Get Started" onboarding flow
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QuickPostModal } from '@/components/dashboard/QuickPostModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Rocket,
  Link2,
  Sparkles,
  CheckCircle,
  X,
  ChevronRight,
} from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>;

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconComponent;
  completed: boolean;
}

interface GetStartedChecklistProps {
  hasConnections: boolean;
  hasCampaigns: boolean;
  hasContent: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'synthex_get_started_dismissed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GetStartedChecklist({
  hasConnections,
  hasCampaigns,
  hasContent,
  className,
}: GetStartedChecklistProps) {
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const router = useRouter();

  const prevConnections = useRef(hasConnections);
  const prevCampaigns = useRef(hasCampaigns);
  const prevContent = useRef(hasContent);
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

  useEffect(() => {
    if (!hasMounted.current) return;

    if (hasConnections && !prevConnections.current) {
      toast.success("Platform connected! Now let's create your first post.", {
        description: 'Use our AI Studio to generate content in seconds.',
        action: {
          label: 'Generate Post',
          onClick: () => router.push('/dashboard/content'),
        },
        duration: 6000,
      });
    }
    if (hasContent && !prevContent.current) {
      toast.success('First post created! Schedule it for the perfect time.', {
        description: 'Pick the optimal time to reach your audience.',
        action: {
          label: 'Schedule Post',
          onClick: () => router.push('/dashboard/schedule'),
        },
        duration: 6000,
      });
    }
    if (hasCampaigns && !prevCampaigns.current) {
      toast.success("You're all set! Your first post is scheduled.", {
        description: 'It will publish automatically at the scheduled time.',
        duration: 8000,
        icon: <Sparkles className="h-5 w-5 text-orange-400" />,
      });
    }

    prevConnections.current = hasConnections;
    prevCampaigns.current = hasCampaigns;
    prevContent.current = hasContent;
  }, [hasConnections, hasCampaigns, hasContent, router]);

  const handleDismiss = useCallback(() => {
    const currentCompleted = [hasConnections, hasCampaigns, hasContent].filter(
      Boolean
    ).length;
    if (currentCompleted === 0) {
      toast.info('Complete at least one step before dismissing.', {
        description: 'These steps help you get the most out of Synthex.',
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
  }, [hasConnections, hasCampaigns, hasContent]);

  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        id: 'connect',
        title: 'Connect your first social account',
        description:
          'Link a platform like Instagram, YouTube, or TikTok to start publishing.',
        href: '/dashboard/platforms',
        icon: Link2,
        completed: hasConnections,
      },
      {
        id: 'content',
        title: 'Create your first post',
        description:
          'Write a quick post right here — choose a platform, write, and schedule.',
        href: '#quick-post',
        icon: Sparkles,
        completed: hasContent,
      },
      {
        id: 'campaign',
        title: 'Schedule your first post',
        description:
          'Plan and schedule content so it publishes at the perfect time.',
        href: '/dashboard/schedule',
        icon: Rocket,
        completed: hasCampaigns,
      },
    ],
    [hasConnections, hasCampaigns, hasContent]
  );

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const allComplete = completedCount === steps.length;

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
                Get Started with Synthex
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Complete these steps to unlock the full platform
              </p>
            </div>
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss get started checklist"
              className="p-1 rounded-sm text-white/50 hover:text-white/50 hover:bg-white/[0.05] transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50">
              {completedCount} of {steps.length} complete
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
            href={step.href === '#quick-post' ? '#' : step.href}
            onClick={
              step.href === '#quick-post' && !step.completed
                ? e => {
                    e.preventDefault();
                    setQuickPostOpen(true);
                  }
                : undefined
            }
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

      <QuickPostModal open={quickPostOpen} onOpenChange={setQuickPostOpen} />
    </div>
  );
}
