import type { Metadata } from 'next';
import { MediaLibraryBrowser } from '@/components/media/MediaLibraryBrowser';

export const metadata: Metadata = {
  title: 'Media Library | Synthex',
  description:
    'Browse every image, video and audio file you have uploaded or generated.',
};

/**
 * Media Library
 *
 * Reads the library that `/api/media/library` has always exposed. Before this
 * page, no screen in the product called that route, so uploaded files had
 * nowhere to be seen. Linked from the Campaign Studio hub so it is reachable by
 * browsing rather than only by typing the URL.
 */
export default function MediaLibraryPage() {
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Media Library
        </h1>
        <p className="text-sm text-muted-foreground">
          Every image, video and audio file you have uploaded or generated.
        </p>
      </header>

      <MediaLibraryBrowser />
    </div>
  );
}
