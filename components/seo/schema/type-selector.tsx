'use client';

/**
 * Schema Type Selector
 * Dropdown for selecting schema type
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCHEMA_TYPES } from './config';

interface TypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-300 mb-2 block">Schema Type</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white/5 border-white/10 text-white">
          <SelectValue placeholder="Select schema type" />
        </SelectTrigger>
        <SelectContent className="bg-surface-base border-white/10">
          {SCHEMA_TYPES.map((type) => (
            <SelectItem
              key={type.value}
              value={type.value}
              className="text-white hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <type.icon className="w-4 h-4 text-cyan-400" />
                <span>{type.label}</span>
                <span className="text-gray-500 text-xs">- {type.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
