import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Authority Campaign | Synthex Marketing Agency',
  description:
    'Portfolio authority campaign package with source register, owned-media drafts, QA checks, and external publishing gates.',
};

type RouteCtx = { params: Promise<{ client: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function ClientAuthorityPackagePage({ params }: RouteCtx) {
  const { client } = await params;

  const campaign = await prisma.marketingAgencyCampaign.findFirst({
    where: {
      organization: { slug: client },
      metadata: { path: ['campaignFamily'], equals: 'portfolio-authority' },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      organization: true,
      sourceRefs: { orderBy: { createdAt: 'asc' } },
      claims: { orderBy: { createdAt: 'asc' } },
      qaReports: { orderBy: { createdAt: 'desc' }, take: 1 },
      exportPackages: { orderBy: { createdAt: 'desc' }, take: 1 },
      assets: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!campaign) notFound();

  const appCampaign = await prisma.campaign.findFirst({
    where: {
      name: campaign.name,
      organizationId: campaign.organizationId,
      deletedAt: null,
    },
    include: {
      posts: { orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }] },
    },
  });

  const studioDrafts = await prisma.studioContentDraft.findMany({
    where: {
      organizationId: campaign.organizationId,
      clientSlug: client,
      metadata: { path: ['campaignFamily'], equals: 'portfolio-authority' },
    },
    orderBy: { createdAt: 'asc' },
  });

  const qaReport = campaign.qaReports[0];
  const exportPackage = campaign.exportPackages[0];
  const metadata = asRecord(campaign.metadata);
  const connectedPlatforms = asList(metadata.connectedPlatforms);
  const missingPlatforms = asList(metadata.missingPlatforms);
  const warnings = asList(metadata.warnings);
  const publicAssets = asList(metadata.publicAssets);
  const blockedReasons = asList(qaReport?.blockedReasons);
  const checks = Array.isArray(qaReport?.checks)
    ? (qaReport.checks as Array<{
        name?: string;
        status?: string;
        detail?: string | number;
      }>)
    : [];

  const posts = appCampaign?.posts ?? [];
  const ownedPosts = posts.filter(post =>
    ['blog', 'newsletter'].includes(post.platform)
  );
  const externalPosts = posts.filter(
    post => !['blog', 'newsletter'].includes(post.platform)
  );

  return (
    <main className="container mx-auto flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
          Portfolio authority package
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {campaign.primaryOffer}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
            <span className="rounded-sm border border-sky-400/30 px-3 py-1 text-sky-100">
              {campaign.providerMode}
            </span>
            <span className="rounded-sm border border-white/15 px-3 py-1 text-white/75">
              {campaign.status}
            </span>
            <span className="rounded-sm border border-white/15 px-3 py-1 text-white/75">
              {qaReport?.status ?? 'qa missing'}
            </span>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Business
          </p>
          <p className="mt-1 text-sm text-white/85">
            {campaign.organization.name}
          </p>
        </div>
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Owned Media
          </p>
          <p className="mt-1 text-sm text-white/85">
            {ownedPosts.length} ready drafts
          </p>
        </div>
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            External Social
          </p>
          <p className="mt-1 text-sm text-white/85">
            {externalPosts.length} gated drafts
          </p>
        </div>
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Approved Drafts
          </p>
          <p className="mt-1 text-sm text-white/85">{studioDrafts.length}</p>
        </div>
      </section>

      <section className="rounded-sm border border-emerald-400/25 bg-emerald-950/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Owned-Media Package Is Live
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              This campaign is now live inside Synthex with source references,
              app campaign posts, approved Studio drafts, QA checks, and export
              handoff. External platforms remain gated until credentials,
              approval, current source checks, and asset-rights receipts are
              recorded.
            </p>
          </div>
          <span className="rounded-sm border border-emerald-400/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
            {campaign.sourceRefs.length} sources
          </span>
        </div>
      </section>

      {publicAssets.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {publicAssets.map(asset => (
            <article
              key={asset}
              className="overflow-hidden rounded-sm border border-white/10 bg-slate-950/30"
            >
              <img
                src={asset}
                alt={`${campaign.name} campaign asset`}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="p-4">
                <h3 className="text-sm font-semibold">Campaign visual proof</h3>
                <p className="mt-2 text-xs text-white/55">
                  Support asset. Final channel creative must keep editable copy
                  and source notes outside the bitmap.
                </p>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-sm border border-white/10 p-5">
          <h2 className="text-lg font-semibold">Visual Production Queue</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Source-led copy is live in Synthex. Brand-specific visuals are the
            next production item and must pass the visual art direction gate
            before external distribution.
          </p>
        </section>
      )}

      <section className="rounded-sm border border-amber-400/25 bg-amber-950/15 p-5">
        <h2 className="text-lg font-semibold">External Publishing Gate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connected platforms: {connectedPlatforms.join(', ') || 'none found'}.
          Missing or gated platforms:{' '}
          {missingPlatforms.join(', ') || 'final approval and asset rights'}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from(new Set([...blockedReasons, ...warnings])).map(reason => (
            <span
              key={reason}
              className="rounded-sm border border-amber-400/20 px-3 py-2 text-sm text-amber-100"
            >
              {reason}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {ownedPosts.map(post => {
          const postMetadata = asRecord(post.metadata);
          return (
            <article
              key={post.id}
              className="rounded-sm border border-emerald-400/20 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  {String(postMetadata.title ?? post.platform)}
                </h2>
                <span className="rounded-sm border border-emerald-400/20 px-2 py-1 text-xs text-emerald-100">
                  {post.status}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-white/75">
                {post.content}
              </p>
            </article>
          );
        })}
      </section>

      <section className="rounded-sm border border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">External Draft Queue</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              These are staged as production drafts but are not marked as
              externally published. They need platform receipts before Synthex
              can call them live on third-party media.
            </p>
          </div>
          <span className="rounded-sm border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/65">
            {externalPosts.length} drafts
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {externalPosts.map(post => {
            const postMetadata = asRecord(post.metadata);
            return (
              <article
                key={post.id}
                className="rounded-sm border border-white/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {String(postMetadata.title ?? post.platform)}
                  </h3>
                  <span className="rounded-sm border border-white/15 px-2 py-1 text-xs text-white/60">
                    {post.platform}
                  </span>
                </div>
                <p className="mt-3 line-clamp-6 whitespace-pre-line text-xs text-white/65">
                  {post.content}
                </p>
                <p className="mt-3 text-xs text-amber-100">
                  {String(
                    postMetadata.publishBlockedReason ??
                      'Awaiting publish receipt.'
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-sm border border-white/10 p-5">
          {/* SYN-MCP-001: approval and evidence are separate axes — show both. */}
          <h2 className="text-lg font-semibold">Claims</h2>
          <div className="mt-3 grid gap-3">
            {campaign.claims.map(claim => (
              <div
                key={claim.id}
                className="rounded-sm border border-white/10 px-3 py-2 text-sm"
              >
                <p className="text-white/80">{claim.statement}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-sm border px-2 py-0.5 ${
                      claim.approvalStatus === 'approved'
                        ? 'border-emerald-400/25 text-emerald-100'
                        : claim.approvalStatus === 'rejected'
                          ? 'border-rose-400/25 text-rose-100'
                          : 'border-white/15 text-white/60'
                    }`}
                  >
                    Approval: {claim.approvalStatus}
                  </span>
                  <span
                    className={`rounded-sm border px-2 py-0.5 ${
                      claim.evidenceStatus === 'verified'
                        ? 'border-emerald-400/25 text-emerald-100'
                        : claim.evidenceStatus === 'blocked' ||
                            claim.evidenceStatus === 'disputed'
                          ? 'border-amber-400/25 text-amber-100'
                          : 'border-white/15 text-white/60'
                    }`}
                  >
                    Evidence: {claim.evidenceStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-white/10 p-5">
          <h2 className="text-lg font-semibold">QA Checks</h2>
          <div className="mt-3 grid gap-3">
            {checks.map(check => (
              <div
                key={check.name}
                className="rounded-sm border border-white/10 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/80">{check.name}</span>
                  <span className="text-white/55">{check.status}</span>
                </div>
                {check.detail && (
                  <p className="mt-1 text-xs text-white/45">{check.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-sm border border-white/10 p-5">
        <h2 className="text-lg font-semibold">Evidence Sources</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {campaign.sourceRefs.map(source => (
            <a
              key={source.id}
              href={source.url ?? '#'}
              className="rounded-sm border border-white/10 px-3 py-2 text-sm text-white/75 hover:text-white"
            >
              {source.label}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-white/10 p-5">
        <h2 className="text-lg font-semibold">Export Handoff</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {exportPackage?.handoffNotes ?? 'No export package found.'}
        </p>
        <p className="mt-3 text-xs text-white/45">
          Last updated {formatDate(campaign.updatedAt)}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/marketing-agency/${client}/studio`}
            className="inline-flex rounded-sm bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Open Studio Approval Board
          </Link>
          <Link
            href="/dashboard/marketing-agency"
            className="inline-flex rounded-sm border border-white/15 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Marketing Agency
          </Link>
        </div>
      </section>
    </main>
  );
}
