'use client';

/**
 * Onboarding — Step 2: AI-Populated Review Screen
 *
 * Displays all data extracted by the unified AI pipeline (Phase 2) in
 * editable sections. The user's role is to **verify and adjust**, not
 * to fill from scratch.
 *
 * Sections:
 *   1. Business Identity — name, logo, industry, team size, description, brand colours
 *   2. Website Health — SEO score, PageSpeed, quick wins (read-only summary)
 *   3. Detected Social Profiles — verified/unverified, editable URLs
 *   4. Content & Persona — key topics, target audience, suggested tone
 *   5. Posting Mode — manual / assisted / auto
 *
 * Data source: sessionStorage('synthex_pipeline_result') + server-side
 * OnboardingProgress record (fallback if sessionStorage is cleared).
 *
 * On "Continue" → navigates to /onboarding/connect (OAuth platform connection).
 *
 * @module app/(onboarding)/onboarding/review/page
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Zap,
  Edit3,
  Star,
  Users,
  Building2,
  Palette,
  Search,
  Target,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';
import type { PipelineResult, SocialProfile } from '@/lib/ai/onboarding-pipeline';

// ============================================================================
// CONSTANTS
// ============================================================================

const INDUSTRIES = [
  'Technology',
  'Marketing & Advertising',
  'E-commerce & Retail',
  'Healthcare',
  'Finance & Banking',
  'Education',
  'Real Estate',
  'Hospitality & Tourism',
  'Food & Beverage',
  'Professional Services',
  'Construction & Trades',
  'Beauty & Wellness',
  'Fitness & Sports',
  'Automotive',
  'Media & Entertainment',
  'Non-profit',
  'Government',
  'Agriculture',
  'Manufacturing',
  'Other',
] as const;

const TEAM_SIZES = [
  'Solo (just me)',
  '2-10 people',
  '11-50 people',
  '51-200 people',
  '200+ people',
] as const;

type PostingMode = 'manual' | 'assisted' | 'auto';

const POSTING_MODES: { id: PostingMode; label: string; description: string; icon: string }[] = [
  {
    id: 'manual',
    label: 'Manual',
    description: 'You create and post everything',
    icon: '✍️',
  },
  {
    id: 'assisted',
    label: 'Assisted',
    description: 'AI drafts, you approve before posting',
    icon: '🤝',
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'AI creates, schedules, and publishes',
    icon: '🚀',
  },
];

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: '📸' },
  facebook: { label: 'Facebook', icon: '📘' },
  linkedin: { label: 'LinkedIn', icon: '💼' },
  x: { label: 'X (Twitter)', icon: '🐦' },
  twitter: { label: 'X (Twitter)', icon: '🐦' },
  tiktok: { label: 'TikTok', icon: '🎵' },
  youtube: { label: 'YouTube', icon: '▶️' },
  pinterest: { label: 'Pinterest', icon: '📌' },
  reddit: { label: 'Reddit', icon: '🤖' },
  threads: { label: 'Threads', icon: '🧵' },
};

const SESSION_KEY = 'synthex_pipeline_result';

// ============================================================================
// HEALTH BADGE
// ============================================================================

function HealthBadge({ health }: { health: string }) {
  const config: Record<string, { label: string; colour: string }> = {
    excellent: { label: 'Excellent', colour: 'bg-green-500/20 text-green-400 border-green-500/30' },
    good: { label: 'Good', colour: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    'needs-work': { label: 'Needs Work', colour: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    poor: { label: 'Poor', colour: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };

  const c = config[health] ?? config['needs-work']!;

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', c.colour)}>
      {c.label}
    </span>
  );
}

// ============================================================================
// SCORE RING
// ============================================================================

function ScoreRing({ score, label, size = 64 }: { score: number; label: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const colour = score >= 80 ? '#22d3ee' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <text
          x={size / 2}
          y={size / 2}
          fill="white"
          fontSize={size * 0.28}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ============================================================================
// COLOUR SWATCH
// ============================================================================

function ColourSwatch({
  colour,
  label,
  onChange,
}: {
  colour: string;
  label: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative cursor-pointer">
        <div
          className="w-8 h-8 rounded-lg border border-white/10 shadow-inner"
          style={{ backgroundColor: colour || '#333' }}
        />
        <input
          type="color"
          value={colour || '#333333'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <div className="space-y-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xs text-gray-500 font-mono">{colour || '—'}</p>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION WRAPPER
// ============================================================================

function Section({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReviewPage() {
  const router = useRouter();

  // ── Pipeline result ─────────────────────────────────────────────────
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Editable fields ─────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [description, setDescription] = useState('');
  const [brandColours, setBrandColours] = useState<{
    primary: string;
    secondary?: string;
    accent?: string;
  }>({ primary: '#06b6d4' });

  // Social profiles (editable URLs)
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);

  // Posting mode
  const [postingMode, setPostingMode] = useState<PostingMode>('assisted');

  // Saving state
  const [saving, setSaving] = useState(false);

  // ── Load pipeline result ────────────────────────────────────────────
  useEffect(() => {
    const loadResult = async () => {
      // 1. Try sessionStorage first
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        try {
          const parsed: PipelineResult = JSON.parse(cached);
          populateFromResult(parsed);
          setLoading(false);
          return;
        } catch {
          // Bad cache — fall through to server
        }
      }

      // 2. Fall back to server-side OnboardingProgress
      try {
        const res = await fetch('/api/onboarding/progress', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.auditData) {
            const parsed = data.auditData as PipelineResult;
            populateFromResult(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Server unavailable — continue
      }

      // 3. No data available — redirect back to entry
      setLoading(false);
      router.replace('/onboarding');
    };

    loadResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const populateFromResult = useCallback((data: PipelineResult) => {
    setResult(data);
    setBusinessName(data.businessName ?? '');
    setIndustry(data.industry ?? '');
    setTeamSize(data.teamSize ?? '');
    setDescription(data.description ?? '');
    setBrandColours(data.brandColours ?? { primary: '#06b6d4' });
    setSocialProfiles(data.socialProfiles ?? []);
  }, []);

  // ── Computed values ─────────────────────────────────────────────────
  const seoScore = result?.seoScore ?? 0;
  const mobileSpeed = result?.pageSpeed?.mobile?.score ?? 0;
  const desktopSpeed = result?.pageSpeed?.desktop?.score ?? 0;
  const avgSpeed = Math.round((mobileSpeed + desktopSpeed) / 2);
  const quickWins = result?.quickWins ?? [];
  const keyTopics = result?.keyTopics ?? [];
  const targetAudience = result?.targetAudience ?? '';
  const suggestedTone = result?.suggestedTone ?? '';
  const confidence = result?.confidence ?? 0;

  // Count verified vs total social profiles
  const verifiedCount = socialProfiles.filter((p) => p.verified).length;
  const totalSocials = socialProfiles.length;

  // ── Update social URL ───────────────────────────────────────────────
  const updateSocialUrl = useCallback((idx: number, url: string) => {
    setSocialProfiles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, url, verified: false };
      return next;
    });
  }, []);

  // ── Remove social ───────────────────────────────────────────────────
  const removeSocial = useCallback((idx: number) => {
    setSocialProfiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Save & Continue ─────────────────────────────────────────────────
  const handleContinue = async () => {
    if (!result) return;
    setSaving(true);

    try {
      // Build the reviewed data payload
      const payload = {
        businessName,
        industry,
        teamSize,
        description,
        brandColours,
        socialProfiles,
        postingMode,
        // Pass through read-only data
        seoScore: result.seoScore,
        pageSpeed: result.pageSpeed,
        overallHealth: result.overallHealth,
        quickWins: result.quickWins,
        contentGaps: result.contentGaps,
        keyTopics: result.keyTopics,
        targetAudience: result.targetAudience,
        suggestedTone: result.suggestedTone,
        suggestedPersonaName: result.suggestedPersonaName,
        structuredData: result.structuredData,
        logoUrl: result.logoUrl,
        faviconUrl: result.faviconUrl,
        url: result.url,
      };

      // Persist to server
      const res = await fetch('/api/onboarding/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save review data');
      }

      // Update sessionStorage with edited values
      const updated = { ...result, ...payload };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));

      router.push('/onboarding/connect');
    } catch (err) {
      console.error('[review] Save failed:', err);
      // Non-blocking — still navigate. Server-side OnboardingProgress already has the pipeline data.
      router.push('/onboarding/connect');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        <StepProgressV2 currentStep={2} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-gray-400">Loading your analysis results…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-8">
        <StepProgressV2 currentStep={2} />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-12 h-12 text-amber-400" />
          <p className="text-gray-400">No analysis data found. Please start from the beginning.</p>
          <Button
            onClick={() => router.replace('/onboarding')}
            className="bg-cyan-500 hover:bg-cyan-400 text-white"
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <StepProgressV2 currentStep={2} />

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">
          Review Your Profile
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          Our AI analysed your website. Everything below is pre-filled — review and adjust anything that needs it.
        </p>
        {confidence > 0 && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-cyan-400">
              AI confidence: {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* ─── Section 1: Business Identity ─────────────────────────────── */}
      <Section title="Business Identity" icon={Building2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Business Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="bg-surface-dark/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
            />
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Industry</Label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md bg-surface-dark/50 border border-cyan-500/20 text-white text-sm px-3 py-2 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            >
              <option value="">Select industry…</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Team Size */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Team Size</Label>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full rounded-md bg-surface-dark/50 border border-cyan-500/20 text-white text-sm px-3 py-2 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            >
              <option value="">Select team size…</option>
              {TEAM_SIZES.map((ts) => (
                <option key={ts} value={ts}>{ts}</option>
              ))}
            </select>
          </div>

          {/* Logo preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Logo</Label>
            <div className="flex items-center gap-3">
              {result.logoUrl ? (
                <img
                  src={result.logoUrl}
                  alt="Detected logo"
                  className="w-12 h-12 rounded-lg border border-cyan-500/20 object-contain bg-white/5"
                />
              ) : result.faviconUrl ? (
                <img
                  src={result.faviconUrl}
                  alt="Favicon"
                  className="w-12 h-12 rounded-lg border border-cyan-500/20 object-contain bg-white/5 p-1"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-cyan-500/20 bg-white/5 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <span className="text-xs text-gray-500">
                {result.logoUrl ? 'Detected from website' : result.faviconUrl ? 'Using favicon' : 'No logo found'}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Description</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md bg-surface-dark/50 border border-cyan-500/20 text-white text-sm px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-none"
            placeholder="A short description of your business…"
          />
        </div>

        {/* Brand Colours */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-400">Brand Colours</Label>
          <div className="flex flex-wrap gap-4">
            <ColourSwatch
              colour={brandColours.primary}
              label="Primary"
              onChange={(val) => setBrandColours((prev) => ({ ...prev, primary: val }))}
            />
            <ColourSwatch
              colour={brandColours.secondary ?? ''}
              label="Secondary"
              onChange={(val) => setBrandColours((prev) => ({ ...prev, secondary: val }))}
            />
            <ColourSwatch
              colour={brandColours.accent ?? ''}
              label="Accent"
              onChange={(val) => setBrandColours((prev) => ({ ...prev, accent: val }))}
            />
          </div>
        </div>

        {/* Structured data extras */}
        {result.structuredData && (
          <div className="pt-2 border-t border-white/5">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              {result.structuredData.phone && (
                <span>📞 {result.structuredData.phone}</span>
              )}
              {result.structuredData.email && (
                <span>✉️ {result.structuredData.email}</span>
              )}
              {result.structuredData.abn && (
                <span>🏛️ ABN: {result.structuredData.abn}</span>
              )}
              {result.structuredData.address && (
                <span>📍 {result.structuredData.address}</span>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ─── Section 2: Website Health ────────────────────────────────── */}
      <Section
        title="Website Health"
        icon={Search}
        badge={<HealthBadge health={result.overallHealth} />}
      >
        {/* Scores */}
        <div className="flex items-center justify-center gap-8">
          <ScoreRing score={seoScore} label="SEO" />
          <ScoreRing score={mobileSpeed} label="Mobile" />
          <ScoreRing score={desktopSpeed} label="Desktop" />
        </div>

        {/* Health summary */}
        {result.healthSummary && (
          <p className="text-sm text-gray-400 text-center">
            {result.healthSummary}
          </p>
        )}

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Quick Wins</p>
            <ul className="space-y-1.5">
              {quickWins.slice(0, 5).map((win, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* ─── Section 3: Social Profiles ───────────────────────────────── */}
      <Section
        title="Detected Social Profiles"
        icon={Globe}
        badge={
          totalSocials > 0 ? (
            <span className="text-xs text-gray-400">
              {verifiedCount}/{totalSocials} verified
            </span>
          ) : undefined
        }
      >
        {socialProfiles.length > 0 ? (
          <div className="space-y-3">
            {socialProfiles.map((profile, idx) => {
              const meta = PLATFORM_META[profile.platform.toLowerCase()] ??
                { label: profile.platform, icon: '🔗' };
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-medium">{meta.label}</span>
                      {profile.verified ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                          ✓ Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Unverified
                        </Badge>
                      )}
                    </div>
                    <Input
                      value={profile.url}
                      onChange={(e) => updateSocialUrl(idx, e.target.value)}
                      className="bg-surface-dark/50 border-cyan-500/20 text-white text-sm placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 h-8"
                    />
                  </div>
                  <button
                    onClick={() => removeSocial(idx)}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No social profiles were detected on your website.
            You&apos;ll be able to connect platforms in the next step.
          </p>
        )}

        {/* Hint about OAuth */}
        <p className="text-xs text-gray-500 text-center pt-1">
          You&apos;ll connect these accounts via OAuth in the next step for full functionality.
        </p>
      </Section>

      {/* ─── Section 4: Content & Persona ─────────────────────────────── */}
      <Section title="Content Strategy" icon={Sparkles}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Audience */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Target Audience</Label>
            <p className="text-sm text-white bg-surface-dark/50 rounded-md border border-cyan-500/10 px-3 py-2">
              {targetAudience || 'Not detected'}
            </p>
          </div>

          {/* Suggested Tone */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Suggested Tone</Label>
            <p className="text-sm text-white bg-surface-dark/50 rounded-md border border-cyan-500/10 px-3 py-2">
              {suggestedTone || 'Not detected'}
            </p>
          </div>
        </div>

        {/* Key Topics */}
        {keyTopics.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Key Topics</Label>
            <div className="flex flex-wrap gap-2">
              {keyTopics.map((topic, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-cyan-500/5 text-cyan-400 border-cyan-500/20 text-xs"
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Persona name suggestion */}
        {result.suggestedPersonaName && (
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">
                Suggested AI persona name:{' '}
                <span className="text-cyan-400 font-medium">{result.suggestedPersonaName}</span>
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ─── Section 5: Posting Mode ──────────────────────────────────── */}
      <Section title="Posting Mode" icon={Zap}>
        <div className="grid grid-cols-3 gap-3">
          {POSTING_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setPostingMode(mode.id)}
              className={cn(
                'p-3 rounded-lg border text-center transition-all',
                postingMode === mode.id
                  ? 'bg-cyan-500/10 border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'bg-surface-dark/30 border-white/5 hover:border-white/10',
              )}
            >
              <span className="text-xl block mb-1">{mode.icon}</span>
              <p className={cn(
                'text-sm font-medium',
                postingMode === mode.id ? 'text-cyan-400' : 'text-white',
              )}>
                {mode.label}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {mode.description}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── Action buttons ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </Button>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={saving || !businessName.trim()}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 px-8"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              Looks good — Connect socials
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
