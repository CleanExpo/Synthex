/**
 * Main i18n exports
 */

// Core configuration
export { i18nConfig, type Locale } from './config';

// Translations
export { translations, type NestedTranslationKeys, type TranslationLocale } from './translations';

// Hooks
export { useTranslation } from './hooks/useTranslation';

// Components
export { 
  LanguageSwitch, 
  LanguageSwitchNav, 
  LanguageSwitchFooter 
} from './components/LanguageSwitch';

// Re-export individual translations for direct use if needed
export { en, es } from './translations';

export default {
  config: i18nConfig,
  translations,
  useTranslation,
  LanguageSwitch,
};