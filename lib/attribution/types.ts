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
