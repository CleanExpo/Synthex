/**
 * FeaturedBadge — components/clients/FeaturedBadge.tsx
 *
 * "Featured in Synthex" trust badge shown on a client's public Authority Hub
 * page (app/clients/[slug]/page.tsx) once their case-study video is published
 * (featured_programme_status === 'published'). Renders nothing otherwise.
 *
 * Server-safe (no client hooks) so it can render inside the ISR page.
 *
 * @task SYN-508
 */
import { shouldShowFeaturedBadge } from '@/lib/videos/featuredProgramme';

export function FeaturedBadge({ status }: { status?: string | null }) {
  if (!shouldShowFeaturedBadge(status)) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300"
      title="This client is a featured Synthex success story"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
      </svg>
      Featured in Synthex
    </span>
  );
}

export default FeaturedBadge;
