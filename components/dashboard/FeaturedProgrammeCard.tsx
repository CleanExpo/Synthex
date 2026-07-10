'use client';

/**
 * FeaturedProgrammeCard
 *
 * Dashboard surface for the "Featured in Synthex" case-study video programme
 * (SYN-508). Status-aware: renders one of four states from a single component.
 *
 *   not_applied   → benefits + "Apply to be featured" CTA (PATCHes opt-in)
 *   applied       → "Application received" confirmation
 *   in_production → "Your video is in production"
 *   published     → "You're featured!" + link to the Authority Hub
 *
 * Opt-in calls PATCH /api/clients/featured-opt-in { clientId }, which flips the
 * status to 'applied' and alerts #featured-clients.
 *
 * @task SYN-508
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PROGRAMME_BENEFITS,
  type FeaturedProgrammeStatus,
} from '@/lib/videos/featuredProgramme';

// Inline SVG icons — no icon libraries in app code (DESIGN.md, Phill Rule 1).
function iconProps(className?: string) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    className,
  } as const;
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ClapperboardIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4" />
    </svg>
  );
}

interface FeaturedProgrammeCardProps {
  /** Soft `clients.id` used by the opt-in route. */
  clientId: string;
  /** Current programme status for this client. */
  status: FeaturedProgrammeStatus;
  /** Authority Hub slug — enables the "View your feature" link when published. */
  slug?: string;
}

export function FeaturedProgrammeCard({
  clientId,
  status: initialStatus,
  slug,
}: FeaturedProgrammeCardProps) {
  const [status, setStatus] = useState<FeaturedProgrammeStatus>(initialStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function optIn() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients/featured-opt-in', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setStatus('applied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-amber-400" />
          Featured in Synthex
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'not_applied' && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              Turn your results into a professional case-study video, published
              to our channel and linked from your Authority Hub.
            </p>
            <ul className="space-y-1.5">
              {PROGRAMME_BENEFITS.map(benefit => (
                <li
                  key={benefit}
                  className="flex items-center gap-2 text-sm text-white/70"
                >
                  <SparkleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={optIn} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Apply to be featured'}
            </Button>
          </div>
        )}

        {status === 'applied' && (
          <div className="flex items-start gap-2 text-sm text-white/70">
            <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <span>
              Application received. Our team reviews featured candidates and
              will be in touch before production begins.
            </span>
          </div>
        )}

        {status === 'in_production' && (
          <div className="flex items-start gap-2 text-sm text-white/70">
            <ClapperboardIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Your case-study video is in production.</span>
          </div>
        )}

        {status === 'published' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-white/70">
              <StarIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>You&rsquo;re featured in Synthex.</span>
            </div>
            {slug && (
              <a
                href={`/clients/${slug}`}
                className="text-sm text-orange-400/80 hover:text-orange-400 transition-colors"
              >
                View your feature →
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FeaturedProgrammeCard;
