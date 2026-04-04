/**
 * Help Center Types
 * Type definitions for help center features
 */

import type { ComponentType } from 'react';

export interface HelpCategoryLink {
  title: string;
  href: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  articles: number;
  color: string;
  links: HelpCategoryLink[];
}

export interface FAQ {
  question: string;
  answer: string;
  category: string;
}
