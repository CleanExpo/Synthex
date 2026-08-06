/**
 * Shared Synthex site constants.
 *
 * These are consumed by two places that must not drift apart: the root layout's
 * Next.js metadata (openGraph/twitter) and the Schema.org JSON-LD in
 * components/seo/SynthexStructuredData.tsx. The video URL in particular appears
 * in both an openGraph video tag and a VideoObject contentUrl — if those two
 * disagree, the structured data is lying about the page.
 */

export const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

export const LANDING_VIDEO_URL = `${BASE_URL}/videos/synthex-command-center-demo.mp4`;

export const LANDING_VIDEO_POSTER_URL = `${BASE_URL}/videos/synthex-command-center-demo-poster.jpg`;

export const SITE_DESCRIPTION =
  'Synthex is an evidence-backed marketing command center for research, campaign planning, Gen Media production and approval-gated execution.';
