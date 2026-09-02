/**
 * /login - a server shell over a client island.
 *
 * The page body is client-rendered and sits behind a Suspense boundary, so the
 * server HTML for this route carries only the skeleton. That is why the page
 * itself must be a SERVER component: `RouteIdentity` reads
 * `process.env.VERCEL_GIT_COMMIT_SHA`, which is inlined away in a client bundle,
 * and the marker has to appear in the server-rendered HTML that the post-deploy
 * smoke gate reads.
 *
 * The marker is deliberately OUTSIDE the Suspense boundary. Inside it, the
 * marker would be replaced by the skeleton fallback in exactly the responses the
 * gate must be able to identify.
 */
import LoginClient from './login-client';
import { RouteIdentity } from '@/components/system/RouteIdentity';

export default function LoginPage() {
  return (
    <>
      <RouteIdentity route="/login" />
      <LoginClient />
    </>
  );
}
