import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getClientBySlug, getAllActiveClientSlugs } from '@/lib/clients/getClientBySlug';
import { getClientVideos } from '@/lib/videos/getClientVideos';
import AuthorityHubAnalytics from './AuthorityHubAnalytics';
import AuthorityScoreCard from '@/components/authority/AuthorityScoreCard';
import VideoObjectSchema from '@/components/schema/VideoObjectSchema';

// SYN-519 / SYN-512: ISR — revalidate every hour
// Core Web Vitals + E.E.A.T. requirement: static delivery with periodic freshness
export const revalidate = 3600;
export const dynamic = 'force-static';

interface ClientPageParams {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllActiveClientSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: ClientPageParams): Promise<Metadata> {
  const { slug } = await params;
  const result = await getClientBySlug(slug);

  if (!result) {
    return { title: 'Not Found | Synthex Authority Hub' };
  }

  const { client } = result;
  const location = [client.address_city, client.address_state].filter(Boolean).join(', ');

  return {
    title: `${client.name} | Synthex Authority Hub`,
    description: client.description ??
      `${client.name} — verified local business authority profile${location ? ` in ${location}` : ''} powered by Synthex AI marketing.`,
    openGraph: {
      title: `${client.name} | Synthex Authority Hub`,
      description: `AI-verified authority profile for ${client.name}${location ? ` in ${location}` : ''}.`,
      type: 'profile',
      images: client.logo_url ? [{ url: client.logo_url }] : [],
    },
  };
}

export default async function AuthorityHubPage({ params }: ClientPageParams) {
  const { slug } = await params;
  const result = await getClientBySlug(slug);

  if (!result) notFound();

  const { client, latestScore } = result;
  const videos = await getClientVideos(client.id);
  const pageUrl = `https://synthex.social/clients/${slug}`;
  const location = [client.address_city, client.address_state].filter(Boolean).join(', ');

  // Build LocalBusiness JSON-LD
  const localBusinessSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: client.name,
    url: client.url ?? pageUrl,
    ...(client.telephone && { telephone: client.telephone }),
    ...(client.description && { description: client.description }),
    ...(client.logo_url && { image: client.logo_url }),
    address: {
      '@type': 'PostalAddress',
      ...(client.address_street && { streetAddress: client.address_street }),
      ...(client.address_city && { addressLocality: client.address_city }),
      ...(client.address_state && { addressRegion: client.address_state }),
      ...(client.address_postcode && { postalCode: client.address_postcode }),
      addressCountry: client.address_country,
    },
    ...(client.geo_lat && client.geo_lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: client.geo_lat,
        longitude: client.geo_lng,
      },
    }),
    ...(client.opening_hours_json && { openingHours: client.opening_hours_json }),
    sameAs: client.url ? [client.url] : [],
  };

  return (
    <>
      {/* LocalBusiness structured data */}
      <Script
        id="local-business-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        strategy="beforeInteractive"
      />

      {/* VideoObject structured data (if videos exist) */}
      {videos.length > 0 && (
        <VideoObjectSchema videos={videos} clientUrl={pageUrl} />
      )}

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">

            {/* Header */}
            <header className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-orange-400 tracking-widest uppercase bg-orange-400/10 border border-orange-400/20 rounded-full px-3 py-1">
                  Synthex Authority Hub
                </span>
                {latestScore && (
                  <span className="text-xs font-mono text-green-400 tracking-widest uppercase bg-green-400/10 border border-green-400/20 rounded-full px-3 py-1">
                    Verified
                  </span>
                )}
              </div>
              {client.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo_url}
                  alt={`${client.name} logo`}
                  className="h-12 w-auto object-contain mb-4"
                />
              )}
              <h1 className="text-4xl font-bold text-white mb-2">{client.name}</h1>
              {location && (
                <p className="text-slate-400 text-lg">{location}</p>
              )}
              {client.description && (
                <p className="mt-3 text-slate-300 max-w-2xl leading-relaxed">{client.description}</p>
              )}
            </header>

            {/* Authority Score */}
            <div className="mb-8">
              <AuthorityScoreCard score={latestScore} />
            </div>

            {/* Business details */}
            {(client.telephone || client.url || client.address_city) && (
              <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 mb-8">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Business Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {client.telephone && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Phone</p>
                      <a href={`tel:${client.telephone}`} className="text-white hover:text-orange-400 transition-colors">
                        {client.telephone}
                      </a>
                    </div>
                  )}
                  {client.url && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Website</p>
                      <a href={client.url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-orange-400 transition-colors text-sm">
                        {client.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {client.address_city && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Location</p>
                      <p className="text-white text-sm">{location}</p>
                    </div>
                  )}
                  {client.industry && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Industry</p>
                      <p className="text-white text-sm">{client.industry}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Featured Videos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {videos.slice(0, 4).map(v => (
                    <a
                      key={v.id}
                      href={`https://www.youtube.com/watch?v=${v.youtube_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-xl overflow-hidden border border-slate-700/40 hover:border-orange-400/40 transition-colors"
                    >
                      {v.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnail_url}
                          alt={v.title}
                          className="w-full aspect-video object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-3">
                        <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                          {v.title}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>

        <AuthorityHubAnalytics clientSlug={slug} />
      </main>
    </>
  );
}
