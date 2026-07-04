/**
 * Attribution context types — SYN-623
 *
 * Defines the shape of the `attribution_context` JSONB field on `recommended_actions`.
 * Used by AI Advisor inference engine (write) and ROI Attribution Dashboard (read).
 */

/** Content types that can be attributed to revenue */
export type AttributableContentType =
  | 'social_post'
  | 'review_response'
  | 'blog_article'
  | 'google_post'
  | 'email_campaign';

/**
 * Attribution context stored per recommended action.
 *
 * Populated by the AI Advisor inference engine when the action involves
 * content publishing or review responses. Null fields indicate data not
 * available (e.g., no GA4 connected, no UTM params generated).
 */
export interface AttributionContext {
  /** ID of the content item this action relates to (post ID, review ID, etc.) */
  contentId?: string;

  /** Type of content being attributed */
  contentType?: AttributableContentType;

  /** Model-predicted probability of conversion (0.0 - 1.0) */
  predictedConversionProbability?: number;

  /** UTM parameters auto-generated for tracking this action's conversions */
  utmParams?: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content?: string;
    utm_term?: string;
  };

  /** How many days after the action to attribute conversions (default: 30) */
  attributionWindowDays?: number;

  /** Whether client has GA4 connected — drives brief template selection */
  ga4Connected?: boolean;

  /** Actual tracked revenue attributed to this action (backfilled after conversions) */
  trackedRevenue?: number;

  /** Number of tracked enquiries attributed to this action */
  trackedEnquiries?: number;
}

/**
 * The signal class a single provenance line is derived from. Drives the label
 * (and any icon) shown against the citation on the ROI Attribution report.
 */
export type AttributionSignal =
  | 'revenue'
  | 'enquiries'
  | 'content'
  | 'utm'
  | 'window'
  | 'ga4'
  | 'confidence';

/**
 * One provenance line — a citation — explaining WHY an attributed number is
 * what it is. Each line names a concrete signal already stored on the
 * recommended action's `attribution_context`, so an operator can trace an
 * attributed figure back to its source rather than trust it blindly. SYN-315.
 */
export interface AttributionCitation {
  /** Signal class this citation is drawn from. */
  signal: AttributionSignal;
  /** Short human label, e.g. "Tracking record". Australian English. */
  label: string;
  /** The concrete evidence, e.g. "utm_campaign=spring-sale · utm_source=google". */
  detail: string;
}
