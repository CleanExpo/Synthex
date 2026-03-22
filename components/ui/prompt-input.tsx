'use client';

import * as React from 'react';
import { Paperclip, ArrowUp, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromptInputProps {
  /** Current value of the prompt textarea */
  value?: string;
  /** Callback when the value changes */
  onChange?: (value: string) => void;
  /** Placeholder text shown when the input is empty */
  placeholder?: string;
  /** Whether the input is in a loading/streaming state — shows Stop button */
  isLoading?: boolean;
  /** Called when the user submits (Enter without Shift, or clicks Send) */
  onSubmit?: (value: string) => void;
  /** Called when the user clicks the Stop button during loading */
  onStop?: () => void;
  /** Called when files are selected via the attachment button */
  onAttach?: (files: FileList) => void;
  /** Whether the send/stop button is disabled */
  disabled?: boolean;
  /** Maximum rows before the textarea stops growing */
  maxRows?: number;
  /** Class names applied to the outer wrapper */
  className?: string;
  /** Class names applied to the textarea */
  textareaClassName?: string;
  /** Whether to show the file attachment button */
  showAttach?: boolean;
  /** Accept attribute forwarded to the hidden file input */
  acceptedFileTypes?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PromptInput({
  value: controlledValue,
  onChange,
  placeholder = 'Message…',
  isLoading = false,
  onSubmit,
  onStop,
  onAttach,
  disabled = false,
  maxRows = 8,
  className,
  textareaClassName,
  showAttach = true,
  acceptedFileTypes = '*',
}: PromptInputProps) {
  const [internalValue, setInternalValue] = React.useState('');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-resize the textarea up to maxRows
  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxRows]);

  React.useEffect(() => {
    resize();
  }, [value, resize]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit?.(value.trim());
        if (!isControlled) setInternalValue('');
      }
    }
  };

  const handleSubmit = () => {
    if (!isLoading && value.trim()) {
      onSubmit?.(value.trim());
      if (!isControlled) setInternalValue('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttach?.(e.target.files);
      // Reset so the same file can be re-attached if needed
      e.target.value = '';
    }
  };

  const canSend = !disabled && !isLoading && value.trim().length > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col w-full rounded-sm border-[0.5px] border-white/[0.08] bg-[#050505]',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-colors',
        'focus-within:border-orange-500/30',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-white',
          'placeholder:text-white/70 outline-none',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10',
          textareaClassName
        )}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        {/* Left: file attachment */}
        <div className="flex items-center gap-1">
          {showAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedFileTypes}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 text-white/50 hover:text-white/70 hover:bg-white/[0.04] rounded-sm"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Right: send / stop */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/50 select-none hidden sm:block">
            Shift+Enter for new line
          </span>

          {isLoading ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Stop generation"
              onClick={onStop}
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/[0.06] border-[0.5px] border-white/[0.08] rounded-sm"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              aria-label="Send message"
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                'h-7 w-7 rounded-sm transition-all',
                canSend
                  ? 'bg-orange-500 text-[#050505] hover:bg-orange-400'
                  : 'bg-white/[0.04] text-white/50 border-[0.5px] border-white/[0.06] cursor-not-allowed'
              )}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PromptInput;
