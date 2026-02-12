'use client';

/**
 * Content Input Component
 * Textarea with character and word counts
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ContentInputProps {
  content: string;
  onChange: (content: string) => void;
  maxChars: number;
  characterCount: number;
  wordCount: number;
}

export function ContentInput({
  content,
  onChange,
  maxChars,
  characterCount,
  wordCount
}: ContentInputProps) {
  return (
    <div>
      <Label htmlFor="content" className="text-gray-400">Content</Label>
      <Textarea
        id="content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing your content..."
        className="min-h-[300px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 mt-2"
        maxLength={maxChars}
      />
      <div className="flex justify-between text-xs mt-2">
        <span className="text-gray-500">
          {wordCount} words · {characterCount} characters
        </span>
        <span className={characterCount > maxChars ? 'text-red-400' : 'text-gray-500'}>
          {characterCount} / {maxChars}
        </span>
      </div>
    </div>
  );
}
