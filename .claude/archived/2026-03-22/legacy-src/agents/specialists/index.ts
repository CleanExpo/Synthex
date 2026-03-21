/**
 * Specialist Sub-Agents Integration Layer
 * Connects Marketing Orchestrator with specialized sub-agent coordinators
 */

export { PlatformSpecialistCoordinator, platformSpecialistCoordinator } from './platform-specialist-coordinator';
export { SocialSchedulerCoordinator, socialSchedulerCoordinator } from './social-scheduler-coordinator';
export { TrendPredictorCoordinator, trendPredictorCoordinator } from './trend-predictor-coordinator';

export * from './platform-specialist-coordinator';
export * from './social-scheduler-coordinator';
export * from './trend-predictor-coordinator';