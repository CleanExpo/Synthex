'use client';

/**
 * ReferenceLibraryBrowser
 *
 * Shows the owned reference photos that grounded image generation depends on.
 *
 * Real Images Only (`.claude/rules/real-images-only.md`) blocks a generation when
 * no owned reference exists for the subject, and tells the founder to add real
 * photos. The link that said so pointed at `/reference-library`, which did not
 * exist anywhere — so the one remedy the rule prescribes was a dead end. This is
 * that page.
 *
 * Read-only. Ingesting new references is a separate, audited path
 * (`POST /api/admin/private-refs`), deliberately not exposed here.
 */

import { useMemo, useState } from 'react';
import { Search, Image as ImageIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ReferenceSetSummary } from '@/lib/services/ai/reference-library';

export interface ReferenceLibraryBrowserProps {
  sets: ReferenceSetSummary[];
}

export function ReferenceLibraryBrowser({
  sets,
}: ReferenceLibraryBrowserProps) {
  const [industry, setIndustry] = useState<string>('all');
  const [search, setSearch] = useState('');

  const totalPhotos = useMemo(
    () =>
      sets.reduce(
        (n, set) => n + set.subjects.reduce((m, s) => m + s.count, 0),
        0
      ),
    [sets]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets
      .filter(set => industry === 'all' || set.industry === industry)
      .map(set => ({
        ...set,
        subjects: q
          ? set.subjects.filter(
              s =>
                s.label.toLowerCase().includes(q) ||
                s.key.toLowerCase().includes(q)
            )
          : set.subjects,
      }))
      .filter(set => set.subjects.length > 0);
  }, [sets, industry, search]);

  const shownSubjects = visible.reduce((n, set) => n + set.subjects.length, 0);

  return (
    <div className="space-y-6">
      {/* -- Controls ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setIndustry('all')}
            aria-pressed={industry === 'all'}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              industry === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {sets.map(set => (
            <button
              key={set.industry}
              type="button"
              onClick={() => setIndustry(set.industry)}
              aria-pressed={industry === set.industry}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                industry === set.industry
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {set.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subjects"
            aria-label="Search reference subjects"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <p
        className="text-sm text-muted-foreground"
        data-testid="reference-count"
      >
        {shownSubjects} of {sets.reduce((n, s) => n + s.subjects.length, 0)}{' '}
        subjects &middot; {totalPhotos} owned photos
      </p>

      {/* -- Empty --------------------------------------------------------- */}
      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-foreground">
            No subjects match that search.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A generation blocks when the subject has no owned reference. Adding
            real photos is the fix.
          </p>
        </div>
      )}

      {/* -- Sets ---------------------------------------------------------- */}
      {visible.map(set => (
        <section key={set.industry} className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {set.label}{' '}
            <span className="text-muted-foreground">
              ({set.subjects.length})
            </span>
          </h2>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {set.subjects.map(subject => (
              <li
                key={subject.key}
                className="overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="flex aspect-square items-center justify-center bg-muted">
                  {subject.previewImage ? (
                    // A plain img: these are static files under public/, and the
                    // grid only ever needs the first frame of each subject.
                    <img
                      src={subject.previewImage}
                      alt={subject.label}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-1 p-3">
                  <p className="truncate text-sm text-foreground">
                    {subject.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subject.count} {subject.count === 1 ? 'photo' : 'photos'}
                    {subject.vendor ? ` · ${subject.vendor}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
