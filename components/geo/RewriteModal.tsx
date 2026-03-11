'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GEOTactic } from '@/lib/geo/types';

interface RewriteModalProps {
  isOpen: boolean;
  tactic: GEOTactic | null;
  tacticLabel: string;
  originalContent: string;
  onAccept: (rewrittenContent: string) => void;
  onReject: () => void;
}

// ─── SSE Parser ────────────────────────────────────────────────────────────────

async function* parseSSE(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield line.slice(6).trim();
      }
    }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RewriteModal({
  isOpen,
  tactic,
  tacticLabel,
  originalContent,
  onAccept,
  onReject,
}: RewriteModalProps) {
  const [rewrittenContent, setRewrittenContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runRewrite = useCallback(async () => {
    if (!tactic || !originalContent) return;

    setRewrittenContent('');
    setIsStreaming(true);
    setIsDone(false);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/geo/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: originalContent, tactic }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Rewrite request failed');
        setIsStreaming(false);
        return;
      }

      // Handle non-streaming JSON fallback
      const contentType = res.headers.get('Content-Type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json();
        setRewrittenContent(data?.data?.rewrittenContent ?? '');
        setIsDone(true);
        setIsStreaming(false);
        return;
      }

      // Streaming SSE
      const reader = res.body!.getReader();
      for await (const dataStr of parseSSE(reader)) {
        if (dataStr === '[DONE]') {
          setIsDone(true);
          break;
        }
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            setError(parsed.error);
            break;
          }
          if (parsed.text) {
            setRewrittenContent(prev => prev + parsed.text);
          }
        } catch {
          // skip malformed frames
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Rewrite failed');
      }
    } finally {
      setIsStreaming(false);
    }
  }, [tactic, originalContent]);

  // Trigger rewrite when modal opens
  useEffect(() => {
    if (isOpen && tactic) {
      runRewrite();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [isOpen, tactic, runRewrite]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-centre justify-centre z-50 p-4">
      <div className="bg-[#0f172a] border border-cyan-500/10 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-centre justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">
              Improving: <span className="text-cyan-400">{tacticLabel}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isStreaming ? 'Rewriting your content...' : isDone ? 'Done — review and accept or reject' : 'Ready'}
            </p>
          </div>
          <button
            onClick={onReject}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-[200px] mb-4">
          {error ? (
            <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-lg">
              <p className="font-medium">Rewrite failed</p>
              <p className="text-xs mt-1 text-red-300">{error}</p>
              <button
                onClick={runRewrite}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg p-4 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[200px]">
              {rewrittenContent}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-0.5 align-text-bottom" />
              )}
              {!rewrittenContent && !isStreaming && !error && (
                <span className="text-slate-600 not-italic font-sans">Waiting for rewrite...</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-centre justify-end gap-3 flex-shrink-0 border-t border-white/5 pt-4">
          <button
            onClick={onReject}
            className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => onAccept(rewrittenContent)}
            disabled={isStreaming || !isDone || !rewrittenContent}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ✓ Accept
          </button>
        </div>
      </div>
    </div>
  );
}
