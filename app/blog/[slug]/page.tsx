import { redirect } from 'next/navigation';

/**
 * Blog post detail page — no published posts yet.
 * Redirects all slug requests to /blog until UNI-1643 ships.
 */
export default function BlogPostPage() {
  redirect('/blog');
}
