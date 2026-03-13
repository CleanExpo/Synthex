/**
 * Dashboard Components
 * Barrel exports for dashboard page components
 */

// Types
export * from './types';

// Config and utilities
export * from './dashboard-config';

// Components
export { AnimatedCard } from './animated-card';
export { StatCard } from './stat-card';
export { DashboardHeader } from './dashboard-header';
export { QuickStats } from './quick-stats';

// Tab components
export {
  OverviewTab,
  AnalyticsTab,
  AIStudioTab,
  TeamTab,
  SchedulerTab,
} from './tabs';

// Error handling
export { DashboardError } from './error-fallback';

// Layout components
export { PageHeader } from './page-header';
export { DashboardEmptyState } from './empty-state';

// Onboarding
export { GetStartedChecklist } from './get-started-checklist';

// Feature discoverability
export { KeyboardHints } from './keyboard-hints';

// Sprint 3 widgets
export { GamificationWidget } from './GamificationWidget';
export { ContentSuggestionsWidget } from './ContentSuggestionsWidget';

// Phase 6 — Post-onboarding kickstart widget
export { FirstWeekWidget } from './FirstWeekWidget';
