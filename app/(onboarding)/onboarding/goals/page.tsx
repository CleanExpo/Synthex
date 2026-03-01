'use client';

/**
 * Onboarding — Step 3: Goals Questionnaire (UNI-1188)
 *
 * Six visual card questions collect the user's business context:
 *   1. Business type
 *   2. Primary marketing goal
 *   3. Target audience
 *   4. Content volume preference
 *   5. Monthly budget tier
 *   6. Biggest marketing challenge
 *
 * On submission, calls POST /api/onboarding/generate-plan which uses the
 * premium AI model to produce a personalised 90-day marketing plan.
 *
 * Results are cached to sessionStorage to survive page refreshes.
 * Navigate forward → /onboarding/socials
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Sparkles, CheckCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GoalsAnswers, MarketingPlan, PlatformRecommendation, ContentPillar } from '@/app/api/onboarding/generate-plan/route';

// ============================================================================
// STEP PROGRESS (shared across onboarding pages)
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
// QUESTION DEFINITIONS
// ============================================================================

interface QuestionOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface Question {
  id: keyof GoalsAnswers;
  heading: string;
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'businessType',
    heading: 'What best describes your business?',
    options: [
      { id: 'ecommerce', label: 'E-commerce', icon: '🛒', description: 'Selling products online' },
      { id: 'service', label: 'Service Business', icon: '🔧', description: 'Professional services' },
      { id: 'saas', label: 'SaaS / Software', icon: '💻', description: 'Software or subscriptions' },
      { id: 'personal', label: 'Personal Brand', icon: '🧑', description: 'Creator or consultant' },
      { id: 'agency', label: 'Agency', icon: '🏢', description: 'Marketing or design agency' },
      { id: 'nonprofit', label: 'Non-profit', icon: '❤️', description: 'Mission-driven organisation' },
    ],
  },
  {
    id: 'primaryGoal',
    heading: 'What is your primary marketing goal?',
    options: [
      { id: 'awareness', label: 'Brand Awareness', icon: '📣', description: 'Get more people to know you' },
      { id: 'leads', label: 'Lead Generation', icon: '🎯', description: 'Attract potential clients' },
      { id: 'sales', label: 'Drive Sales', icon: '💰', description: 'Convert followers into buyers' },
      { id: 'community', label: 'Build Community', icon: '🤝', description: 'Grow an engaged audience' },
      { id: 'thought', label: 'Thought Leadership', icon: '🧠', description: 'Establish expertise' },
      { id: 'retention', label: 'Customer Retention', icon: '🔄', description: 'Keep customers engaged' },
    ],
  },
  {
    id: 'targetAudience',
    heading: 'Who is your primary audience?',
    options: [
      { id: 'b2b', label: 'B2B Professionals', icon: '👔', description: 'Business decision-makers' },
      { id: 'local', label: 'Local Community', icon: '📍', description: 'Your city or region' },
      { id: 'young', label: 'Young Adults 18–35', icon: '🎓', description: 'Millennials and Gen Z' },
      { id: 'parents', label: 'Parents & Families', icon: '👨‍👩‍👧', description: 'Family-focused consumers' },
      { id: 'consumers', label: 'General Consumers', icon: '🛍️', description: 'Broad B2C demographics' },
      { id: 'global', label: 'Global / Online', icon: '🌏', description: 'Worldwide digital audience' },
    ],
  },
  {
    id: 'contentVolume',
    heading: 'How often do you want to post?',
    options: [
      { id: 'light', label: '1–2× per week', icon: '🌱', description: 'Sustainable approach' },
      { id: 'moderate', label: '3–4× per week', icon: '📅', description: 'Consistent presence' },
      { id: 'active', label: '5–7× per week', icon: '⚡', description: 'Daily for rapid growth' },
      { id: 'intensive', label: 'Multiple daily', icon: '🚀', description: 'Maximum visibility' },
    ],
  },
  {
    id: 'budgetTier',
    heading: 'What is your monthly marketing budget?',
    options: [
      { id: 'bootstrap', label: 'Bootstrapped', icon: '🌿', description: 'Organic growth only' },
      { id: 'starter', label: 'Starter ($1–500)', icon: '💡', description: 'Small paid budget' },
      { id: 'growth', label: 'Growth ($500–2k)', icon: '📈', description: 'Meaningful paid promotion' },
      { id: 'scale', label: 'Scale ($2,000+)', icon: '🏆', description: 'Serious investment' },
    ],
  },
  {
    id: 'biggestChallenge',
    heading: 'What is your biggest marketing challenge?',
    options: [
      { id: 'time', label: 'Not Enough Time', icon: '⏰', description: 'Hard to stay consistent' },
      { id: 'ideas', label: 'No Content Ideas', icon: '💭', description: "Don't know what to post" },
      { id: 'engagement', label: 'Low Engagement', icon: '😶', description: 'Posts get little interaction' },
      { id: 'reach', label: 'Limited Reach', icon: '📡', description: 'Not reaching new people' },
      { id: 'consistency', label: 'Inconsistent Results', icon: '📊', description: 'Unpredictable month to month' },
      { id: 'platforms', label: 'Too Many Platforms', icon: '🌀', description: 'Overwhelmed by channels' },
    ],
  },
];

const SESSION_KEY = 'synthex_onboarding_goals';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: QuestionOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'p-3.5 rounded-xl border text-left transition-all duration-150 w-full',
        selected
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
          : 'bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{option.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-sm font-semibold',
                selected ? 'text-cyan-300' : 'text-white',
              )}
            >
              {option.label}
            </span>
            {selected && (
              <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{option.description}</p>
        </div>
      </div>
    </button>
  );
}

function QuestionBlock({
  question,
  selected,
  onSelect,
}: {
  question: Question;
  selected: string | undefined;
  onSelect: (value: string) => void;
}) {
  const cols = question.options.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{question.heading}</h2>
        {selected && (
          <span className="text-xs text-cyan-400 font-medium">✓</span>
        )}
      </div>
      <div className={cn('grid gap-2', cols)}>
        {question.options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            selected={selected === option.id}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Plan Result Display
// ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: PlatformRecommendation['priority'] }) {
  return (
    <span
      className={cn(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
        priority === 'primary'
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'bg-white/10 text-gray-400',
      )}
    >
      {priority}
    </span>
  );
}

function PlanResults({ plan }: { plan: MarketingPlan }) {
  return (
    <div className="space-y-5">
      {/* Headline + summary */}
      <div className="p-5 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-white">{plan.headline}</h2>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{plan.summary}</p>
            <p className="text-xs text-cyan-500/70 mt-2">
              Estimated time: <span className="font-medium text-cyan-400">{plan.estimatedTimePerWeek}/week</span>
            </p>
          </div>
        </div>
      </div>

      {/* Recommended Platforms */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Recommended Platforms
        </h3>
        <div className="grid gap-2">
          {plan.platforms.map((platform) => (
            <div
              key={platform.name}
              className="p-4 rounded-xl border border-white/8 bg-white/3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-white">{platform.name}</span>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={platform.priority} />
                  <span className="text-xs text-gray-500">{platform.frequency}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">{platform.reason}</p>
              <div className="flex flex-wrap gap-1.5">
                {platform.contentTypes.map((type) => (
                  <span
                    key={type}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Pillars */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Content Pillars
        </h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {plan.contentPillars.map((pillar: ContentPillar) => (
            <div
              key={pillar.name}
              className="p-4 rounded-xl border border-white/8 bg-white/3 space-y-1.5"
            >
              <p className="text-sm font-semibold text-white">{pillar.name}</p>
              <p className="text-xs text-gray-400">{pillar.description}</p>
              <ul className="space-y-0.5">
                {pillar.examples.map((ex) => (
                  <li key={ex} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-cyan-500 mt-0.5">›</span>
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 30-Day Actions */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          First 30 Days — Action Plan
        </h3>
        <div className="p-4 rounded-xl border border-white/8 bg-white/3 space-y-2">
          {plan.thirtyDayActions.map((action, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-gray-300">{action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          90-Day Success Metrics
        </h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {plan.metrics.map((metric) => (
            <div
              key={metric.name}
              className="p-3.5 rounded-xl border border-white/8 bg-white/3"
            >
              <p className="text-xs text-gray-400">{metric.name}</p>
              <p className="text-sm font-semibold text-cyan-400 mt-1">{metric.target}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

type Answers = Partial<GoalsAnswers>;

export default function OnboardingGoalsPage() {
  const router = useRouter();

  const [answers, setAnswers] = useState<Answers>({});
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore cached results on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const data = JSON.parse(cached) as { answers: Answers; plan: MarketingPlan };
        if (data.answers) setAnswers(data.answers);
        if (data.plan) setPlan(data.plan);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const allAnswered =
    QUESTIONS.length > 0 &&
    QUESTIONS.every((q) => answers[q.id] !== undefined);

  const handleSelect = (questionId: keyof GoalsAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value as GoalsAnswers[typeof questionId] }));
    // Clear plan if they change an answer after generating
    if (plan) setPlan(null);
  };

  const handleGenerate = async () => {
    if (!allAnswered) return;

    setGenerating(true);
    setError(null);
    setPlan(null);

    try {
      const res = await fetch('/api/onboarding/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(answers),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to generate plan');
      }

      const generatedPlan = await res.json() as MarketingPlan;
      setPlan(generatedPlan);

      // Cache to sessionStorage
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ answers, plan: generatedPlan }));
      } catch {
        /* storage full — ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const answeredCount = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgress currentStep={3} />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Sparkles className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Build your marketing plan</h1>
        <p className="text-gray-400 max-w-sm mx-auto">
          Answer 6 quick questions and we'll generate a personalised 90-day strategy.
        </p>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto space-y-8">
        {QUESTIONS.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            selected={answers[question.id]}
            onSelect={(value) => handleSelect(question.id, value)}
          />
        ))}

        {/* Progress + Generate */}
        <div className="pt-2 space-y-4">
          {/* Answer progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">
              {answeredCount}/{QUESTIONS.length}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!allAnswered || generating}
            className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating your plan…
              </>
            ) : plan ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate Plan
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate My Plan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Plan Results */}
      {plan && (
        <div className="max-w-2xl mx-auto">
          <PlanResults plan={plan} />
        </div>
      )}

      {/* Actions */}
      <div className="max-w-2xl mx-auto flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/onboarding/socials')}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip for now
        </button>

        <Button
          onClick={() => router.push('/onboarding/socials')}
          disabled={!plan}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <p className="text-center text-xs text-gray-600 pb-2">
        Your plan is saved and can be updated anytime in Settings → Marketing Plan
      </p>
    </div>
  );
}
