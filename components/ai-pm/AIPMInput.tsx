'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

interface AIPMInputProps {
  onSend: (message: string) => void;
  isSending: boolean;
  disabled?: boolean;
}

const quickActions = [
  { label: 'Weekly Summary', prompt: 'Give me a summary of my performance this week' },
  { label: 'Content Ideas', prompt: 'Suggest content ideas based on my best-performing posts' },
  { label: 'Performance Review', prompt: 'How is my content performing? What should I improve?' },
];

export default function AIPMInput({ onSend, isSending, disabled }: AIPMInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isSending || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-white/5 p-4">
      {/* Quick action chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              if (!isSending && !disabled) {
                onSend(action.prompt);
              }
            }}
            disabled={isSending || disabled}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI PM anything..."
            disabled={isSending || disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50"
            maxLength={5000}
          />
          {value.length > 4000 && (
            <span className="absolute right-2 top-1 text-[10px] text-gray-500">
              {value.length}/5000
            </span>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={!value.trim() || isSending || disabled}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
