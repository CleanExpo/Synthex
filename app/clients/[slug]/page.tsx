// ISR: Revalidate every hour. Authority Hub pages carry LocalBusiness + VideoObject schema
// for E.E.A.T. positioning and must meet Core Web Vitals for Google's assessment.
// DO NOT remove this export — see SYN-516 / SYN-512 for architectural context.
export const revalidate = 3600;

/**
 * Authority Hub — app/clients/[slug]/page.tsx
 *
 * Public profile page for each Synthex client.
 * URL: synthex.social/clients/[slug]
 *
 * Features:
 *  - LocalBusiness JSON-LD schema injection (Google E.E.A.T. positioning)
 *  - ISR with 1-hour revalidation
 *  - Pre-generated static params for all active orgs at build time
 *  - 404 for unknown or inactive slugs
 *  - Hero, authority score placeholder, E.E.A.T. pillars, reviews, contact
 *
 * @task SYN-512
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthorityHubAnalytics } from './AuthorityHubAnalytics';
import { LocalBusinessSchema } from '@/components/schema/LocalBusinessSchema';
import {
  getClientBySlug,
  getAllClientSlugs,
} from '@/lib/clients/getClientBySlug';
import type { ClientProfile } from '@/lib/clients/getClientBySlug';
import prisma from '@/lib/prisma';

// ── Static generation ─────────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const slugs = await getAllClientSlugs();
    return slugs.map(slug => ({ slug }));
  } catch {
    // DB unreachable at build time (CI placeholder DB / cold build).
    // Fall back to zero pre-generated paths — ISR renders pages on first request.
    return [];
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) return { title: 'Client not found' };

  const title = `${client.businessName} | Synthex Authority Hub`;
  const description =
    client.description ??
    `Verified authority profile for ${client.businessName}. Powered by Synthex.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://synthex.social/clients/${slug}`,
      ...(client.logo && { images: [{ url: client.logo }] }),
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-amber-400' : 'text-white/20'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </div>
  );
}

// ── Authority score types ─────────────────────────────────────────────────────

interface PublicEEATBreakdown {
  gbpCompleteness: number;
  reviewVelocity: number;
  contentFreshness: number;
  backlinkSignals: number;
  schemaCoverage: number;
  // v1.1 fields (SYN-532)
  reviewResponseRate?: number;
  averageReviewScore?: number;
  /** @deprecated v1.0 only — replaced by reviewResponseRate + averageReviewScore */
  socialProof?: number;
}

interface PublicAuthorityScore {
  score: number;
  breakdown: PublicEEATBreakdown;
}

function getPublicScoreColour(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#f97316';
  return '#ef4444';
}

function getPublicScoreLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Building';
  return 'Getting started';
}

function PublicPillarBar({
  label,
  value,
  maxValue,
}: {
  label: string;
  value: number;
  maxValue: number;
}) {
  const pct = Math.round((value / maxValue) * 100);
  const colour = getPublicScoreColour(pct);
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-white/40 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colour }}
        />
      </div>
      <span className="text-[10px] text-white/25 w-10 text-right shrink-0">
        {value}/{maxValue}
      </span>
    </div>
  );
}

function AddressBlock({ client }: { client: ClientProfile }) {
  const addr = client.address;
  if (!addr && !client.phone) return null;

  const streetLine = addr?.addressLines?.join(', ');
  const cityLine = [addr?.locality, addr?.region, addr?.postalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-1.5">
      {streetLine && <p className="text-sm text-white/60">{streetLine}</p>}
      {cityLine && <p className="text-sm text-white/60">{cityLine}</p>}
      {client.phone && (
        <a
          href={`tel:${client.phone}`}
          className="text-sm text-orange-400/80 hover:text-orange-400 transition-colors"
        >
          {client.phone}
        </a>
      )}
    </div>
  );
}

// ── GEO schema helpers (SYN-532) ─────────────────────────────────────────────

function buildFAQItems(client: ClientProfile): Array<{ q: string; a: string }> {
  const items: Array<{ q: string; a: string }> = [];
  const name = client.businessName;

  if (client.description) {
    items.push({ q: `What does ${name} do?`, a: client.description });
  }

  if (client.address) {
    const parts = [
      ...(client.address.addressLines ?? []),
      client.address.locality,
      client.address.region,
      client.address.postalCode,
    ].filter(Boolean);
    if (parts.length > 0) {
      items.push({
        q: `Where is ${name} located?`,
        a: `${name} is located at ${parts.join(', ')}.`,
      });
    }
  }

  if (client.phone) {
    items.push({
      q: `How can I contact ${name}?`,
      a: client.website
        ? `You can reach ${name} by phone at ${client.phone} or visit their website at ${client.website}.`
        : `You can reach ${name} by phone at ${client.phone}.`,
    });
  }

  if (client.industry) {
    items.push({
      q: `What industry is ${name} in?`,
      a: `${name} operates in the ${client.industry} industry.`,
    });
  }

  return items;
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface AuthorityHubPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AuthorityHubPage({
  params,
}: AuthorityHubPageProps) {
  const { slug } = await params;

  const client = await getClientBySlug(slug);
  if (!client) notFound();

  // Fetch latest authority score — non-fatal (table may not exist pre-migration)
  let authorityScore: PublicAuthorityScore | null = null;
  try {
    const row = await prisma.authorityScore.findFirst({
      where: { organization: { slug } },
      orderBy: { computedAt: 'desc' },
      select: { score: true, eeAtBreakdown: true },
    });
    if (row) {
      authorityScore = {
        score: row.score,
        breakdown: row.eeAtBreakdown as unknown as PublicEEATBreakdown,
      };
    }
  } catch {
    // table does not exist pre-migration — render placeholder instead
  }

  const hasAddress = client.address !== null;
  const hasReviews = client.reviews.length > 0;

  const faqItems = buildFAQItems(client);
  const faqSchema =
    faqItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        }
      : null;

  // Safe — content is JSON.stringify of server-built plain objects.
  // Same pattern as LocalBusinessSchema (see SYN-512 security note).
  const speakableSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${client.businessName} | Synthex Authority Hub`,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.speakable-description', '.speakable-score'],
    },
  };

  return (
    <>
      {/* JSON-LD schema injection */}
      <LocalBusinessSchema client={client} />
      {}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      {}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableSchema) }}
      />

      <main className="min-h-screen bg-[#06060a] text-white">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6">
            <div className="flex items-start gap-4">
              {/* Logo or initials */}
              {client.logo ? (
                <img
                  src={client.logo}
                  alt={`${client.businessName} logo`}
                  className="w-14 h-14 rounded-sm object-cover flex-shrink-0 border border-white/[0.08]"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-sm flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                  style={{
                    background: client.primaryColor
                      ? `${client.primaryColor}20`
                      : 'rgba(249,115,22,0.1)',
                    borderColor: client.primaryColor
                      ? `${client.primaryColor}30`
                      : 'rgba(249,115,22,0.2)',
                    borderWidth: '1px',
                  }}
                  aria-hidden="true"
                >
                  {client.businessName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                  {client.businessName}
                </h1>

                <div className="flex flex-wrap gap-2 mt-2">
                  {client.industry && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-white/[0.04] border border-white/[0.08] text-xs text-white/50">
                      {client.industry}
                    </span>
                  )}
                  {client.vertical && client.vertical !== 'other' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-orange-500/[0.08] border border-orange-500/20 text-xs text-orange-300/70 capitalize">
                      {client.vertical}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-500/[0.08] border border-emerald-500/20 text-xs text-emerald-400/70">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      aria-hidden="true"
                    />
                    Verified by Synthex
                  </span>
                </div>

                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    {client.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>

            {client.description && (
              <p className="speakable-description mt-5 text-sm text-white/50 leading-relaxed max-w-2xl">
                {client.description}
              </p>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 space-y-8">
          {/* ── Authority score ───────────────────────────────────────────── */}
          <section
            aria-labelledby="authority-score-heading"
            className="speakable-score"
          >
            <div className="flex items-center gap-2 mb-4">
              <h2
                id="authority-score-heading"
                className="text-xs uppercase tracking-[0.3em] text-white/40"
              >
                Authority Score
              </h2>
            </div>

            {authorityScore ? (
              /* Live score */
              <div className="border border-white/[0.06] rounded-sm bg-white/[0.02] p-5 space-y-5">
                {/* Score ring + label row */}
                <div className="flex items-center gap-5">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {(() => {
                      const r = 26;
                      const circ = 2 * Math.PI * r;
                      const filled = (authorityScore.score / 100) * circ;
                      const colour = getPublicScoreColour(authorityScore.score);
                      return (
                        <svg
                          className="w-full h-full -rotate-90"
                          viewBox="0 0 60 60"
                          aria-label={`Authority score: ${authorityScore.score} out of 100`}
                        >
                          <circle
                            cx="30"
                            cy="30"
                            r={r}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="4"
                          />
                          <circle
                            cx="30"
                            cy="30"
                            r={r}
                            fill="none"
                            stroke={colour}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${filled} ${circ - filled}`}
                          />
                        </svg>
                      );
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {authorityScore.score}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p
                      className="text-lg font-semibold"
                      style={{
                        color: getPublicScoreColour(authorityScore.score),
                      }}
                    >
                      {getPublicScoreLabel(authorityScore.score)}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">
                      E.E.A.T. composite · v1.1
                    </p>
                  </div>
                </div>

                {/* Pillar breakdown — v1.1 rubric (SYN-532) */}
                <div className="space-y-2 pt-1 border-t border-white/[0.05]">
                  <PublicPillarBar
                    label="GBP completeness"
                    value={authorityScore.breakdown.gbpCompleteness}
                    maxValue={20}
                  />
                  <PublicPillarBar
                    label="Review velocity"
                    value={authorityScore.breakdown.reviewVelocity}
                    maxValue={15}
                  />
                  <PublicPillarBar
                    label="Content freshness"
                    value={authorityScore.breakdown.contentFreshness}
                    maxValue={15}
                  />
                  <PublicPillarBar
                    label="Backlink signals"
                    value={authorityScore.breakdown.backlinkSignals}
                    maxValue={10}
                  />
                  <PublicPillarBar
                    label="Schema coverage"
                    value={authorityScore.breakdown.schemaCoverage}
                    maxValue={10}
                  />
                  {/* v1.1 new pillars */}
                  {authorityScore.breakdown.reviewResponseRate !==
                    undefined && (
                    <PublicPillarBar
                      label="Response rate"
                      value={authorityScore.breakdown.reviewResponseRate}
                      maxValue={15}
                    />
                  )}
                  {authorityScore.breakdown.averageReviewScore !==
                    undefined && (
                    <PublicPillarBar
                      label="Review quality"
                      value={authorityScore.breakdown.averageReviewScore}
                      maxValue={15}
                    />
                  )}
                  {/* v1.0 fallback — shown only if v1.1 fields are absent */}
                  {authorityScore.breakdown.socialProof !== undefined &&
                    authorityScore.breakdown.reviewResponseRate ===
                      undefined && (
                      <PublicPillarBar
                        label="Social proof"
                        value={authorityScore.breakdown.socialProof}
                        maxValue={10}
                      />
                    )}
                </div>
              </div>
            ) : (
              /* Placeholder — score not yet computed */
              <div className="border border-white/[0.06] rounded-sm bg-white/[0.02] p-5 flex items-center gap-5">
                <div
                  className="relative w-16 h-16 flex-shrink-0"
                  aria-hidden="true"
                >
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
                    <circle
                      cx="30"
                      cy="30"
                      r="26"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="26"
                      fill="none"
                      stroke="rgba(249,115,22,0.25)"
                      strokeWidth="4"
                      strokeDasharray="163"
                      strokeDashoffset="122"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-white/30">—</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-white/60">
                    Brand authority measurement is being calibrated
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    Full E.E.A.T. score launches soon
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Google reviews ─────────────────────────────────────────────── */}
          {hasReviews && (
            <section aria-labelledby="reviews-heading">
              <div className="flex items-center gap-2 mb-4">
                <h2
                  id="reviews-heading"
                  className="text-xs uppercase tracking-[0.3em] text-white/40"
                >
                  Customer Reviews
                </h2>
              </div>
              <div className="space-y-3">
                {client.reviews.map(review => (
                  <article
                    key={review.id}
                    className="border border-white/[0.06] rounded-sm bg-white/[0.02] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] text-white/50 font-medium">
                          {(review.reviewerName ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-white/60 font-medium">
                          {review.reviewerName ?? 'Anonymous'}
                        </span>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="text-xs text-white/50 leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                    <time
                      dateTime={review.reviewTime.toISOString()}
                      className="text-[10px] text-white/25"
                    >
                      {new Date(review.reviewTime).toLocaleDateString('en-AU', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── Contact / location ─────────────────────────────────────────── */}
          {(hasAddress || client.phone) && (
            <section aria-labelledby="contact-heading">
              <div className="flex items-center gap-2 mb-4">
                <h2
                  id="contact-heading"
                  className="text-xs uppercase tracking-[0.3em] text-white/40"
                >
                  Contact
                </h2>
              </div>
              <div className="border border-white/[0.06] rounded-sm bg-white/[0.02] p-4">
                <AddressBlock client={client} />
              </div>
            </section>
          )}

          {/* ── Powered by Synthex ────────────────────────────────────────── */}
          <footer className="border-t border-white/[0.04] pt-6 flex items-center justify-between">
            <a
              href="https://synthex.social"
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              Powered by <span className="text-orange-500/50">Synthex</span>
            </a>
            <span className="text-[10px] text-white/15">
              Authority Hub · {new Date().getFullYear()}
            </span>
          </footer>
        </div>

        {/* Vercel Analytics event — non-blocking client component */}
        <AuthorityHubAnalytics clientSlug={slug} />
      </main>
    </>
  );
}
