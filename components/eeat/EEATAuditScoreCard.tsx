'use client';

/**
 * EEATAuditScoreCard — Phase 90 component
 *
 * Displays an EEATAuditResult (from content-scorer.ts) with 4-pillar breakdown.
 * 2×2 grid layout:
 * - Experience (blue)   | Expertise (purple)
 * - Authority (amber)   | Trust (emerald)
 *
 * @module components/eeat/EEATAuditScoreCard
 */

import { User, BookOpen, Award, Shield } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { EEATAuditResult, EEATDimension } from '@/lib/eeat/audit-types';

// ─── Grade colours ────────────────────────────────────────────────────────────

function gradeColour(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-cyan-400';
    case 'C': return 'text-amber-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default:  return 'text-gray-400';
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'B': return 'bg-cyan-500/20 border-cyan-500/30';
    case 'C': return 'bg-amber-500/20 border-amber-500/30';
    case 'D': return 'bg-orange-500/20 border-orange-500/30';
    case 'F': return 'bg-red-500/20 border-red-500/30';
    default:  return 'bg-gray-500/20 border-gray-500/30';
  }
}

// ─── Pillar config ────────────────────────────────────────────────────────────

type PillarKey = 'experience' | 'expertise' | 'authority' | 'trust';

interface PillarConf {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  barColour: string;
  ringColour: string;
}

const PILLAR_CONFIG: Record<PillarKey, PillarConf> = {
  experience: {
    label: 'Experience',
    Icon: User,
    barColour: 'bg-blue-500',
    ringColour: 'border-blue-500/30 bg-blue-500/10',
  },
  expertise: {
    label: 'Expertise',
    Icon: BookOpen,
    barColour: 'bg-purple-500',
    ringColour: 'border-purple-500/30 bg-purple-500/10',
  },
  authority: {
    label: 'Authority',
    Icon: Award,
    barColour: 'bg-amber-500',
    ringColour: 'border-amber-500/30 bg-amber-500/10',
  },
  trust: {
    label: 'Trust',
    Icon: Shield,
    barColour: 'bg-emerald-500',
    ringColour: 'border-emerald-500/30 bg-emerald-500/10',
  },
};

// ─── PillarCard ───────────────────────────────────────────────────────────────

function PillarCard({
  pillarKey,
  dimension,
}: {
  pillarKey: PillarKey;
  dimension: EEATDimension;
}) {
  const { Icon, label, barColour, ringColour } = PILLAR_CONFIG[pillarKey];
  const pct = Math.round((dimension.score / dimension.maxScore) * 100);
  const detected = dimension.signals.filter(s => s.detected);

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', ringColour)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-white/70" />
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <span className="text-lg font-bold text-white tabular-nums">
          {dimension.score}
          <span className="text-xs text-slate-500 font-normal">/{dimension.maxScore}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColour)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Detected signals */}
      {detected.length > 0 && (
        <div className="space-y-1">
          {detected.map((signal) => (
            <div key={signal.name} className="flex items-start gap-1.5">
              <span className="text-emerald-400 mt-0.5 flex-shrink-0 text-xs">✓</span>
              <span className="text-xs text-emerald-300 leading-tight">{signal.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Missing items */}
      {dimension.missing.length > 0 && (
        <div className="space-y-1 border-t border-white/10 pt-2">
          {dimension.missing.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-amber-400 mt-0.5 flex-shrink-0 text-xs">•</span>
              <span className="text-xs text-amber-200/70 leading-tight">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EEATAuditScoreCard ───────────────────────────────────────────────────────

interface EEATAuditScoreCardProps {
  result: EEATAuditResult;
  className?: string;
}

export function EEATAuditScoreCard({ result, className }: EEATAuditScoreCardProps) {
  const { overallScore, grade, wordCount, auditedAt } = result;
  const auditDate = new Date(auditedAt).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className={cn('bg-white/5 border border-white/10 rounded-xl p-5 space-y-5', className)}>
      {/* Overall score header */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className={cn(
          'flex flex-col items-center justify-center w-28 h-28 rounded-full border-2 flex-shrink-0',
          gradeBg(grade),
        )}>
          <span className={cn('text-4xl font-bold tabular-nums', gradeColour(grade))}>
            {overallScore}
          </span>
          <span className={cn('text-xl font-semibold', gradeColour(grade))}>
            {grade}
          </span>
        </div>
        <div className="flex flex-col gap-1 items-center sm:items-start">
          <p className="text-sm font-semibold text-white">E-E-A-T Score</p>
          <p className="text-xs text-slate-400">
            {wordCount.toLocaleString()} words analysed · {auditDate}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {(['experience', 'expertise', 'authority', 'trust'] as PillarKey[]).map((key) => {
              const dim = result[key];
              return (
                <span
                  key={key}
                  className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 capitalize tabular-nums"
                >
                  {PILLAR_CONFIG[key].label}: {dim.score}/25
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2×2 pillar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <PillarCard pillarKey="experience" dimension={result.experience} />
        <PillarCard pillarKey="expertise" dimension={result.expertise} />
        <PillarCard pillarKey="authority" dimension={result.authority} />
        <PillarCard pillarKey="trust" dimension={result.trust} />
      </div>
    </div>
  );
}
