import { redirect } from 'next/navigation';

// Canonical login route is /(auth)/login → /login
// This legacy route redirects to avoid duplicate pages and stale bookmarks.
export default function LegacyLoginRedirect() {
  redirect('/login');
}
