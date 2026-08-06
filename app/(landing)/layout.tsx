import type { Metadata } from 'next';

/**
 * Landing Layout
 *
 * Shared layout for the (landing) route group — standalone brand landing pages
 * that are NOT Synthex surfaces. Today that is RestoreAssist
 * (/restoreassist/*). No session checks; the wrapper is pass-through.
 *
 * WHY THIS FILE EXISTS: app/layout.tsx sets Synthex identity metadata on every
 * route — `authors` (including a Unite-Group link), `creator: 'Synthex'`,
 * `publisher: 'Unite-Group'`, `applicationName: 'SYNTHEX'`, and a Synthex
 * openGraph block with the Synthex og-image. On a RestoreAssist page that put a
 * second brand into the document head, which brandprint forbids. Next.js merges
 * metadata field-by-field from the root down, so re-declaring those fields here
 * overrides them for every page in the group, and pages can still override
 * again (both RestoreAssist pages set their own title, description and
 * canonical).
 *
 * KNOWN RESIDUAL — the five Synthex JSON-LD blocks (org, software-app, website,
 * landing-video, howto) are rendered as raw <script> JSX inside the root
 * layout's <head>, not through the metadata API. A nested layout cannot remove
 * a parent's JSX, and a root layout is a server component with no access to the
 * pathname, so there is no way to suppress them from here. Fixing that means
 * either relocating JSON-LD emission out of the root layout into the Synthex
 * pages that should carry it, or making the root layout route-aware at the cost
 * of static generation site-wide. Both are larger changes than this one and are
 * left for an explicit decision.
 */

export const metadata: Metadata = {
  // Neutralises the root layout's '%s | SYNTHEX' template for this group, so a
  // page that sets a plain string title is not silently co-branded. Both
  // RestoreAssist pages already set `title.absolute`; this protects any new one
  // that forgets.
  title: {
    default: 'RestoreAssist',
    template: '%s',
  },
  authors: [{ name: 'RestoreAssist' }],
  creator: 'RestoreAssist',
  publisher: 'RestoreAssist Pty Ltd',
  applicationName: 'RestoreAssist',
  openGraph: {
    siteName: 'RestoreAssist',
    locale: 'en_AU',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
