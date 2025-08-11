/**
 * Language switcher component
 */

'use client';

import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { i18nConfig, type Locale } from '../config';

interface LanguageSwitchProps {
  variant?: 'button' | 'select' | 'minimal';
  showFlag?: boolean;
  className?: string;
}

// Flag emojis for countries (simple mapping)
const flagEmojis: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

export function LanguageSwitch({ 
  variant = 'button', 
  showFlag = true, 
  className = '' 
}: LanguageSwitchProps) {
  const { 
    locale, 
    changeLocale, 
    isLoading, 
    getLocaleName, 
    availableLocales,
    t 
  } = useTranslation();

  const handleLocaleChange = async (newLocale: Locale) => {
    await changeLocale(newLocale);
  };

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        {availableLocales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            disabled={isLoading}
            className={`
              px-2 py-1 text-sm rounded transition-colors
              ${locale === loc 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {showFlag && flagEmojis[loc]} {loc.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'select') {
    return (
      <select
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
        disabled={isLoading}
        className={`
          px-3 py-2 border rounded-md bg-background text-foreground
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
      >
        {availableLocales.map((loc) => (
          <option key={loc} value={loc}>
            {showFlag && `${flagEmojis[loc]} `}{getLocaleName(loc)}
          </option>
        ))}
      </select>
    );
  }

  // Default dropdown variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isLoading}
          className={className}
        >
          <Globe className="h-4 w-4 mr-2" />
          {showFlag && flagEmojis[locale]} {getLocaleName()}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {availableLocales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            disabled={isLoading}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center">
              {showFlag && (
                <span className="mr-2">{flagEmojis[loc]}</span>
              )}
              {getLocaleName(loc)}
            </span>
            {locale === loc && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Language switcher for navigation/header
export function LanguageSwitchNav({ className }: { className?: string }) {
  return (
    <LanguageSwitch 
      variant="button"
      showFlag={true}
      className={className}
    />
  );
}

// Minimal language switcher for footer
export function LanguageSwitchFooter({ className }: { className?: string }) {
  return (
    <LanguageSwitch 
      variant="minimal"
      showFlag={false}
      className={className}
    />
  );
}

export default LanguageSwitch;