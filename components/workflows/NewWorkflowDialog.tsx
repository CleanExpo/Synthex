'use client';

/**
 * NewWorkflowDialog — Two-step dialog to start a new workflow execution.
 * Step 1: Select a template or choose Ad-hoc.
 * Step 2: Enter title + optional JSON input data.
 * Submits to POST /api/workflows/executions.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkflowTemplates } from '@/lib/workflow/hooks/use-workflow-executions';
import type { WorkflowExecution, WorkflowTemplate } from '@/lib/workflow/hooks/use-workflow-executions';
import { ChevronRight, ChevronLeft } from '@/components/icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (exec: WorkflowExecution) => void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type Step = 1 | 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewWorkflowDialog({
  open,
  onOpenChange,
  onCreated,
}: NewWorkflowDialogProps) {
  const { templates, isLoading: loadingTemplates } = useWorkflowTemplates();

  const [step, setStep] = useState<Step>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [isAdHoc, setIsAdHoc] = useState(false);
  const [title, setTitle] = useState('');
  const [inputDataRaw, setInputDataRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedTemplate(null);
      setIsAdHoc(false);
      setTitle('');
      setInputDataRaw('');
      setError(null);
    }
  }, [open]);

  // Pre-fill title from template name
  useEffect(() => {
    if (selectedTemplate && !title) {
      setTitle(selectedTemplate.name);
    }
  }, [selectedTemplate]);

  // -------------------------------------------------------------------------
  // Step 1 → Step 2
  // -------------------------------------------------------------------------

  function handleNext() {
    if (!selectedTemplate && !isAdHoc) {
      setError('Please select a template or choose Ad-hoc.');
      return;
    }
    setError(null);
    setStep(2);
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Please enter a workflow title.');
      return;
    }

    // Validate JSON if provided
    let inputData: unknown = undefined;
    if (inputDataRaw.trim()) {
      try {
        inputData = JSON.parse(inputDataRaw);
      } catch {
        setError('Input data must be valid JSON.');
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/workflows/executions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          templateId: selectedTemplate?.id ?? undefined,
          inputData,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to create workflow (${res.status})`);
      }

      const data = (await res.json()) as { execution: WorkflowExecution };
      onCreated(data.execution);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="glass-solid" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Start New Workflow</DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 1 ? 'Choose a template or start ad-hoc.' : 'Name your workflow and provide input data.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span className={cn(step === 1 ? 'text-cyan-400 font-semibold' : 'text-gray-500')}>
            1 Template
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className={cn(step === 2 ? 'text-cyan-400 font-semibold' : 'text-gray-500')}>
            2 Details
          </span>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STEP 1 — Template selection                                         */}
        {/* ----------------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Ad-hoc option */}
            <button
              type="button"
              onClick={() => { setIsAdHoc(true); setSelectedTemplate(null); }}
              className={cn(
                'w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all',
                'bg-white/[0.02] hover:bg-white/[0.05]',
                isAdHoc
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
                  : 'border-white/10 hover:border-white/20'
              )}
            >
              <p className="font-medium text-white">Ad-hoc (no template)</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Define steps manually or run a custom workflow.</p>
            </button>

            {/* Templates */}
            {loadingTemplates ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-white/5 animate-pulse border border-white/10"
                  />
                ))}
              </div>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => { setSelectedTemplate(tpl); setIsAdHoc(false); }}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all',
                    'bg-white/[0.02] hover:bg-white/[0.05]',
                    selectedTemplate?.id === tpl.id
                      ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
                      : 'border-white/10 hover:border-white/20'
                  )}
                >
                  <p className="font-medium text-white truncate">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{tpl.description}</p>
                  )}
                </button>
              ))
            )}

            {!loadingTemplates && templates.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No templates available.</p>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STEP 2 — Title + Input data                                         */}
        {/* ----------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Workflow title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g. Blog Post Campaign — March 2026"
                className="w-full rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 px-3 py-2 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Input data */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Input data <span className="text-gray-600">(optional JSON)</span>
              </label>
              <textarea
                rows={4}
                value={inputDataRaw}
                onChange={(e) => setInputDataRaw(e.target.value)}
                placeholder='{ "topic": "AI marketing trends", "tone": "professional" }'
                className="w-full rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 px-3 py-2 resize-none font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Footer                                                              */}
        {/* ----------------------------------------------------------------- */}
        <DialogFooter className="gap-2 sm:gap-2">
          {step === 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep(1); setError(null); }}
              disabled={submitting}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button
              size="sm"
              onClick={handleNext}
              className="gradient-primary text-white"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}

          {step === 2 && (
            <Button
              size="sm"
              disabled={submitting}
              onClick={handleSubmit}
              className="gradient-primary text-white"
            >
              {submitting ? (
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin mr-1.5" />
              ) : null}
              Start Workflow
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
