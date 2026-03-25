/**
 * Marketing Layout
 *
 * Shared layout for the (marketing) route group — public, unauthenticated pages
 * such as /waitlist. No session checks; wrapper is pass-through.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
