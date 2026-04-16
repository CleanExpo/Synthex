'use client';

/**
 * AskSynthexPanel — conversational AI query widget for the AI Advisor page.
 *
 * Entry: collapsed "Ask Synthex a question →" button at bottom of the advisor card.
 * Expanded: message history (last 5 exchanges) + text input + send button.
 * Sources: collapsed chevron footer on each AI response.
 * Timeouts: 15 s → "Synthex is thinking — try rephrasing your question."
 * Feature flag: NEXT_PUBLIC_ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT — owners always see it.
 * Debug badge: NEXT_PUBLIC_SYNTHEX_DEBUG_MODE=true → shows model tier on each response.
 *
 * @task SYN-682
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Send, X, Loader2 } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_HISTORY = 5; // last N exchanges shown
const TIMEOUT_MS = 15_000;
const TIMEOUT_MSG = 'Synthex is thinking — try rephrasing your question.';

function isFlagEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT === 'true';
}

function isDebugMode() {
  return process.env.NEXT_PUBLIC_SYNTHEX_DEBUG_MODE === 'true';
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceCitation {
  label: string;
  value: string | number;
  period?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tier?: 'simple' | 'standard' | 'complex';
  sources?: SourceCitation[];
  timedOut?: boolean;
}

interface AskSynthexResponse {
  conversationId: string;
  answer: string;
  tier: 'simple' | 'standard' | 'complex';
  sources?: SourceCitation[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TIER_COLOURS: Record<string, string> = {
  simple: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  complex: 'bg-purple-100 text-purple-700',
};

function TierBadge({ tier }: { tier: string }) {
  if (!isDebugMode()) return null;
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${TIER_COLOURS[tier] ?? TIER_COLOURS.standard}`}
    >
      {tier}
    </span>
  );
}

function SourcesFooter({ sources }: { sources: SourceCitation[] }) {
  const [open, setOpen] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide sources' : 'Show sources'}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <span>Sources</span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 pl-1">
          {sources.map((s, i) => (
            <li key={i} className="text-[11px] text-gray-500 leading-tight">
              <span className="font-medium text-gray-700">{s.label}:</span>{' '}
              {String(s.value)}
              {s.period ? ` (${s.period})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-gray-900 text-white rounded-br-sm'
            : msg.timedOut
              ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="flex-1 whitespace-pre-wrap">{msg.content}</span>
          {!isUser && msg.tier && <TierBadge tier={msg.tier} />}
        </div>
        {!isUser && !msg.timedOut && msg.sources && (
          <SourcesFooter sources={msg.sources} />
        )}
      </div>
    </div>
  );
}

function PulsingLoader() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-xl rounded-bl-sm px-4 py-3">
        <div
          className="flex gap-1.5 items-center"
          aria-label="Synthex is thinking"
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AskSynthexPanelProps {
  /** From useActiveBusiness — gates visibility when flag is off */
  isOwner: boolean;
  /** From useActiveBusiness — required by the API for org-scoped queries */
  clientId?: string | null;
}

export function AskSynthexPanel({ isOwner, clientId }: AskSynthexPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to latest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel expands
  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [expanded]);

  // Feature gate: flag on = all clients see it; flag off = owners only
  if (!isFlagEnabled() && !isOwner) return null;

  // Keep only last MAX_HISTORY exchanges in view (a pair = user + assistant)
  const visibleMessages = messages.slice(-(MAX_HISTORY * 2));

  async function sendMessage() {
    const question = input.trim();
    if (!question || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);

    // Create an AbortController for timeout
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch('/api/ask-synthex', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: conversationId ?? undefined,
          clientId: clientId ?? undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errMsg = body?.error ?? `Request failed (${res.status})`;
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
        return;
      }

      const data: AskSynthexResponse = await res.json();

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          tier: data.tier,
          sources: data.sources ?? [],
        },
      ]);
    } catch (err) {
      clearTimeout(timer);
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('abort'));

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: isTimeout
            ? TIMEOUT_MSG
            : 'Something went wrong. Please try again.',
          timedOut: isTimeout,
        },
      ]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Send on Enter (no shift), newline on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleClose() {
    abortRef.current?.abort();
    setExpanded(false);
  }

  // ── Collapsed entry point ──────────────────────────────────────────────────

  if (!expanded) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900 group transition-colors min-h-[44px] px-2"
          aria-label="Ask Synthex a question"
          aria-expanded="false"
        >
          <span>Ask Synthex a question</span>
          <span className="text-gray-400 group-hover:text-gray-600 transition-colors">
            →
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded conversation panel ────────────────────────────────────────────

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      role="region"
      aria-label="Ask Synthex"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            Ask Synthex
          </span>
          {isDebugMode() && (
            <span className="text-[10px] text-gray-400 font-mono">debug</span>
          )}
        </div>
        <button
          onClick={handleClose}
          aria-label="Close Ask Synthex"
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Message history */}
      <div
        className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
      >
        {visibleMessages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            Ask anything about your content performance, strategy, or algorithm.
          </p>
        )}
        {visibleMessages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {isLoading && <PulsingLoader />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 items-end border border-gray-200 rounded-xl bg-gray-50 p-2 focus-within:border-gray-400 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your content performance…"
            rows={1}
            disabled={isLoading}
            aria-label="Your question"
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none py-1 px-1 max-h-24 disabled:opacity-50 leading-relaxed"
            style={{ minHeight: '28px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send question"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-700 active:bg-gray-800 transition-colors"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 px-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
