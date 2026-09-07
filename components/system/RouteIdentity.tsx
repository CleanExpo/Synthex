/**
 * ROUTE IDENTITY - the positive signal the required production smoke gate reads.
 *
 * WHY THIS EXISTS. The post-deploy gate must answer "is the advertised page
 * actually rendering". Until now its only positive identity signal was the
 * document <title>, and a title is METADATA: it is resolved from the route
 * segment rather than produced by the page's own render, so an error boundary or
 * a maintenance response can replace the whole body and keep it. An independent
 * review demonstrated the consequence directly - a document titled
 * "Login | Synthex | SYNTHEX" whose body read "Service unavailable" was
 * certified by the gate as a healthy /login. This repo supplies the shape that
 * produces it: `app/(auth)/error.tsx` replaces the page subtree, while the title
 * comes from `app/(auth)/login/layout.tsx` metadata, which sits above it. (That
 * the boundary preserves the title is read from the file layout, not observed in
 * a running app - the review's synthetic document is the measured part.)
 *
 * Every previous round of this gate closed the hole by ENUMERATING bad document
 * shapes - soft-404s, commented decoy titles, hidden titles, two titles,
 * route-word titles. Enumeration cannot terminate: each round closes the shapes
 * the reviewer found and the next adversary finds one nobody listed. This
 * component inverts the test. Rather than prove that no wrong document can pass,
 * it requires one signal that only the right page can emit.
 *
 * WHY IT MUST BE RENDERED BY page.tsx, NOT BY A LAYOUT AND NOT VIA `metadata`.
 * An error boundary replaces the subtree from the boundary downwards. A marker
 * in the page component is therefore destroyed by any boundary at or above it -
 * exactly the set of failures the gate exists to catch. A marker in a layout, or
 * in a `metadata` export, survives a boundary nested below it and would inherit
 * the very weakness that makes the title insufficient.
 *
 * WHY A BODY ELEMENT AND NOT <meta>. React hoists some head elements, and a
 * release gate must not depend on hoisting behaviour nobody has measured here. A
 * hidden span is rendered where it is written, inside the page's own subtree.
 *
 * WHY A SERVER COMPONENT. `process.env.VERCEL_GIT_COMMIT_SHA` is only readable
 * on the server; in a client bundle it is inlined away. Any page using this must
 * therefore be a server component - see `app/(auth)/login/page.tsx`, which is a
 * thin server shell over a client island for precisely this reason.
 *
 * The build id is the SAME expression `/api/health` serves as `buildId`
 * (app/api/health/route.ts), so the page and the health probe cannot disagree
 * about which release is being served.
 */
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';

export function RouteIdentity({ route }: { route: string }) {
  return (
    <span hidden data-synthex-route={route} data-synthex-build={BUILD_ID} />
  );
}
