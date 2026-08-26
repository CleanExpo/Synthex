import type { Metadata } from 'next';
import { listReferenceSets } from '@/lib/services/ai/reference-library';
import { ReferenceLibraryBrowser } from '@/components/reference-library/ReferenceLibraryBrowser';

export const metadata: Metadata = {
  title: 'Reference Library | Synthex',
  description:
    'The owned real photos that grounded image generation draws from.',
};

/**
 * Reference Library
 *
 * Real Images Only blocks a generation when no owned reference exists for the
 * subject, and the blocked state tells the founder to add real photos. That
 * guidance linked to `/reference-library`, which existed nowhere in the app, so
 * the remedy the rule prescribes had no destination. This page is that
 * destination.
 *
 * Reads the manifest through the existing service rather than parsing it again,
 * so this page and the resolver that grounds generation can never disagree about
 * what is in the library.
 */
export default function ReferenceLibraryPage() {
  const sets = listReferenceSets();

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Reference Library
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The owned real photos every generated image is grounded in. If a
          generation is blocked, the subject has no reference here yet, and
          adding real photos is the fix.
        </p>
      </header>

      <ReferenceLibraryBrowser sets={sets} />
    </div>
  );
}
