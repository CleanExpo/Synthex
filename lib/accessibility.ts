/**
 * Accessibility utilities for ARIA labels and screen reader support
 */

export const a11y = {
  // Navigation
  mainNav: 'Main navigation',
  sidebarNav: 'Sidebar navigation',
  userMenu: 'User account menu',
  mobileMenu: 'Mobile navigation menu',
  
  // Buttons
  button: (action: string) => `${action} button`,
  toggle: (item: string, state?: boolean) => 
    `Toggle ${item}${state !== undefined ? `, currently ${state ? 'on' : 'off'}` : ''}`,
  close: (item: string) => `Close ${item}`,
  
  // Forms
  input: (label: string, required?: boolean) => 
    `${label} input${required ? ', required' : ''}`,
  select: (label: string, count?: number) => 
    `Select ${label}${count ? `, ${count} options available` : ''}`,
  error: (message: string) => `Error: ${message}`,
  success: (message: string) => `Success: ${message}`,
  
  // Content
  loading: (item?: string) => `Loading${item ? ` ${item}` : ''}...`,
  chart: (title: string) => `${title} chart`,
  metric: (label: string, value: string) => `${label}: ${value}`,
  
  // Status
  status: (type: 'info' | 'warning' | 'error' | 'success', message: string) =>
    `${type} status: ${message}`,
  
  // Interactive
  sortable: (column: string, direction?: 'asc' | 'desc') =>
    `Sort by ${column}${direction ? `, currently sorted ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`,
  expandable: (item: string, expanded?: boolean) =>
    `${item}, ${expanded ? 'expanded' : 'collapsed'}, click to ${expanded ? 'collapse' : 'expand'}`,
};

// Skip link HTML for keyboard navigation
export const getSkipLinkHTML = () => {
  return `<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded-md z-50">Skip to main content</a>`;
};

// Announce changes to screen readers
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
};

// Focus management utilities
export const focusUtils = {
  /**
   * Trap focus within a container (useful for modals)
   */
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  },

  /**
   * Move focus to the first focusable element in a container
   */
  focusFirst: (container: HTMLElement) => {
    const focusable = container.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  },

  /**
   * Save and restore focus (useful when opening/closing modals)
   */
  saveFocus: () => document.activeElement as HTMLElement | null,
  restoreFocus: (element: HTMLElement | null) => element?.focus(),
};

// Keyboard navigation helpers
export const keyboardUtils = {
  /**
   * Check if Enter or Space was pressed (standard activation keys)
   */
  isActivationKey: (event: KeyboardEvent) =>
    event.key === 'Enter' || event.key === ' ',

  /**
   * Check if Escape was pressed
   */
  isEscapeKey: (event: KeyboardEvent) => event.key === 'Escape',

  /**
   * Arrow key navigation handler for lists/grids
   */
  handleArrowNavigation: (
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    options: { horizontal?: boolean; wrap?: boolean } = {}
  ): number => {
    const { horizontal = false, wrap = true } = options;
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';

    let newIndex = currentIndex;

    if (event.key === prevKey) {
      newIndex = currentIndex > 0
        ? currentIndex - 1
        : wrap ? items.length - 1 : currentIndex;
    } else if (event.key === nextKey) {
      newIndex = currentIndex < items.length - 1
        ? currentIndex + 1
        : wrap ? 0 : currentIndex;
    } else if (event.key === 'Home') {
      newIndex = 0;
    } else if (event.key === 'End') {
      newIndex = items.length - 1;
    }

    if (newIndex !== currentIndex) {
      event.preventDefault();
      items[newIndex]?.focus();
    }

    return newIndex;
  },
};

// Visibility check for reduced motion preference
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// High contrast mode check
export const prefersHighContrast = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};