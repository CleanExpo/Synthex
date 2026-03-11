'use client';

/**
 * ExperimentWizard
 *
 * 3-step form for creating a new SEO experiment.
 * Step 1: Experiment type selection
 * Step 2: URL + hypothesis
 * Step 3: Original + variant values
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Globe,
  Code,
  Layers,
  Link2,
  ChevronRight,
  ChevronLeft,
  Beaker,
  CheckCircle,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type ExperimentType =
  | 'title-tag'
  | 'meta-description'
  | 'h1'
  | 'schema'
  | 'content-structure'
  | 'internal-links';

type MetricToTrack =
  | 'geo-score'
  | 'eeat-score'
  | 'quality-score'
  | 'position'
  | 'clicks';

interface ExperimentWizardProps {
  onCreated?: () => void;
  onClose?: () => void;
}

// ============================================================================
// Config
// ============================================================================

const EXPERIMENT_TYPES: Array<{
  value: ExperimentType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colour: string;
}> = [
  {
    value: 'title-tag',
    label: 'Title Tag',
    description: 'Test different <title> values for CTR and ranking impact',
    icon: FileText,
    colour: 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10',
  },
  {
    value: 'meta-description',
    label: 'Meta Description',
    description: 'Test meta description variants for click-through improvement',
    icon: FileText,
    colour: 'border-purple-500/40 text-purple-400 hover:bg-purple-500/10',
  },
  {
    value: 'h1',
    label: 'H1 Heading',
    description: 'Test H1 variants for GEO citability and entity prominence',
    icon: Globe,
    colour: 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10',
  },
  {
    value: 'schema',
    label: 'Schema Markup',
    description: 'Test structured data additions for rich results eligibility',
    icon: Code,
    colour: 'border-green-500/40 text-green-400 hover:bg-green-500/10',
  },
  {
    value: 'content-structure',
    label: 'Content Structure',
    description: 'Test content formatting, passage structure, author attribution',
    icon: Layers,
    colour: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
  },
  {
    value: 'internal-links',
    label: 'Internal Links',
    description: 'Test internal linking patterns for topical authority and UX',
    icon: Link2,
    colour: 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10',
  },
];

const METRICS: Array<{ value: MetricToTrack; label: string }> = [
  { value: 'geo-score', label: 'GEO Score' },
  { value: 'eeat-score', label: 'E-E-A-T Score' },
  { value: 'quality-score', label: 'Quality Score' },
  { value: 'position', label: 'Search Position' },
  { value: 'clicks', label: 'Organic Clicks' },
];

// ============================================================================
// Component
// ============================================================================

export function ExperimentWizard({ onCreated, onClose }: ExperimentWizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [experimentType, setExperimentType] = useState<ExperimentType | null>(null);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [metricToTrack, setMetricToTrack] = useState<MetricToTrack>('geo-score');
  const [originalValue, setOriginalValue] = useState('');
  const [variantValue, setVariantValue] = useState('');

  const canProceedStep1 = experimentType !== null;
  const canProceedStep2 =
    name.length >= 3 && targetUrl.length > 5 && hypothesis.length >= 10;
  const canSubmit =
    originalValue.length >= 1 && variantValue.length >= 1;

  async function handleSubmit() {
    if (!experimentType) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/experiments/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          experimentType,
          targetUrl,
          hypothesis,
          metricToTrack,
          originalValue,
          variantValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create experiment');
      }

      toast.success('Experiment created — ready to start when you are.');
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                step > s
                  ? 'bg-green-500 text-white'
                  : step === s
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white/10 text-gray-400'
              )}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  'h-px w-8',
                  step > s ? 'bg-green-500' : 'bg-white/10'
                )}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-gray-400">
          {step === 1 && 'Select Type'}
          {step === 2 && 'Details'}
          {step === 3 && 'Values'}
        </span>
      </div>

      {/* Step 1: Experiment type */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              What element are you testing?
            </h3>
            <p className="text-xs text-gray-400">
              Choose the SEO element you want to A/B test.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXPERIMENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setExperimentType(type.value)}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border text-left transition-all',
                  type.colour,
                  experimentType === type.value
                    ? 'border-opacity-100 ring-1 ring-current'
                    : 'border-white/10 hover:border-opacity-60'
                )}
              >
                <type.icon className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{type.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{type.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: URL + hypothesis */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">Experiment details</h3>
            <p className="text-xs text-gray-400">
              Describe what you are testing and why.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="exp-name" className="text-xs text-gray-400">
                Experiment name
              </Label>
              <Input
                id="exp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Add entity name to homepage H1"
                className="mt-1 bg-white/5 border-white/10 text-white"
              />
            </div>

            <div>
              <Label htmlFor="exp-url" className="text-xs text-gray-400">
                Target URL
              </Label>
              <Input
                id="exp-url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="mt-1 bg-white/5 border-white/10 text-white"
              />
            </div>

            <div>
              <Label htmlFor="exp-hypothesis" className="text-xs text-gray-400">
                Hypothesis
              </Label>
              <Textarea
                id="exp-hypothesis"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="If I change [X] to [Y], then [metric] will improve because [reason]..."
                rows={3}
                className="mt-1 bg-white/5 border-white/10 text-white resize-none"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Metric to track</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {METRICS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMetricToTrack(m.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
                      metricToTrack === m.value
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Original + variant values */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              Define the variants
            </h3>
            <p className="text-xs text-gray-400">
              Enter the current value and the variant you want to test.
            </p>
            {experimentType && (
              <Badge className="mt-2 text-xs bg-cyan-500/20 text-cyan-300">
                Testing: {EXPERIMENT_TYPES.find((t) => t.value === experimentType)?.label}
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="exp-original" className="text-xs text-gray-400">
                Original (current value)
              </Label>
              <Textarea
                id="exp-original"
                value={originalValue}
                onChange={(e) => setOriginalValue(e.target.value)}
                placeholder="The current value of this element..."
                rows={3}
                className="mt-1 bg-white/5 border-white/10 text-white resize-none"
              />
            </div>

            <div>
              <Label htmlFor="exp-variant" className="text-xs text-gray-400">
                Variant (what you want to test)
              </Label>
              <Textarea
                id="exp-variant"
                value={variantValue}
                onChange={(e) => setVariantValue(e.target.value)}
                placeholder="The new value you want to try..."
                rows={3}
                className="mt-1 bg-cyan-500/5 border-cyan-500/20 text-white resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Back
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-gray-400"
            >
              Cancel
            </Button>
          )}
        </div>

        <div>
          {step < 3 && (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
              className="gradient-primary text-white"
            >
              Next
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="gradient-primary text-white"
            >
              <Beaker className="w-3 h-3 mr-1" />
              {submitting ? 'Creating...' : 'Create Experiment'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
