'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface InputTagsProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function InputTags({
  value,
  onChange,
  placeholder = 'Add a tag',
  maxTags,
  className,
  disabled = false,
  id,
}: InputTagsProps) {
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some(t => t.toLowerCase() === tag.toLowerCase())) return;
    if (maxTags !== undefined && value.length >= maxTags) return;
    onChange([...value, tag]);
    setInputValue('');
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw.endsWith(',')) {
      addTag(raw.slice(0, -1));
    } else {
      setInputValue(raw);
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  }

  const atMax = maxTags !== undefined && value.length >= maxTags;

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 items-center',
        'border-[0.5px] border-white/[0.06] rounded-sm bg-[#0a0a0a] p-1.5',
        'focus-within:border-orange-500/40 focus-within:ring-[2px] focus-within:ring-orange-500/10',
        'transition-colors duration-200',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className={cn(
            'h-6 inline-flex items-center gap-1 relative',
            'bg-orange-500/[0.10] border-[0.5px] border-orange-500/20',
            'rounded-sm font-medium text-xs text-orange-300',
            'ps-2 pe-1 select-none'
          )}
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                removeTag(index);
              }}
              className={cn(
                'flex items-center justify-center w-4 h-4 rounded-sm',
                'text-orange-300/60 hover:text-orange-300 transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500/40'
              )}
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {!atMax && (
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-[80px] h-6 bg-transparent outline-none',
            'text-xs text-white placeholder:text-white/40',
            'focus-visible:outline-none shadow-none px-1.5'
          )}
        />
      )}

      {atMax && value.length > 0 && inputValue === '' && (
        <span className="text-xs text-white/50 px-1.5">Max tags reached</span>
      )}
    </div>
  );
}

export { InputTags };
