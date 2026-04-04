import { Request, Response, NextFunction } from 'express';

interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
}

const config: I18nConfig = {
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr', 'de', 'pt']
};

export const i18nMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get locale from header, query, or default
  const locale = req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
    req.query.locale as string ||
    config.defaultLocale;

  // Validate locale
  const validLocale = config.supportedLocales.includes(locale) ? locale : config.defaultLocale;

  // Attach to request
  (req as any).locale = validLocale;
  (req as any).t = (key: string, fallback?: string) => {
    // Simple translation function - in production, this would load from JSON files
    const translations: Record<string, Record<string, string>> = {
      en: {
        'welcome': 'Welcome',
        'error.generic': 'An error occurred',
        'error.not_found': 'Not found',
        'error.unauthorized': 'Unauthorized'
      },
      es: {
        'welcome': 'Bienvenido',
        'error.generic': 'Ha ocurrido un error',
        'error.not_found': 'No encontrado',
        'error.unauthorized': 'No autorizado'
      }
    };

    return translations[validLocale]?.[key] || fallback || key;
  };

  next();
};

export default i18nMiddleware;
