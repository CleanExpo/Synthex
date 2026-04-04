/**
 * SEO Schema Types
 * Type definitions for schema generator
 */

import type { ComponentType } from 'react';

export interface SchemaTypeOption {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

export interface SchemaField {
  name: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'number' | 'array';
  placeholder?: string;
  required?: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}
