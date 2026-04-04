/**
 * Blog post layout — metadata is generated in page.tsx via generateMetadata
 * so the post can access real DB data (title, excerpt, ogImage).
 *
 * @task UNI-1643
 */
export default function BlogPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
