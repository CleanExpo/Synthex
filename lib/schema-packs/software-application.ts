/**
 * SoftwareApplication, per Google's software-app rich result documentation
 * (last updated 2026-09-08): required name, offers.price and either
 * aggregateRating or review; applicationCategory must be one of the listed
 * values. A rating is only ever passed in from real reviews; this builder
 * never supplies one.
 */
import type { JsonLd, PackOutput } from './types';

export const GOOGLE_APPLICATION_CATEGORIES = [
  'GameApplication',
  'SocialNetworkingApplication',
  'TravelApplication',
  'ShoppingApplication',
  'SportsApplication',
  'LifestyleApplication',
  'BusinessApplication',
  'DesignApplication',
  'DeveloperApplication',
  'DriverApplication',
  'EducationalApplication',
  'HealthApplication',
  'FinanceApplication',
  'SecurityApplication',
  'BrowserApplication',
  'CommunicationApplication',
  'DesktopEnhancementApplication',
  'EntertainmentApplication',
  'MultimediaApplication',
  'HomeApplication',
  'UtilitiesApplication',
  'ReferenceApplication',
] as const;

export type ApplicationCategory =
  (typeof GOOGLE_APPLICATION_CATEGORIES)[number];

export interface SoftwareApplicationFacts {
  name: string;
  url: string;
  description?: string;
  applicationCategory: ApplicationCategory;
  operatingSystem: string;
  offers?: { price: number; priceCurrency: string };
  /** Only from real, collected reviews. */
  rating?: { ratingValue: number; ratingCount: number };
}

export function buildSoftwareApplication(
  facts: SoftwareApplicationFacts,
  publisherId?: string
): PackOutput {
  if (
    !(GOOGLE_APPLICATION_CATEGORIES as readonly string[]).includes(
      facts.applicationCategory
    )
  ) {
    throw new Error(
      `applicationCategory ${facts.applicationCategory} is not one Google accepts`
    );
  }
  if (facts.rating && facts.rating.ratingCount < 1) {
    throw new Error('A rating needs at least one real rating behind it');
  }

  const jsonLd: JsonLd = {
    '@type': 'SoftwareApplication',
    name: facts.name,
    url: facts.url,
    applicationCategory: facts.applicationCategory,
    operatingSystem: facts.operatingSystem,
  };
  if (facts.description) jsonLd.description = facts.description;
  if (publisherId) jsonLd.publisher = { '@id': publisherId };
  if (facts.offers) {
    jsonLd.offers = {
      '@type': 'Offer',
      price: facts.offers.price,
      priceCurrency: facts.offers.priceCurrency,
    };
  }
  if (facts.rating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: facts.rating.ratingValue,
      ratingCount: facts.rating.ratingCount,
    };
  }

  const missing: string[] = [];
  if (!facts.offers) missing.push('offers.price');
  if (!facts.rating) missing.push('aggregateRating_or_review');

  return {
    jsonLd,
    googleRichResult: { eligible: missing.length === 0, missing },
  };
}
