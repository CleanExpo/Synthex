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
import { Star, CheckCircle2, Clapperboard, Sparkles } from 'lucide-react';
import {
  PROGRAMME_BENEFITS,
  type FeaturedProgrammeStatus,
} from '@/lib/videos/featuredProgramme';

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
          <Star className="w-4 h-4 text-amber-400" aria-hidden="true" />
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
                  <Sparkles
                    className="w-3.5 h-3.5 text-amber-400 shrink-0"
                    aria-hidden="true"
                  />
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
            <CheckCircle2
              className="w-4 h-4 text-green-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>
              Application received. Our team reviews featured candidates and
              will be in touch before production begins.
            </span>
          </div>
        )}

        {status === 'in_production' && (
          <div className="flex items-start gap-2 text-sm text-white/70">
            <Clapperboard
              className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>Your case-study video is in production.</span>
          </div>
        )}

        {status === 'published' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-white/70">
              <Star
                className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
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
