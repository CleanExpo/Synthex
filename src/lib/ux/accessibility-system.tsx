/**
 * SYNTHEX Accessibility System
 * WCAG 2.1 AA Compliant Components and Utilities
 * 
 * Design Philosophy: Inclusive design benefits everyone
 * Every interaction should be keyboard navigable, screen-reader friendly,
 * and work across all abilities and devices.
 */

import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

// Design tokens for accessibility
const accessibilityTokens = {
  // Minimum touch target size (WCAG 2.5.5)
  touchTarget: '44px',
  
  // Focus indicators (WCAG 2.4.7)
  focusRing: '2px solid var(--primary)',
  focusRingOffset: '2px',
  
  // Color contrast ratios (WCAG 1.4.3)
  contrastNormal: 4.5,
  contrastLarge: 3,
  contrastNonText: 3,
  
  // Animation preferences
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
  
  // Spacing for readability
  lineHeight: 1.5,
  paragraphSpacing: '1.5em',
  letterSpacing: '0.12em',
  
  // Responsive breakpoints
  mobile: '640px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px'
};

/**
 * Accessibility Context for app-wide preferences
 */
interface AccessibilityContextType {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  keyboardUser: boolean;
  screenReaderActive: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
  reducedMotion: false,
  highContrast: false,
  fontSize: 'normal',
  keyboardUser: false,
  screenReaderActive: false
});

export const useAccessibility = () => useContext(AccessibilityContext);

/**
 * Accessibility Provider Component
 * Detects and manages user preferences
 */
export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<AccessibilityContextType>({
    reducedMotion: false,
    highContrast: false,
    fontSize: 'normal',
    keyboardUser: false,
    screenReaderActive: false
  });

  useEffect(() => {
    // Detect reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPreferences(prev => ({ ...prev, reducedMotion: motionQuery.matches }));
    
    // Detect high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    setPreferences(prev => ({ ...prev, highContrast: contrastQuery.matches }));
    
    // Detect keyboard navigation
    const detectKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setPreferences(prev => ({ ...prev, keyboardUser: true }));
      }
    };
    
    const detectMouse = () => {
      setPreferences(prev => ({ ...prev, keyboardUser: false }));
    };
    
    window.addEventListener('keydown', detectKeyboard);
    window.addEventListener('mousedown', detectMouse);
    
    // Detect screen reader (experimental)
    const detectScreenReader = () => {
      // Various heuristics to detect screen readers
      const htmlElement = document.documentElement;
      const isScreenReader = 
        htmlElement.classList.contains('sr') ||
        /talkback|nvda|jaws|voiceover/i.test(navigator.userAgent);
      
      setPreferences(prev => ({ ...prev, screenReaderActive: isScreenReader }));
    };
    
    detectScreenReader();
    
    return () => {
      window.removeEventListener('keydown', detectKeyboard);
      window.removeEventListener('mousedown', detectMouse);
    };
  }, []);

  return (
    <AccessibilityContext.Provider value={preferences}>
      {children}
    </AccessibilityContext.Provider>
  );
};

/**
 * Skip Links Component
 * Allows keyboard users to skip repetitive content
 */
export const SkipLinks: React.FC = () => {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-0 left-0 z-50 bg-primary text-primary-foreground px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className="absolute top-0 left-20 z-50 bg-primary text-primary-foreground px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        Skip to navigation
      </a>
    </div>
  );
};

/**
 * Accessible Button Component
 * Ensures proper keyboard navigation and screen reader support
 */
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className,
  onClick,
  ...props
}) => {
  const { reducedMotion, keyboardUser } = useAccessibility();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Size classes with minimum touch targets
  const sizeClasses = {
    sm: 'min-h-[36px] px-3 py-1.5 text-sm',
    md: 'min-h-[44px] px-4 py-2 text-base',
    lg: 'min-h-[52px] px-6 py-3 text-lg'
  };

  // Variant classes with proper contrast
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };

  // Animation classes respecting user preferences
  const animationClasses = reducedMotion
    ? ''
    : 'transition-all duration-200 ease-out transform active:scale-95';

  // Focus classes for keyboard navigation
  const focusClasses = keyboardUser
    ? 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
    : 'focus:outline-none';

  return (
    <button
      ref={buttonRef}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        animationClasses,
        focusClasses,
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span
          className="mr-2"
          role="status"
          aria-label="Loading"
        >
          <svg
            className={cn(
              'animate-spin h-4 w-4',
              reducedMotion && 'animate-none'
            )}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
      )}
      {icon && <span className="mr-2" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};

/**
 * Live Region Component
 * Announces dynamic content changes to screen readers
 */
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  atomic?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  type = 'polite',
  atomic = true
}) => {
  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic={atomic}
      className="sr-only"
    >
      {message}
    </div>
  );
};

/**
 * Focus Trap Component
 * Keeps focus within a specific area (useful for modals)
 */
export const FocusTrap: React.FC<{ children: React.ReactNode; active: boolean }> = ({
  children,
  active
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
};

/**
 * Accessible Form Field Component
 * Proper labeling and error handling
 */
interface AccessibleFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactElement;
}

export const AccessibleField: React.FC<AccessibleFieldProps> = ({
  label,
  error,
  required,
  helpText,
  children
}) => {
  const fieldId = React.useId();
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;

  // Clone child element with proper ARIA attributes
  const field = React.cloneElement(children, {
    id: fieldId,
    'aria-required': required,
    'aria-invalid': !!error,
    'aria-describedby': [
      error && errorId,
      helpText && helpId
    ].filter(Boolean).join(' ') || undefined
  });

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      {field}
      {helpText && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Color Contrast Checker Utility
 * Ensures text meets WCAG contrast requirements
 */
export const checkColorContrast = (
  foreground: string,
  background: string,
  fontSize: number = 16
): {
  ratio: number;
  passes: boolean;
  level: 'AAA' | 'AA' | 'Fail';
} => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (rgb: { r: number; g: number; b: number }) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928
        ? val / 12.92
        : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) return { ratio: 0, passes: false, level: 'Fail' };

  const fgLuminance = getLuminance(fgRgb);
  const bgLuminance = getLuminance(bgRgb);

  const ratio = (Math.max(fgLuminance, bgLuminance) + 0.05) /
                 (Math.min(fgLuminance, bgLuminance) + 0.05);

  const isLargeText = fontSize >= 18;
  const passes = isLargeText ? ratio >= 3 : ratio >= 4.5;
  
  let level: 'AAA' | 'AA' | 'Fail' = 'Fail';
  if (ratio >= 7) level = 'AAA';
  else if (passes) level = 'AA';

  return { ratio, passes, level };
};

/**
 * Keyboard Navigation Hook
 * Simplifies keyboard interaction handling
 */
export const useKeyboardNavigation = (
  items: any[],
  onSelect: (item: any) => void
) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(items[focusedIndex]);
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(items.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, focusedIndex, onSelect]);

  return { focusedIndex, setFocusedIndex };
};