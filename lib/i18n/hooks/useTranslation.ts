/**
 * Translation hook for using i18n in React components
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { translations, type NestedTranslationKeys, type TranslationLocale } from '../translations';
import { i18nConfig, type Locale } from '../config';

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : path;
}

// Simple interpolation function
function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key]?.toString() || match;
  });
}

// Get locale from various sources (cookie, localStorage, browser, default)
function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return i18nConfig.defaultLocale as Locale;
  }

  // Check cookie
  const cookieLocale = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${i18nConfig.cookieName}=`))
    ?.split('=')[1];

  if (cookieLocale && (i18nConfig.locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // Check localStorage (with SSG protection)
  try {
    const storedLocale = localStorage.getItem(i18nConfig.cookieName);
    if (storedLocale && (i18nConfig.locales as readonly string[]).includes(storedLocale)) {
      return storedLocale as Locale;
    }
  } catch (error) {
    // localStorage not available (SSG), continue to browser check
  }

  // Check browser language
  const browserLocale = navigator.language.split('-')[0];
  if ((i18nConfig.locales as readonly string[]).includes(browserLocale)) {
    return browserLocale as Locale;
  }

  return i18nConfig.defaultLocale as Locale;
}

// Set locale in cookie and localStorage
function persistLocale(locale: Locale) {
  if (typeof window === 'undefined') return;

  // Set cookie (expires in 1 year)
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  document.cookie = `${i18nConfig.cookieName}=${locale}; expires=${expiry.toUTCString()}; path=/`;

  // Set localStorage
  try {
    localStorage.setItem(i18nConfig.cookieName, locale);
  } catch (error) {
    // localStorage not available, skip
  }
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [isLoading, setIsLoading] = useState(false);

  // Get current translations
  const currentTranslations = useMemo(() => {
    return translations[locale as TranslationLocale] || translations.en;
  }, [locale]);

  // Translation function
  const t = useCallback((
    key: NestedTranslationKeys,
    options?: Record<string, string | number>
  ): string => {
    const value = getNestedValue(currentTranslations, key);
    return interpolate(value, options);
  }, [currentTranslations]);

  // Change locale function
  const changeLocale = useCallback(async (newLocale: Locale) => {
    if (newLocale === locale) return;

    setIsLoading(true);
    
    try {
      // For dynamic imports (when we add more languages)
      // const translation = await translations[newLocale as TranslationLocale]?.();
      
      setLocaleState(newLocale);
      persistLocale(newLocale);
    } catch (error) {
      console.error('Failed to change locale:', error);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  // Format date according to locale
  const formatDate = useCallback((date: Date, options?: Intl.DateTimeFormatOptions) => {
    const format = i18nConfig.dateFormats[locale];
    return new Intl.DateTimeFormat(locale, {
      ...options,
      // Map our custom format to Intl options if needed
    }).format(date);
  }, [locale]);

  // Format number according to locale
  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, options).format(value);
  }, [locale]);

  // Format currency according to locale
  const formatCurrency = useCallback((value: number, currency?: string) => {
    const defaultCurrency = i18nConfig.currencies[locale];
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || defaultCurrency,
    }).format(value);
  }, [locale]);

  // Get text direction (RTL/LTR)
  const direction = useMemo(() => {
    return i18nConfig.rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  // Get locale display name
  const getLocaleName = useCallback((targetLocale: Locale = locale) => {
    return i18nConfig.localeNames[targetLocale];
  }, [locale]);

  // Effect to update document attributes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
    }
  }, [locale, direction]);

  return {
    // Current state
    locale,
    direction,
    isLoading,
    
    // Translation functions
    t,
    changeLocale,
    
    // Formatting functions
    formatDate,
    formatNumber,
    formatCurrency,
    
    // Utilities
    getLocaleName,
    availableLocales: i18nConfig.locales,
    localeNames: i18nConfig.localeNames,
  };
}

export default useTranslation;