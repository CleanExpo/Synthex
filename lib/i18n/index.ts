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

// Default export
import { i18nConfig } from './config';
import { translations } from './translations';
import { useTranslation } from './hooks/useTranslation';
import { LanguageSwitch } from './components/LanguageSwitch';

const i18nConfig = {
// Export configuration
export default i18nConfig;
  config: i18nConfig,
  translations,
  useTranslation,
  LanguageSwitch,
};