/**
 * SYNTHEX Internationalization (i18n) System
 * Multi-language support with dynamic loading and locale detection
 */

class I18n {
    constructor() {
        this.defaultLocale = 'en';
        this.currentLocale = this.detectLocale();
        this.translations = new Map();
        this.loadedLocales = new Set();
        this.fallbackLocale = 'en';
        this.rtlLocales = ['ar', 'he', 'fa', 'ur'];
        this.dateTimeFormats = new Map();
        this.numberFormats = new Map();
        this.pluralRules = new Map();
        
        this.init();
    }

    /**
     * Initialize i18n system
     */
    async init() {
        // Load default locale
        await this.loadLocale(this.defaultLocale);
        
        // Load user's locale if different
        if (this.currentLocale !== this.defaultLocale) {
            await this.loadLocale(this.currentLocale);
        }
        
        // Apply locale settings
        this.applyLocale();
        
        // Set up locale change listeners
        this.setupListeners();
    }

    /**
     * Detect user's preferred locale
     */
    detectLocale() {
        // Check localStorage
        const savedLocale = localStorage.getItem('synthex_locale');
        if (savedLocale && this.isValidLocale(savedLocale)) {
            return savedLocale;
        }
        
        // Check navigator language
        const browserLang = navigator.language || navigator.userLanguage;
        const locale = browserLang.split('-')[0].toLowerCase();
        
        // Check if locale is supported
        if (this.isValidLocale(locale)) {
            return locale;
        }
        
        // Fallback to default
        return this.defaultLocale;
    }

    /**
     * Check if locale is valid/supported
     */
    isValidLocale(locale) {
        const supportedLocales = [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 
            'ja', 'ko', 'ar', 'hi', 'tr', 'nl', 'pl', 'sv'
        ];
        return supportedLocales.includes(locale);
    }

    /**
     * Load locale translations
     */
    async loadLocale(locale) {
        if (this.loadedLocales.has(locale)) {
            return;
        }
        
        try {
            const response = await fetch(`/locales/${locale}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load locale: ${locale}`);
            }
            
            const translations = await response.json();
            this.translations.set(locale, translations);
            this.loadedLocales.add(locale);
            
            // Load date/time formats
            this.loadDateTimeFormats(locale);
            
            // Load number formats
            this.loadNumberFormats(locale);
            
            // Load plural rules
            this.loadPluralRules(locale);
            
        } catch (error) {
            console.error(`Failed to load locale ${locale}:`, error);
            
            // Fall back to default locale
            if (locale !== this.defaultLocale) {
                await this.loadLocale(this.defaultLocale);
            }
        }
    }

    /**
     * Load date/time formats for locale
     */
    loadDateTimeFormats(locale) {
        const formats = {
            en: {
                short: 'MM/DD/YYYY',
                medium: 'MMM D, YYYY',
                long: 'MMMM D, YYYY',
                time: 'h:mm A',
                datetime: 'MMM D, YYYY h:mm A'
            },
            es: {
                short: 'DD/MM/YYYY',
                medium: 'D MMM YYYY',
                long: 'D [de] MMMM [de] YYYY',
                time: 'H:mm',
                datetime: 'D MMM YYYY H:mm'
            },
            fr: {
                short: 'DD/MM/YYYY',
                medium: 'D MMM YYYY',
                long: 'D MMMM YYYY',
                time: 'HH:mm',
                datetime: 'D MMM YYYY HH:mm'
            },
            de: {
                short: 'DD.MM.YYYY',
                medium: 'D. MMM YYYY',
                long: 'D. MMMM YYYY',
                time: 'HH:mm',
                datetime: 'D. MMM YYYY HH:mm'
            },
            zh: {
                short: 'YYYY/MM/DD',
                medium: 'YYYY年M月D日',
                long: 'YYYY年M月D日',
                time: 'HH:mm',
                datetime: 'YYYY年M月D日 HH:mm'
            },
            ja: {
                short: 'YYYY/MM/DD',
                medium: 'YYYY年M月D日',
                long: 'YYYY年M月D日',
                time: 'HH:mm',
                datetime: 'YYYY年M月D日 HH:mm'
            },
            ar: {
                short: 'DD/MM/YYYY',
                medium: 'D MMM YYYY',
                long: 'D MMMM YYYY',
                time: 'HH:mm',
                datetime: 'D MMM YYYY HH:mm'
            }
        };
        
        this.dateTimeFormats.set(locale, formats[locale] || formats.en);
    }

    /**
     * Load number formats for locale
     */
    loadNumberFormats(locale) {
        const formats = {
            en: { decimal: '.', thousands: ',', currency: '$' },
            es: { decimal: ',', thousands: '.', currency: '€' },
            fr: { decimal: ',', thousands: ' ', currency: '€' },
            de: { decimal: ',', thousands: '.', currency: '€' },
            zh: { decimal: '.', thousands: ',', currency: '¥' },
            ja: { decimal: '.', thousands: ',', currency: '¥' },
            ar: { decimal: '٫', thousands: '٬', currency: 'ر.س' }
        };
        
        this.numberFormats.set(locale, formats[locale] || formats.en);
    }

    /**
     * Load plural rules for locale
     */
    loadPluralRules(locale) {
        const rules = {
            en: (n) => n === 1 ? 'one' : 'other',
            es: (n) => n === 1 ? 'one' : 'other',
            fr: (n) => n === 0 || n === 1 ? 'one' : 'other',
            de: (n) => n === 1 ? 'one' : 'other',
            ru: (n) => {
                if (n % 10 === 1 && n % 100 !== 11) return 'one';
                if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'few';
                return 'many';
            },
            pl: (n) => {
                if (n === 1) return 'one';
                if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'few';
                return 'many';
            },
            ar: (n) => {
                if (n === 0) return 'zero';
                if (n === 1) return 'one';
                if (n === 2) return 'two';
                if (n % 100 >= 3 && n % 100 <= 10) return 'few';
                if (n % 100 >= 11 && n % 100 <= 99) return 'many';
                return 'other';
            },
            zh: () => 'other',
            ja: () => 'other',
            ko: () => 'other'
        };
        
        this.pluralRules.set(locale, rules[locale] || rules.en);
    }

    /**
     * Get translation for key
     */
    t(key, params = {}, options = {}) {
        const locale = options.locale || this.currentLocale;
        const translations = this.translations.get(locale) || this.translations.get(this.fallbackLocale);
        
        if (!translations) {
            console.warn(`No translations found for locale: ${locale}`);
            return key;
        }
        
        // Navigate nested keys
        let translation = translations;
        const keys = key.split('.');
        
        for (const k of keys) {
            translation = translation[k];
            if (!translation) {
                // Try fallback locale
                const fallback = this.translations.get(this.fallbackLocale);
                translation = this.getNestedTranslation(fallback, key);
                break;
            }
        }
        
        if (!translation) {
            console.warn(`Translation not found for key: ${key}`);
            return key;
        }
        
        // Handle pluralization
        if (typeof translation === 'object' && params.count !== undefined) {
            const pluralRule = this.pluralRules.get(locale);
            const form = pluralRule ? pluralRule(params.count) : 'other';
            translation = translation[form] || translation.other || translation.one;
        }
        
        // Replace parameters
        if (typeof translation === 'string') {
            translation = this.interpolate(translation, params);
        }
        
        return translation;
    }

    /**
     * Get nested translation
     */
    getNestedTranslation(obj, key) {
        const keys = key.split('.');
        let result = obj;
        
        for (const k of keys) {
            result = result?.[k];
            if (!result) break;
        }
        
        return result;
    }

    /**
     * Interpolate parameters in translation
     */
    interpolate(str, params) {
        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Format date according to locale
     */
    formatDate(date, format = 'medium') {
        const formatter = new Intl.DateTimeFormat(this.currentLocale, {
            dateStyle: format
        });
        
        return formatter.format(date);
    }

    /**
     * Format time according to locale
     */
    formatTime(date, format = 'short') {
        const formatter = new Intl.DateTimeFormat(this.currentLocale, {
            timeStyle: format
        });
        
        return formatter.format(date);
    }

    /**
     * Format number according to locale
     */
    formatNumber(number, options = {}) {
        const formatter = new Intl.NumberFormat(this.currentLocale, {
            style: options.style || 'decimal',
            currency: options.currency || 'USD',
            minimumFractionDigits: options.minimumFractionDigits || 0,
            maximumFractionDigits: options.maximumFractionDigits || 2
        });
        
        return formatter.format(number);
    }

    /**
     * Format currency according to locale
     */
    formatCurrency(amount, currency = 'USD') {
        return this.formatNumber(amount, {
            style: 'currency',
            currency: currency
        });
    }

    /**
     * Format percentage according to locale
     */
    formatPercent(value, decimals = 0) {
        return this.formatNumber(value, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Format relative time
     */
    formatRelativeTime(date, baseDate = new Date()) {
        const formatter = new Intl.RelativeTimeFormat(this.currentLocale, {
            numeric: 'auto'
        });
        
        const diff = date - baseDate;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        
        if (Math.abs(seconds) < 60) {
            return formatter.format(seconds, 'second');
        } else if (Math.abs(minutes) < 60) {
            return formatter.format(minutes, 'minute');
        } else if (Math.abs(hours) < 24) {
            return formatter.format(hours, 'hour');
        } else if (Math.abs(days) < 7) {
            return formatter.format(days, 'day');
        } else if (Math.abs(weeks) < 4) {
            return formatter.format(weeks, 'week');
        } else if (Math.abs(months) < 12) {
            return formatter.format(months, 'month');
        } else {
            return formatter.format(years, 'year');
        }
    }

    /**
     * Change current locale
     */
    async changeLocale(locale) {
        if (!this.isValidLocale(locale)) {
            console.error(`Invalid locale: ${locale}`);
            return;
        }
        
        // Load locale if not already loaded
        await this.loadLocale(locale);
        
        // Update current locale
        this.currentLocale = locale;
        
        // Save to localStorage
        localStorage.setItem('synthex_locale', locale);
        
        // Apply locale settings
        this.applyLocale();
        
        // Trigger locale change event
        this.triggerLocaleChange();
    }

    /**
     * Apply locale settings to DOM
     */
    applyLocale() {
        // Set document language
        document.documentElement.lang = this.currentLocale;
        
        // Set text direction
        if (this.rtlLocales.includes(this.currentLocale)) {
            document.documentElement.dir = 'rtl';
        } else {
            document.documentElement.dir = 'ltr';
        }
        
        // Update all translated elements
        this.updateTranslations();
    }

    /**
     * Update all translations in DOM
     */
    updateTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.dataset.i18n;
            const params = element.dataset.i18nParams ? 
                JSON.parse(element.dataset.i18nParams) : {};
            
            element.textContent = this.t(key, params);
        });
        
        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.dataset.i18nPlaceholder;
            element.placeholder = this.t(key);
        });
        
        // Update elements with data-i18n-title attribute
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.dataset.i18nTitle;
            element.title = this.t(key);
        });
        
        // Update elements with data-i18n-aria-label attribute
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            const key = element.dataset.i18nAriaLabel;
            element.setAttribute('aria-label', this.t(key));
        });
    }

    /**
     * Set up locale change listeners
     */
    setupListeners() {
        // Listen for language change events
        window.addEventListener('languagechange', () => {
            this.detectLocale();
            this.applyLocale();
        });
        
        // Listen for locale selector changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-locale-selector]')) {
                this.changeLocale(e.target.value);
            }
        });
    }

    /**
     * Trigger locale change event
     */
    triggerLocaleChange() {
        const event = new CustomEvent('localechange', {
            detail: {
                locale: this.currentLocale,
                direction: this.rtlLocales.includes(this.currentLocale) ? 'rtl' : 'ltr'
            }
        });
        
        window.dispatchEvent(event);
    }

    /**
     * Get available locales
     */
    getAvailableLocales() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'es', name: 'Spanish', nativeName: 'Español' },
            { code: 'fr', name: 'French', nativeName: 'Français' },
            { code: 'de', name: 'German', nativeName: 'Deutsch' },
            { code: 'it', name: 'Italian', nativeName: 'Italiano' },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
            { code: 'ru', name: 'Russian', nativeName: 'Русский' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' },
            { code: 'ko', name: 'Korean', nativeName: '한국어' },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
            { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
            { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
            { code: 'pl', name: 'Polish', nativeName: 'Polski' },
            { code: 'sv', name: 'Swedish', nativeName: 'Svenska' }
        ];
    }

    /**
     * Create locale selector
     */
    createLocaleSelector(container) {
        const selector = document.createElement('select');
        selector.dataset.localeSelector = 'true';
        selector.className = 'locale-selector';
        
        this.getAvailableLocales().forEach(locale => {
            const option = document.createElement('option');
            option.value = locale.code;
            option.textContent = locale.nativeName;
            
            if (locale.code === this.currentLocale) {
                option.selected = true;
            }
            
            selector.appendChild(option);
        });
        
        if (typeof container === 'string') {
            document.querySelector(container)?.appendChild(selector);
        } else {
            container?.appendChild(selector);
        }
        
        return selector;
    }
}

// Initialize i18n system
const i18n = new I18n();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = i18n;
}

// Make available globally
window.i18n = i18n;

// Helper function for translations
window.__ = (key, params, options) => i18n.t(key, params, options);