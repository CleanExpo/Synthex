/**
 * Chat Input Component
 *
 * @description Textarea input with auto-resize for sending chat messages.
 * Supports Enter to send, Shift+Enter for newline.
 */

'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 3000;
const MAX_ROWS = 4;
const LINE_HEIGHT = 24; // px

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about content strategy, ideas, or optimization...',
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = !content.trim();
  const charCount = content.length;
  const isOverLimit = charCount > MAX_LENGTH;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to calculate scrollHeight
      textarea.style.height = 'auto';
      // Set height up to max rows
      const maxHeight = LINE_HEIGHT * MAX_ROWS;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [content]);

  const handleSend = () => {
    if (isEmpty || disabled || isOverLimit) return;

    onSend(content.trim());
    setContent('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl px-4 py-3 text-sm',
              'bg-white/5 border border-white/10 text-white placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200',
              isOverLimit && 'border-red-500/50 focus:ring-red-500/50'
            )}
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={isEmpty || disabled || isOverLimit}
          size="icon"
          className={cn(
            'h-11 w-11 rounded-xl shrink-0',
            'bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
        >
          <Send className="h-4 w-4 text-cyan-400" />
        </Button>
      </div>

      {/* Character count */}
      <div className="flex justify-between items-center px-1 text-xs">
        <span className="text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </span>
        <span
          className={cn(
            isOverLimit ? 'text-red-400' : 'text-gray-500'
          )}
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
