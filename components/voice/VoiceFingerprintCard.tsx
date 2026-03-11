'use client';

import { cn } from '@/lib/utils';
import type { VoiceFingerprint } from '@/lib/voice/types';

interface VoiceFingerprintCardProps {
  fingerprint: VoiceFingerprint;
  className?: string;
}

// ---------------------------------------------------------------------------
// Flesch Reading Ease → human grade description
// ---------------------------------------------------------------------------

function fleschGrade(score: number): string {
  if (score >= 90) return '5th grade';
  if (score >= 70) return '8th grade';
  if (score >= 60) return '10th grade';
  if (score >= 50) return 'College student';
  return 'College graduate';
}

// ---------------------------------------------------------------------------
// Auto-generate trait badges from fingerprint values
// ---------------------------------------------------------------------------

function deriveTraits(fp: VoiceFingerprint): string[] {
  const traits: string[] = [];

  if (fp.firstPersonRate > 0.03) traits.push('First-person');
  if (fp.fleschReadingEase >= 70) traits.push('Accessible');
  if (fp.fleschReadingEase < 40) traits.push('Academic');
  if (fp.ttr > 0.65) traits.push('Varied vocabulary');
  if (fp.ttr < 0.35) traits.push('Repetitive');
  if (fp.sentenceLengths.stdDev > 8) traits.push('Varied rhythm');
  if (fp.sentenceLengths.stdDev < 3) traits.push('Measured pace');
  if (fp.sentenceLengths.mean < 12) traits.push('Punchy');
  if (fp.sentenceLengths.mean > 25) traits.push('Long-form');
  if (fp.questionRate > 1.0) traits.push('Inquisitive');
  if (fp.emDashRate > 1.0) traits.push('Editorial style');
  if (fp.adverbDensity < 1.5) traits.push('Lean');
  if (fp.passiveVoiceEstimate < 0.1) traits.push('Active voice');
  if (fp.passiveVoiceEstimate > 0.3) traits.push('Passive tendency');
  if (fp.avgWordLength < 4.5 && fp.fleschReadingEase >= 70) traits.push('Conversational');

  return traits.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Metric bar — coloured progress bar for a normalised 0-100 value
// ---------------------------------------------------------------------------

interface MetricBarProps {
  label: string;
  value: string;
  subLabel?: string;
  barPct: number; // 0–100
  barColour?: string;
}

function MetricBar({ label, value, subLabel, barPct, barColour = 'bg-cyan-500' }: MetricBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-400 truncate">{label}</span>
        <span className="text-sm font-semibold text-white flex-shrink-0">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColour)}
          style={{ width: `${Math.max(2, Math.min(100, barPct))}%` }}
        />
      </div>
      {subLabel && (
        <span className="text-xs text-slate-500">{subLabel}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoiceFingerprintCard
// ---------------------------------------------------------------------------

export function VoiceFingerprintCard({ fingerprint: fp, className }: VoiceFingerprintCardProps) {
  const traits = deriveTraits(fp);
  const ttrPct = Math.round(fp.ttr * 100);
  const ttrLabel = ttrPct >= 60 ? 'High diversity' : ttrPct >= 40 ? 'Medium diversity' : 'Accessible vocabulary';
  const firstPersonPct = Math.round(fp.firstPersonRate * 100);
  const firstPersonLabel = fp.firstPersonRate > 0.02 ? 'Personal' : 'Institutional';
  const passivePct = Math.round(fp.passiveVoiceEstimate * 100);
  const passiveLabel = fp.passiveVoiceEstimate < 0.1 ? 'Active tendency' : fp.passiveVoiceEstimate > 0.3 ? 'Passive tendency' : 'Mixed';
  const adverbLabel = fp.adverbDensity < 2 ? 'Lean' : fp.adverbDensity > 5 ? 'Modifier-heavy' : 'Moderate';

  return (
    <div className={cn('bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-centre justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-white">Voice Fingerprint</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Analysed {fp.sampleWordCount.toLocaleString()} words · {fp.sampleSentenceCount} sentences
          </p>
        </div>
        <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded-full flex-shrink-0">
          {fp.sampleWordCount} words
        </span>
      </div>

      {/* Metrics grid — 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Sentence Rhythm */}
        <MetricBar
          label="Sentence Rhythm"
          value={`${fp.sentenceLengths.mean} ±${fp.sentenceLengths.stdDev} words`}
          subLabel={`Min ${fp.sentenceLengths.min} / Max ${fp.sentenceLengths.max}`}
          barPct={(fp.sentenceLengths.mean / 40) * 100}
          barColour="bg-violet-500"
        />

        {/* Vocabulary Diversity */}
        <MetricBar
          label="Vocabulary Diversity"
          value={`${ttrPct}%`}
          subLabel={ttrLabel}
          barPct={ttrPct}
          barColour={ttrPct >= 60 ? 'bg-emerald-500' : ttrPct >= 40 ? 'bg-amber-500' : 'bg-slate-500'}
        />

        {/* Reading Level */}
        <MetricBar
          label="Reading Level (Flesch)"
          value={fp.fleschReadingEase.toString()}
          subLabel={fleschGrade(fp.fleschReadingEase)}
          barPct={fp.fleschReadingEase}
          barColour={fp.fleschReadingEase >= 70 ? 'bg-emerald-500' : fp.fleschReadingEase >= 50 ? 'bg-amber-500' : 'bg-red-500'}
        />

        {/* First Person Rate */}
        <MetricBar
          label="First-person Rate"
          value={`${fp.firstPersonRate.toFixed(2)} per 100w`}
          subLabel={firstPersonLabel}
          barPct={Math.min(100, firstPersonPct * 5)}
          barColour="bg-blue-500"
        />

        {/* Question Rate */}
        <MetricBar
          label="Question Rate"
          value={`${fp.questionRate.toFixed(2)} per 100w`}
          barPct={Math.min(100, fp.questionRate * 20)}
          barColour="bg-cyan-500"
        />

        {/* Em Dash Usage */}
        <MetricBar
          label="Em-dash Usage"
          value={`${fp.emDashRate.toFixed(2)} per 100w`}
          subLabel={fp.emDashRate > 1.0 ? 'High editorial style' : 'Low editorial style'}
          barPct={Math.min(100, fp.emDashRate * 20)}
          barColour="bg-pink-500"
        />

        {/* Adverb Density */}
        <MetricBar
          label="Adverb Density"
          value={`${fp.adverbDensity.toFixed(2)} per 100w`}
          subLabel={adverbLabel}
          barPct={Math.min(100, fp.adverbDensity * 10)}
          barColour={fp.adverbDensity < 2 ? 'bg-emerald-500' : 'bg-amber-500'}
        />

        {/* Passive Voice */}
        <MetricBar
          label="Passive Voice"
          value={`${passivePct}%`}
          subLabel={passiveLabel}
          barPct={passivePct}
          barColour={passivePct < 10 ? 'bg-emerald-500' : passivePct > 30 ? 'bg-red-500' : 'bg-amber-500'}
        />
      </div>

      {/* Trait Badges */}
      {traits.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Writing traits</p>
          <div className="flex flex-wrap gap-1.5">
            {traits.map((trait) => (
              <span
                key={trait}
                className="text-xs bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
