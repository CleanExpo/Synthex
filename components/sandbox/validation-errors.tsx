'use client';

/**
 * Validation Errors Component
 * Display content validation issues
 */

import { AlertCircle, XCircle } from '@/components/icons';

interface ValidationErrorsProps {
  errors: string[];
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
      <div className="flex items-center mb-2">
        <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
        <p className="text-sm font-medium text-red-400">Validation Issues</p>
      </div>
      <ul className="space-y-1">
        {errors.map((error, i) => (
          <li key={i} className="text-xs text-red-300 flex items-start">
            <XCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
}
