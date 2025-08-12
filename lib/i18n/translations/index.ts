/**
 * Translation exports and index
 */

import { en } from './en';
import { es } from './es';

export const translations = {
  en,
  es,
  // Additional languages can be added here:
  // fr: () => import('./fr').then(m => m.fr),
  // de: () => import('./de').then(m => m.de),
  // pt: () => import('./pt').then(m => m.pt),
  // ja: () => import('./ja').then(m => m.ja),
  // zh: () => import('./zh').then(m => m.zh),
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationLocale = keyof typeof translations;

// Type for nested keys (e.g., 'auth.signIn', 'dashboard.metrics.totalCampaigns')
export type NestedTranslationKeys<T = typeof en, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? T[K] extends string
      ? K
      : K | `${K}.${NestedTranslationKeys<T[K]>}`
    : K
  : never;

export type TFunction = (key: NestedTranslationKeys, options?: {
  [key: string]: string | number;
}) => string;

export { en, es };
export default translations;