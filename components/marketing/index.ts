/**
 * Marketing Components
 * Reusable marketing page components with glassmorphism design
 *
 * @task UNI-413 - Implement Marketing Page Components
 *
 * @example
 * ```tsx
 * import {
 *   HeroSection,
 *   FeatureGrid,
 *   PricingCard,
 *   TestimonialGrid,
 *   CTASection,
 *   StatsBanner,
 *   LogoCloud,
 * } from '@/components/marketing';
 * ```
 */

// Pricing
export { PricingCard, type PricingTier, type PricingFeature, type PricingCardProps } from './PricingCard';

// Testimonials
export {
  TestimonialCard,
  TestimonialGrid,
  type Testimonial,
  type TestimonialCardProps,
  type TestimonialGridProps,
} from './TestimonialCard';

// Features
export {
  FeatureCard,
  FeatureGrid,
  FeatureSection,
  type Feature,
  type FeatureCardProps,
  type FeatureGridProps,
  type FeatureSectionProps,
} from './FeatureCard';

// Stats
export {
  StatCard,
  StatsGrid,
  StatsBanner,
  type Stat,
  type StatCardProps,
  type StatsGridProps,
  type StatsBannerProps,
} from './StatCard';

// CTA
export {
  CTASection,
  MiniCTA,
  type CTASectionProps,
  type MiniCTAProps,
} from './CTASection';

// Hero
export {
  HeroSection,
  type HeroSectionProps,
} from './HeroSection';

// Social Proof
export {
  LogoCloud,
  TrustBadges,
  RatingDisplay,
  Accolades,
  UserCount,
  SecurityBadges,
  type Logo,
  type LogoCloudProps,
  type TrustBadge,
  type TrustBadgesProps,
  type RatingDisplayProps,
  type Accolade,
  type AccoladesProps,
  type UserCountProps,
  type SecurityBadge,
  type SecurityBadgesProps,
} from './SocialProof';
