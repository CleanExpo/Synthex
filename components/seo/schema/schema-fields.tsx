'use client';

/**
 * Schema Fields Component
 * Dynamic form fields based on schema type
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SchemaField } from './types';

interface SchemaFieldsProps {
  fields: SchemaField[];
  formData: Record<string, string | number>;
  onFieldChange: (name: string, value: string | number) => void;
}

export function SchemaFields({ fields, formData, onFieldChange }: SchemaFieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {field.type === 'textarea' ? (
            <Textarea
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={formData[field.name] || ''}
              onChange={(e) => onFieldChange(field.name, e.target.value)}
              className="bg-white/5 border-white/10 text-white min-h-[80px]"
            />
          ) : (
            <Input
              type={field.type === 'number' ? 'number' : 'text'}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={formData[field.name] || ''}
              onChange={(e) =>
                onFieldChange(
                  field.name,
                  field.type === 'number' ? parseFloat(e.target.value) : e.target.value
                )
              }
              className="bg-white/5 border-white/10 text-white"
            />
          )}
        </div>
      ))}
    </div>
  );
}
