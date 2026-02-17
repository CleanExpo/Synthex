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
