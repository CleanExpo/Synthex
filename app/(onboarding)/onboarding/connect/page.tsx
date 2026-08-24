'use client';

/**
 * Onboarding — Step 3: Connect Social Platforms
 *
 * Platform OAuth is Coming soon. Users can finish setup and connect later
 * from Dashboard → Platforms when the feature ships.
 *
 * @module app/(onboarding)/onboarding/connect/page
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OnboardingSplit } from '@/components/onboarding';
import { HelpVideo } from '@/components/ui/HelpVideo';
import { toast } from 'sonner';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';
import { BRAND_MIRROR_COOKIE } from '@/lib/constants/onboarding';

interface PlatformConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const PLATFORM_LIST: PlatformConfig[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    description: 'Photos, Reels, Stories',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    description: 'Pages, Groups, Events',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    description: 'Professional content',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    icon: '🐦',
    description: 'Tweets, Threads',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    description: 'Short-form video',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    description: 'Videos, Shorts',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: '📌',
    description: 'Pins, Boards',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    description: 'Posts, Comments',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    description: 'Text-based social',
  },
];

const GOOGLE_SEO_LIST: PlatformConfig[] = [
  {
    id: 'searchconsole',
    label: 'Google Search Console',
    icon: '🔍',
    description: 'Search performance & indexing',
  },
  {
    id: 'googlebusiness',
    label: 'Google Business Profile',
    icon: '📍',
    description: 'Local listings & reviews',
  },
];

const SESSION_KEY = 'synthex_pipeline_result';

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border-[0.5px] border-dashed border-white/15 bg-white/2 text-white/45">
      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span className="text-xs font-medium tracking-wide">Coming soon</span>
    </span>
  );
}

function PlatformRow({
  platform,
  detected,
}: {
  platform: PlatformConfig;
  detected?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-sm border-[0.5px] transition-colors',
        detected
          ? 'bg-orange-500/5 border-orange-500/20'
          : 'bg-white/1 border-white/6'
      )}
      aria-disabled="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0 opacity-70" aria-hidden>
            {platform.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-light text-white/80">
                {platform.label}
              </h3>
              {detected && (
                <span className="text-xs px-1.5 py-0.5 rounded-sm border-[0.5px] border-orange-500/25 bg-orange-500/10 text-orange-400/80">
                  Detected
                </span>
              )}
            </div>
            <p className="text-xs text-white/35 mt-0.5">
              {platform.description}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ComingSoonBadge />
        </div>
      </div>
    </div>
  );
}

function ConnectPageInner() {
  const router = useRouter();
  const [detectedPlatforms, setDetectedPlatforms] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const brandMirrorViewed = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${BRAND_MIRROR_COOKIE}=`));
    if (!brandMirrorViewed) {
      router.replace('/onboarding');
    }
  }, [router]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const result: PipelineResult = JSON.parse(cached);
        const detected = (result.socialProfiles ?? []).map(p =>
          p.platform.toLowerCase()
        );
        setDetectedPlatforms(detected);
      }
    } catch {
      // No pipeline cache — show all platforms as coming soon
    }
  }, []);

  const handleFinish = async () => {
    setFinishing(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error || 'Could not finish setup. Please try again.'
        );
      }

      fetch('/api/onboarding/kickstart', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {
        // First-week drafts are optional — dashboard still works.
      });

      sessionStorage.removeItem(SESSION_KEY);
      localStorage.setItem('onboardingComplete', 'true');
      localStorage.setItem('showTourOnDashboard', 'true');

      router.push('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not finish setup. Please try again.';
      toast.error(message);
    } finally {
      setFinishing(false);
    }
  };

  const sortedPlatforms = [...PLATFORM_LIST].sort((a, b) => {
    const aDetected = detectedPlatforms.includes(a.id) ? 1 : 0;
    const bDetected = detectedPlatforms.includes(b.id) ? 1 : 0;
    return bDetected - aDetected;
  });

  return (
    <OnboardingSplit
      currentStep={3}
      eyebrow="Step 3 · Connect"
      title="Connect your platforms"
      description="Social and Google connections are on the way. Finish setup now — you can link accounts from the dashboard when this ships."
      aside={<HelpVideo videoId="onboarding-connect-social" />}
    >
      <div className="space-y-5">
        <div className="border-[0.5px] border-dashed border-white/10 bg-white/1 rounded-sm px-4 py-3.5 flex items-start gap-3">
          <Lock className="w-4 h-4 text-orange-400/80 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white/70 font-light">
              Platform connect — coming soon
            </p>
            <p className="text-xs text-white/35 mt-1 leading-relaxed">
              OAuth linking is intentionally locked so nothing fakes a
              successful connection. Finish onboarding and continue in Mission
              Control.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedPlatforms.map(platform => (
            <PlatformRow
              key={platform.id}
              platform={platform}
              detected={detectedPlatforms.includes(platform.id)}
            />
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">
              Google Search & Local
            </p>
            <h2 className="text-lg font-light text-white/85">
              Search & local presence
            </h2>
            <p className="text-xs text-white/35">
              Also coming soon — optional SEO and GBP tools
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOOGLE_SEO_LIST.map(platform => (
              <PlatformRow key={platform.id} platform={platform} />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 pb-2 gap-3">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-white/40 hover:text-white rounded-sm"
          >
            ← Back
          </Button>

          <Button
            size="lg"
            onClick={handleFinish}
            disabled={finishing}
            className="bg-orange-500 hover:bg-orange-400 text-black shadow-none rounded-sm px-8 disabled:opacity-50"
          >
            {finishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Finishing…
              </>
            ) : (
              <>
                Finish setup
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </OnboardingSplit>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
        </div>
      }
    >
      <ConnectPageInner />
    </Suspense>
  );
}
