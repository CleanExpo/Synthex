import { redirect } from 'next/navigation';

// Canonical signup route is /(auth)/signup → /signup
// This legacy route redirects to avoid duplicate pages and stale bookmarks.
export default function LegacyRegisterRedirect() {
  redirect('/signup');
}
