'use client';

/**
 * Media Selector Component
 * Select media attachment type
 */

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MediaType } from './types';

interface MediaSelectorProps {
  value: MediaType;
  onChange: (value: MediaType) => void;
}

export function MediaSelector({ value, onChange }: MediaSelectorProps) {
  return (
    <div>
      <Label className="text-gray-400">Media Attachment</Label>
      <Select value={value} onValueChange={(v) => onChange(v as MediaType)}>
        <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Media</SelectItem>
          <SelectItem value="image">Image</SelectItem>
          <SelectItem value="video">Video</SelectItem>
          <SelectItem value="gif">GIF</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
