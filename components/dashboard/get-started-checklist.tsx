'use client';

/**
 * Get Started Checklist Component
 * Guides new users through essential onboarding steps.
 * Non-dismissible until at least one task is completed.
 * Fires celebration toasts when users complete actions.
 *
 * @see UNI-628 Dashboard has no empty state for new users
 * @see UNI-681 New user empty state — build "Get Started" onboarding flow
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { glassStyles } from '@/components/ui/index';
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

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconComponent;
  completed: boolean;
}

interface GetStartedChecklistProps {
  /** True when user has at least one platform connection */
  hasConnections: boolean;
  /** True when user has at least one campaign or post */
  hasCampaigns: boolean;
  /** True when user has generated AI content (totalPosts > 0) */
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
  const [dismissed, setDismissed] = useState<boolean>(true); // default hidden until hydrated
  const router = useRouter();

  // Track previous values for transition detection (celebration toasts)
  const prevConnections = useRef(hasConnections);
  const prevCampaigns = useRef(hasCampaigns);
  const prevContent = useRef(hasContent);
  const hasMounted = useRef(false);

  // Hydrate dismissal state from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === 'true');
    } catch {
      // localStorage unavailable (SSR / incognito edge-case)
      setDismissed(false);
    }
    // Mark as mounted after first render to avoid false-positive toasts
    hasMounted.current = true;
  }, []);

  // ── Celebration toasts on state transitions ──────────────────────────
  useEffect(() => {
    if (!hasMounted.current) return;

    // Platform connected (false → true)
    if (hasConnections && !prevConnections.current) {
      toast.success('Platform connected! Now let\'s create your first post.', {
        description: 'Use our AI Studio to generate content in seconds.',
        action: {
          label: 'Generate Post',
          onClick: () => router.push('/dashboard/content'),
        },
        duration: 6000,
      });
    }

    // Content generated (false → true)
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

    // Post scheduled (false → true)
    if (hasCampaigns && !prevCampaigns.current) {
      toast.success('You\'re all set! Your first post is scheduled.', {
        description: 'It will publish automatically at the scheduled time.',
        duration: 8000,
        icon: <Sparkles className="h-5 w-5 text-yellow-400" />,
      });
    }

    // Update refs
    prevConnections.current = hasConnections;
    prevCampaigns.current = hasCampaigns;
    prevContent.current = hasContent;
  }, [hasConnections, hasCampaigns, hasContent, router]);

  const handleDismiss = useCallback(() => {
    // Only allow dismissal when at least one task is completed
    const currentCompleted = [hasConnections, hasCampaigns, hasContent].filter(Boolean).length;
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
      // Silently fail — dismissal is a convenience, not critical
    }
  }, [hasConnections, hasCampaigns, hasContent]);

  // Build steps with live completion status
  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        id: 'connect',
        title: 'Connect your first social account',
        description: 'Link a platform like Instagram, YouTube, or TikTok to start publishing.',
        href: '/dashboard/platforms',
        icon: Link2,
        completed: hasConnections,
      },
      {
        id: 'content',
        title: 'Generate your first AI post',
        description: 'Use the AI Studio to draft, optimise, and publish content in seconds.',
        href: '/dashboard/content',
        icon: Sparkles,
        completed: hasContent,
      },
      {
        id: 'campaign',
        title: 'Schedule your first post',
        description: 'Plan and schedule content so it publishes at the perfect time.',
        href: '/dashboard/schedule',
        icon: Rocket,
        completed: hasCampaigns,
      },
    ],
    [hasConnections, hasCampaigns, hasContent],
  );

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const allComplete = completedCount === steps.length;

  // Don't render if all complete; respect dismissal only if at least one task done
  if (allComplete) {
    return null;
  }
  if (dismissed && completedCount >= 1) {
    return null;
  }

  return (
    <Card className={cn(glassStyles.base, 'border-cyan-500/20', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Get Started with Synthex</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Complete these steps to unlock the full platform
              </CardDescription>
            </div>
          </div>
          {/* Only show dismiss button when at least one task is completed */}
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss get started checklist"
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {completedCount} of {steps.length} complete
            </span>
            <span className="text-cyan-400 font-medium">{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            variant="glass-primary"
            size="sm"
            aria-label="Onboarding progress"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="space-y-2" role="list">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  'flex items-center gap-3 p-3 sm:p-4 rounded-lg transition-all group',
                  step.completed
                    ? 'bg-emerald-500/[0.06] border border-emerald-500/20'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-cyan-500/[0.06] hover:border-cyan-500/20',
                )}
              >
                {/* Completion indicator */}
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                    step.completed
                      ? 'bg-emerald-500/20'
                      : 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
                  )}
                >
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <step.icon className="h-4 w-4 text-cyan-400" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.completed ? 'text-emerald-300 line-through decoration-emerald-500/40' : 'text-white',
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                    {step.description}
                  </p>
                </div>

                {/* Arrow for incomplete steps */}
                {!step.completed && (
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* Dismiss link — only when at least one task is done */}
        {completedCount > 0 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              I know my way around — hide this
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
