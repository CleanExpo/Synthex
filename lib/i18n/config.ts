/**
 * Internationalization configuration
 * Supports multiple languages with automatic detection
 */

export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh'] as const,
  localeNames: {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    ja: '日本語',
    zh: '中文'
  },
  cookieName: 'synthex-locale',
  queryParam: 'lang',
  dateFormats: {
    en: 'MM/dd/yyyy',
    es: 'dd/MM/yyyy',
    fr: 'dd/MM/yyyy',
    de: 'dd.MM.yyyy',
    pt: 'dd/MM/yyyy',
    ja: 'yyyy/MM/dd',
    zh: 'yyyy/MM/dd'
  },
  numberFormats: {
    en: { decimal: '.', thousand: ',' },
    es: { decimal: ',', thousand: '.' },
    fr: { decimal: ',', thousand: ' ' },
    de: { decimal: ',', thousand: '.' },
    pt: { decimal: ',', thousand: '.' },
    ja: { decimal: '.', thousand: ',' },
    zh: { decimal: '.', thousand: ',' }
  },
  currencies: {
    en: 'USD',
    es: 'EUR',
    fr: 'EUR',
    de: 'EUR',
    pt: 'EUR',
    ja: 'JPY',
    zh: 'CNY'
  },
  rtlLanguages: [] as string[], // Add 'ar', 'he' etc. if supporting RTL
};

export type Locale = typeof i18nConfig.locales[number];
export type LocaleNames = typeof i18nConfig.localeNames;