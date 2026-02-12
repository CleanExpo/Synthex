'use client';

/**
 * FAQ Editor Component
 * Editor for FAQ schema questions and answers
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FAQItem } from './types';

interface FAQEditorProps {
  items: FAQItem[];
  onItemChange: (index: number, field: 'question' | 'answer', value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

export function FAQEditor({
  items,
  onItemChange,
  onAddItem,
  onRemoveItem,
}: FAQEditorProps) {
  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-gray-300">Questions & Answers</label>
      {items.map((item, index) => (
        <div key={index} className="space-y-2 p-4 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Q{index + 1}</span>
            {items.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(index)}
                className="text-red-400 hover:text-red-300"
              >
                Remove
              </Button>
            )}
          </div>
          <Input
            placeholder="Question"
            value={item.question}
            onChange={(e) => onItemChange(index, 'question', e.target.value)}
            className="bg-white/5 border-white/10 text-white"
          />
          <Textarea
            placeholder="Answer"
            value={item.answer}
            onChange={(e) => onItemChange(index, 'answer', e.target.value)}
            className="bg-white/5 border-white/10 text-white min-h-[80px]"
          />
        </div>
      ))}
      <Button
        variant="outline"
        onClick={onAddItem}
        className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
      >
        Add Another Question
      </Button>
    </div>
  );
}
