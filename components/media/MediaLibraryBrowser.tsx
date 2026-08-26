'use client';

/**
 * MediaLibraryBrowser
 *
 * The screen the media library never had. Every asset the founder uploads or
 * generates already lands in `media_assets` with folders, tags and favourites,
 * but no UI read it, so files vanished after upload.
 *
 * Deliberately read-first: filter, search and open. Editing, foldering and
 * batch actions are separate slices, so this one ships without touching spend
 * or the publish path.
 */

import { useState } from 'react';
import {
  Image as ImageIcon,
  Video,
  Music,
  Star,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useMediaLibrary,
  type MediaKind,
  type MediaLibraryAsset,
} from '@/hooks/use-media-library';

// ============================================================================
// CONSTANTS
// ============================================================================

const KIND_FILTERS: Array<{ label: string; value: MediaKind | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Video', value: 'video' },
  { label: 'Audio', value: 'audio' },
];

const PAGE_SIZE = 48;

// ============================================================================
// HELPERS
// ============================================================================

function KindIcon({
  kind,
  className,
}: {
  kind: MediaKind;
  className?: string;
}) {
  if (kind === 'video') return <Video className={className} />;
  if (kind === 'audio') return <Music className={className} />;
  return <ImageIcon className={className} />;
}

/** Australian-format date, so it matches the rest of the estate. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Where the thumbnail comes from. Images stored as base64 are served through a
 * dedicated route rather than inlined, because the response cap makes inlining
 * large payloads unreliable.
 */
function thumbnailSrc(asset: MediaLibraryAsset): string | null {
  if (asset.url) return asset.url;
  if (asset.base64Data) return `/api/media/assets/${asset.id}/image`;
  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MediaLibraryBrowser() {
  const [kind, setKind] = useState<MediaKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const { assets, total, isLoading, error, mutate } = useMediaLibrary({
    type: kind === 'all' ? undefined : kind,
    search: search.trim() || undefined,
    favouritesOnly: favouritesOnly || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    limit: PAGE_SIZE,
  });

  const isFiltered = kind !== 'all' || search.trim() !== '' || favouritesOnly;

  return (
    <div className="space-y-6">
      {/* -- Controls ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {KIND_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setKind(f.value)}
              aria-pressed={kind === f.value}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                kind === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your media"
            aria-label="Search your media"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Button
          type="button"
          variant={favouritesOnly ? 'default' : 'outline'}
          size="sm"
          aria-pressed={favouritesOnly}
          onClick={() => setFavouritesOnly(v => !v)}
        >
          <Star className="mr-1.5 h-4 w-4" />
          Favourites
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          aria-label="Refresh the library"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* -- Count --------------------------------------------------------- */}
      {!isLoading && !error && (
        <p className="text-sm text-muted-foreground" data-testid="media-count">
          {total === 0
            ? 'No media yet'
            : `${total} ${total === 1 ? 'file' : 'files'}`}
          {isFiltered && total > 0 ? ' matching your filters' : ''}
        </p>
      )}

      {/* -- States -------------------------------------------------------- */}
      {isLoading && assets.length === 0 && (
        <div
          className="flex items-center gap-2 py-16 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your media
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Your media could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => mutate()}
          >
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !error && assets.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-foreground">
            {isFiltered
              ? 'Nothing matches those filters.'
              : 'Nothing here yet.'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFiltered
              ? 'Clear a filter to see the rest of your media.'
              : 'Images, video and audio you upload or generate will appear here.'}
          </p>
        </div>
      )}

      {/* -- Grid ---------------------------------------------------------- */}
      {assets.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map(asset => {
            const src = thumbnailSrc(asset);
            return (
              <li
                key={asset.id}
                className="group overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="relative flex aspect-square items-center justify-center bg-muted">
                  {asset.type === 'image' && src ? (
                    // A plain img, not next/image: these are user media on
                    // arbitrary hosts, so the optimiser would need every host
                    // added to remotePatterns before any of them would render.
                    <img
                      src={src}
                      alt={asset.prompt || 'Library image'}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <KindIcon
                      kind={asset.type}
                      className="h-8 w-8 text-muted-foreground"
                    />
                  )}

                  {asset.isFavorite && (
                    <Star
                      aria-label="Favourite"
                      className="absolute right-2 top-2 h-4 w-4 text-primary"
                    />
                  )}
                </div>

                <div className="space-y-1 p-3">
                  <p className="truncate text-sm text-foreground">
                    {asset.prompt || `${asset.type} file`}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <KindIcon kind={asset.type} className="h-3 w-3" />
                    <span className="capitalize">{asset.type}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatDate(asset.createdAt)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
