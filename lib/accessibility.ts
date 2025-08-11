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

// Skip link for keyboard navigation
export const SkipLink = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded-md z-50"
  >
    Skip to main content
  </a>
);

// Announce changes to screen readers
export const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
};