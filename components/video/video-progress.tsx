'use client';

/**
 * Video Generation Progress
 *
 * Shows simulated progress bar while the AI generates the video script.
 * Provides status updates during the generation process.
 */

import { useEffect, useState } from 'react';
import { Loader2, Check, AlertTriangle } from '@/components/icons';
import { Progress } from '@/components/ui/progress';

interface VideoProgressProps {
  status: 'generating' | 'rendered' | 'failed';
  errorMessage?: string;
}

const PROGRESS_STEPS = [
  { label: 'Analysing topic...', progress: 15 },
  { label: 'Writing script outline...', progress: 35 },
  { label: 'Generating scene descriptions...', progress: 55 },
  { label: 'Creating voiceover text...', progress: 75 },
  { label: 'Finalising script...', progress: 90 },
];

export function VideoProgress({ status, errorMessage }: VideoProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status !== 'generating') {
      if (status === 'rendered') setProgress(100);
      return;
    }

    // Simulate progress through steps
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= PROGRESS_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === 'rendered') {
      setProgress(100);
      return;
    }
    if (status === 'generating' && currentStep < PROGRESS_STEPS.length) {
      setProgress(PROGRESS_STEPS[currentStep].progress);
    }
  }, [currentStep, status]);

  if (status === 'failed') {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 font-medium text-sm">Generation Failed</span>
        </div>
        <p className="text-red-400/80 text-xs">
          {errorMessage || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
    );
  }

  if (status === 'rendered') {
    return (
      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 font-medium text-sm">Script generated successfully</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Progress
        value={progress}
        variant="glass-primary"
        size="sm"
        indicatorVariant="glass-primary"
        animated
      />
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
        <span className="text-sm text-gray-400">
          {currentStep < PROGRESS_STEPS.length
            ? PROGRESS_STEPS[currentStep].label
            : 'Almost there...'}
        </span>
      </div>
    </div>
  );
}
