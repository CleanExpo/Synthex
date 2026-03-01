/**
 * Auth Layout
 *
 * Shared layout for the (auth) route group (/login, /signup).
 * Individual pages export their own metadata so neither title "wins" at the layout level.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
