'use client';

/**
 * AskMargotButton — floating bottom-right chat trigger
 *
 * Opens a modal that sends messages to /api/hermes/chat.
 * Self-contained — no extra dependencies.
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HermesChatResponse {
  reply?: string;
  message?: string;
  error?: string;
}

export function AskMargotButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data: HermesChatResponse = await res.json().catch(() => ({}));
      const reply =
        data.reply ?? data.message ?? (res.ok ? '…' : 'No response');

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not reach Margot. Check your connection.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Margot"
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'h-12 w-12 rounded-sm',
          'border-[0.5px] border-orange-500/40 bg-[#0a0a12]',
          'flex items-center justify-center',
          'shadow-lg shadow-orange-500/10',
          'hover:border-orange-500/70 hover:bg-orange-500/[0.06] transition-colors',
          open && 'hidden'
        )}
      >
        <span className="text-xl">🤖</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Ask Margot"
        >
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm flex flex-col border-[0.5px] border-white/[0.08] bg-[#0a0a12] rounded-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="text-sm font-light text-white">
                  Ask Margot
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Message history */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[8rem]">
              {messages.length === 0 && (
                <p className="text-xs text-white/30 text-center pt-4">
                  Ask Margot anything about your campaigns, analytics, or next
                  steps.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] px-3 py-2 rounded-sm text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-auto bg-orange-500/[0.12] border-[0.5px] border-orange-500/20 text-white/90'
                      : 'mr-auto bg-white/[0.03] border-[0.5px] border-white/[0.08] text-white/70'
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {sending && (
                <div className="mr-auto px-3 py-2 rounded-sm bg-white/[0.03] border-[0.5px] border-white/[0.08] text-white/40 text-xs">
                  Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t-[0.5px] border-white/[0.06] p-3 flex gap-2 items-end">
              <textarea
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Margot…"
                className="flex-1 resize-none bg-white/[0.03] border-[0.5px] border-white/[0.08] rounded-sm px-3 py-2 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-orange-500/30 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className={cn(
                  'px-3 py-2 rounded-sm text-xs font-medium tracking-wide transition-colors',
                  'bg-orange-500/[0.12] border-[0.5px] border-orange-500/30 text-orange-300',
                  'hover:bg-orange-500/[0.2] disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
