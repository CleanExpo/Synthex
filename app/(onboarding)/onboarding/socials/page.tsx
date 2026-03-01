'use client';

/**
 * Onboarding — Step 4: Social Profiles + Posting Mode (UNI-1189)
 *
 * Users enter their profile URLs for up to 9 platforms. Each URL is
 * validated client-side (format) and verified server-side (HEAD request).
 *
 * Posting mode selection:
 *   Manual   — User creates and posts content themselves
 *   Assisted — SYNTHEX drafts content; user reviews and approves
 *   Auto     — SYNTHEX creates, schedules, and posts automatically
 *
 * On save, calls POST /api/onboarding/social-profiles. Results are cached
 * to sessionStorage under 'synthex_onboarding_socials'.
 *
 * "Finish" navigates to the existing /api/onboarding completion route
 * (which creates the organisation and marks onboarding complete).
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2, XCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SocialProfilesPayload, SocialProfilesSaveResult, PostingMode } from '@/app/api/onboarding/social-profiles/route';

// ============================================================================
// STEP PROGRESS
// ============================================================================

const ONBOARDING_STEPS = [
  { id: 1, name: 'API Keys' },
  { id: 2, name: 'Website Audit' },
  { id: 3, name: 'Your Goals' },
  { id: 4, name: 'Social Profiles' },
] as const;

function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {ONBOARDING_STEPS.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                step.id < currentStep
                  ? 'bg-cyan-500 text-white'
                  : step.id === currentStep
                  ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                  : 'bg-white/5 border border-white/10 text-gray-500',
              )}
            >
              {step.id < currentStep ? '✓' : step.id}
            </div>
            <span
              className={cn(
                'text-xs font-medium hidden sm:block',
                step.id === currentStep ? 'text-cyan-400' : 'text-gray-500',
              )}
            >
              {step.name}
            </span>
          </div>
          {idx < ONBOARDING_STEPS.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px max-w-[40px]',
                step.id < currentStep ? 'bg-cyan-500' : 'bg-white/10',
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// PLATFORM CONFIG
// ============================================================================

interface PlatformConfig {
  id: keyof SocialProfilesPayload['profiles'];
  label: string;
  icon: string;
  placeholder: string;
  helpText: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    placeholder: 'https://instagram.com/yourusername',
    helpText: 'Your public Instagram profile URL',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    placeholder: 'https://facebook.com/yourpage',
    helpText: 'Your Facebook page or profile URL',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    placeholder: 'https://linkedin.com/in/yourname',
    helpText: 'LinkedIn profile or company page',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    icon: '🐦',
    placeholder: 'https://x.com/yourusername',
    helpText: 'Your X / Twitter profile',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    placeholder: 'https://tiktok.com/@yourusername',
    helpText: 'Your TikTok profile URL',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    placeholder: 'https://youtube.com/@yourchannel',
    helpText: 'Your YouTube channel URL',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: '📌',
    placeholder: 'https://pinterest.com/yourusername',
    helpText: 'Your Pinterest profile',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    placeholder: 'https://reddit.com/u/yourusername',
    helpText: 'Your Reddit user profile',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    placeholder: 'https://threads.net/@yourusername',
    helpText: 'Your Threads profile',
  },
];

// ============================================================================
// POSTING MODE CONFIG
// ============================================================================

interface PostingModeConfig {
  id: PostingMode;
  label: string;
  description: string;
  detail: string;
  icon: string;
}

const POSTING_MODES: PostingModeConfig[] = [
  {
    id: 'manual',
    label: 'Manual',
    description: 'I create and post everything myself',
    detail: 'SYNTHEX provides ideas, copy suggestions, and analytics. You stay in full control.',
    icon: '✍️',
  },
  {
    id: 'assisted',
    label: 'Assisted',
    description: 'SYNTHEX drafts content, I approve before posting',
    detail: 'AI generates posts and schedules them for your review. You approve or edit before anything goes live.',
    icon: '🤝',
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'SYNTHEX creates and schedules automatically',
    detail: 'Full autopilot. SYNTHEX generates, schedules, and publishes content. You set the strategy, AI handles execution.',
    icon: '🚀',
  },
];

const SESSION_KEY = 'synthex_onboarding_socials';

// ============================================================================
// TYPES
// ============================================================================

type ProfileUrls = Partial<Record<keyof SocialProfilesPayload['profiles'], string>>;
type VerificationState = 'idle' | 'verifying' | 'done';
type ProfileVerification = Record<string, boolean>;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PlatformRow({
  platform,
  value,
  verified,
  onChange,
}: {
  platform: PlatformConfig;
  value: string;
  verified?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-7 text-center shrink-0">{platform.icon}</span>
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-gray-400">{platform.label}</Label>
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={platform.placeholder}
            type="url"
            className={cn(
              'bg-[#0a1628]/50 border text-white placeholder:text-gray-600 text-sm',
              verified === true
                ? 'border-green-500/40 focus:border-green-500/60'
                : verified === false
                ? 'border-yellow-500/40 focus:border-yellow-500/60'
                : 'border-cyan-500/20 focus:border-cyan-500/50',
            )}
          />
          {verified !== undefined && value && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {verified ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-yellow-500" />
              )}
            </div>
          )}
        </div>
        {verified === false && value && (
          <p className="text-xs text-yellow-600">
            URL saved but could not be verified — check it is public and correct.
          </p>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: PostingModeConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'p-4 rounded-xl border text-left transition-all duration-150 w-full',
        selected
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
          : 'bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0">{mode.icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold',
                selected ? 'text-cyan-300' : 'text-white',
              )}
            >
              {mode.label}
            </span>
            {selected && <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{mode.description}</p>
          {selected && (
            <p className="text-xs text-cyan-500/70 mt-1.5 leading-relaxed">{mode.detail}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function OnboardingSocialsPage() {
  const router = useRouter();

  const [profileUrls, setProfileUrls] = useState<ProfileUrls>({});
  const [postingMode, setPostingMode] = useState<PostingMode>('assisted');
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [verifications, setVerifications] = useState<ProfileVerification>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const data = JSON.parse(cached) as {
          profileUrls?: ProfileUrls;
          postingMode?: PostingMode;
          verifications?: ProfileVerification;
        };
        if (data.profileUrls) setProfileUrls(data.profileUrls);
        if (data.postingMode) setPostingMode(data.postingMode);
        if (data.verifications) setVerifications(data.verifications);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const filledCount = Object.values(profileUrls).filter((v) => v && v.length > 0).length;
  const canSave = filledCount > 0 || true; // Can always proceed (all optional)

  const handleSave = async () => {
    setVerificationState('verifying');
    setSaveError(null);
    setSaved(false);

    // Build the profiles payload — empty strings for unfilled
    const profiles: SocialProfilesPayload['profiles'] = {
      instagram: profileUrls.instagram ?? '',
      facebook:  profileUrls.facebook ?? '',
      linkedin:  profileUrls.linkedin ?? '',
      x:         profileUrls.x ?? '',
      tiktok:    profileUrls.tiktok ?? '',
      youtube:   profileUrls.youtube ?? '',
      pinterest: profileUrls.pinterest ?? '',
      reddit:    profileUrls.reddit ?? '',
      threads:   profileUrls.threads ?? '',
    };

    try {
      const res = await fetch('/api/onboarding/social-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ postingMode, profiles }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to save social profiles');
      }

      const result = await res.json() as SocialProfilesSaveResult;

      // Build verification lookup from API response
      const newVerifications: ProfileVerification = {};
      for (const vp of result.verifiedProfiles) {
        newVerifications[vp.platform] = vp.reachable;
      }
      setVerifications(newVerifications);
      setSaved(true);

      // Cache locally
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ profileUrls, postingMode, verifications: newVerifications }),
        );
      } catch {
        /* storage full */
      }

      setVerificationState('done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profiles. Try again.');
      setVerificationState('idle');
    }
  };

  /**
   * Calls POST /api/onboarding to create the Organisation, mark onboardingComplete,
   * and reissue the JWT. Without this call the middleware will keep redirecting
   * back to /onboarding. Required data is derived from earlier steps cached in
   * sessionStorage (audit URL → org name, goals businessType → industry).
   */
  const completeOnboarding = async () => {
    setCompleting(true);
    setCompletionError(null);

    // Derive required fields from earlier onboarding steps in sessionStorage
    let orgName = 'My Business';
    let industry = 'professional';
    let description = '';
    let auditData: unknown;

    try {
      const raw = sessionStorage.getItem('synthex_onboarding_audit');
      if (raw) {
        const audit = JSON.parse(raw) as { url?: string; insights?: { summary?: string } };
        if (audit.url) {
          const hostname = new URL(audit.url).hostname.replace(/^www\./, '');
          const domain = hostname.split('.')[0] ?? 'mybusiness';
          orgName = domain.charAt(0).toUpperCase() + domain.slice(1);
        }
        if (audit.insights?.summary) description = audit.insights.summary;
        auditData = audit;
      }
    } catch { /* ignore storage/parse errors */ }

    try {
      const raw = sessionStorage.getItem('synthex_onboarding_goals');
      if (raw) {
        const goals = JSON.parse(raw) as { answers?: { businessType?: string } };
        const industryMap: Record<string, string> = {
          ecommerce: 'ecommerce',
          service: 'professional',
          saas: 'technology',
          personal: 'professional',
          agency: 'agency',
          nonprofit: 'nonprofit',
        };
        const bt = goals.answers?.businessType ?? '';
        if (bt) industry = industryMap[bt] ?? 'professional';
      }
    } catch { /* ignore */ }

    // Build social handles map from filled profile URLs
    const socialHandles: Record<string, string> = {};
    for (const [platform, url] of Object.entries(profileUrls)) {
      if (url) socialHandles[platform] = url;
    }

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationName: orgName,
          website: '',
          industry,
          teamSize: 'small',
          description,
          socialHandles,
          aiGeneratedData: auditData ?? null,
          connectedPlatforms: [],
          skipPersona: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to complete onboarding');
      }

      // API reissues a JWT with onboardingComplete: true — now safe to enter the dashboard
      router.push('/dashboard');
    } catch (err) {
      setCompletionError(
        err instanceof Error ? err.message : 'Could not complete setup. Please try again.',
      );
      setCompleting(false);
    }
  };

  const handleFinish = async () => {
    // If they haven't saved social profiles yet, do that first
    if (filledCount > 0 && !saved) {
      await handleSave();
    }
    // Create the Organisation and reissue the JWT before redirecting
    await completeOnboarding();
  };

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgress currentStep={4} />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <span className="text-2xl">📡</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Connect your social presence</h1>
        <p className="text-gray-400 max-w-sm mx-auto">
          Add your existing profile URLs so SYNTHEX can analyse your accounts and tailor content.
          All fields are optional.
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-8">
        {/* Platform URL Inputs */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Your Social Profiles</h2>
          <div className="space-y-4">
            {PLATFORMS.map((platform) => (
              <PlatformRow
                key={platform.id}
                platform={platform}
                value={profileUrls[platform.id] ?? ''}
                verified={
                  verificationState === 'done' && profileUrls[platform.id]
                    ? verifications[platform.id]
                    : undefined
                }
                onChange={(val) =>
                  setProfileUrls((prev) => {
                    const next = { ...prev, [platform.id]: val };
                    if (!val) delete next[platform.id];
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Posting Mode */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-300">How do you want to post?</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              You can change this at any time in Settings.
            </p>
          </div>
          <div className="space-y-2">
            {POSTING_MODES.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                selected={postingMode === mode.id}
                onSelect={() => setPostingMode(mode.id)}
              />
            ))}
          </div>
        </div>

        {/* Verification / Save feedback */}
        {verificationState === 'done' && saved && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400 text-center">
            <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Profiles saved.
            {Object.values(verifications).filter(Boolean).length > 0 && (
              <span className="ml-1">
                {Object.values(verifications).filter(Boolean).length} URL{Object.values(verifications).filter(Boolean).length !== 1 ? 's' : ''} verified.
              </span>
            )}
          </div>
        )}

        {saveError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
            {saveError}
          </div>
        )}

        {completionError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
            {completionError}
          </div>
        )}

        {/* Save + Finish Actions */}
        <div className="space-y-3 pt-2">
          {/* Save profiles (optional, before finishing) */}
          {!saved && filledCount > 0 && (
            <Button
              onClick={handleSave}
              disabled={verificationState === 'verifying'}
              variant="outline"
              className="w-full bg-white/5 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
            >
              {verificationState === 'verifying' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving &amp; verifying URLs…
                </>
              ) : (
                'Save Profiles'
              )}
            </Button>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <button
              onClick={completeOnboarding}
              disabled={completing}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip for now
            </button>

            <Button
              onClick={handleFinish}
              disabled={verificationState === 'verifying' || completing}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {completing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finishing…
                </>
              ) : verificationState === 'verifying' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Finish Setup →'
              )}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-600 pb-2">
        You can connect accounts and update profiles anytime in Settings → Social Accounts
      </p>
    </div>
  );
}
