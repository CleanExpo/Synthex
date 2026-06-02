import Link from 'next/link';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { ccwEofyCampaignCalendar } from '@/lib/marketing-agency/ccw-eofy-calendar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CCW EOFY Sales Package | Synthex Marketing Agency',
  description:
    'Live CCW EOFY sales package with staged social drafts, QA gates, export notes, and credential blockers.',
};

const CAMPAIGN_SLUG = 'ccw-eofy-sales-2026';

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function CcwEofyPackagePage() {
  const campaign = await prisma.marketingAgencyCampaign.findFirst({
    where: {
      slug: CAMPAIGN_SLUG,
      organization: { slug: 'ccw' },
    },
    include: {
      organization: true,
      sourceRefs: { orderBy: { createdAt: 'asc' } },
      claims: { orderBy: { createdAt: 'asc' } },
      qaReports: { orderBy: { createdAt: 'desc' }, take: 1 },
      exportPackages: { orderBy: { createdAt: 'desc' }, take: 1 },
      assets: {
        where: {
          provider: 'synthex',
          assetType: {
            in: [
              'campaign_material_pack',
              'draft_social_svg_set',
              'real_shopify_product_png_set',
              'google_pomelli_business_dna',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const appCampaign = await prisma.campaign.findFirst({
    where: {
      name: 'CCW EOFY Sales Acceleration 2026',
      organization: { slug: 'ccw' },
      deletedAt: null,
    },
    include: {
      posts: { orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }] },
    },
  });

  const studioDraft = await prisma.studioContentDraft.findFirst({
    where: {
      organizationId: campaign?.organizationId ?? '__missing__',
      clientSlug: 'ccw',
      metadata: { path: ['campaignSlug'], equals: CAMPAIGN_SLUG },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!campaign || !appCampaign) {
    return (
      <main className="container mx-auto flex min-h-[60vh] flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Marketing Agency
          </p>
          <h1 className="text-3xl font-bold">CCW EOFY Package</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The live CCW EOFY package has not been found in production records.
          </p>
        </header>
      </main>
    );
  }

  const qaReport = campaign.qaReports[0];
  const exportPackage = campaign.exportPackages[0];
  const blockedReasons = asList(qaReport?.blockedReasons);
  const checks = Array.isArray(qaReport?.checks)
    ? (qaReport.checks as Array<{
        name?: string;
        status?: string;
        detail?: string | number;
      }>)
    : [];

  return (
    <main className="container mx-auto flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
          CCW live campaign package
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {campaign.primaryOffer}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
            <span className="rounded-sm border border-emerald-400/30 px-3 py-1 text-emerald-200">
              {campaign.providerMode}
            </span>
            <span className="rounded-sm border border-white/15 px-3 py-1 text-white/75">
              {campaign.status}
            </span>
            <span className="rounded-sm border border-white/15 px-3 py-1 text-white/75">
              studio {studioDraft?.status ?? 'not found'}
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
            Campaign
          </p>
          <p className="mt-1 text-sm text-white/85">{appCampaign.status}</p>
        </div>
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Drafts
          </p>
          <p className="mt-1 text-sm text-white/85">
            {appCampaign.posts.length} platform drafts
          </p>
        </div>
        <div className="rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Approved
          </p>
          <p className="mt-1 text-sm text-white/85">
            {formatDate(studioDraft?.approvedAt)}
          </p>
        </div>
      </section>

      <section className="rounded-sm border border-emerald-400/25 bg-emerald-950/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Final Campaign Materials</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The full CCW EOFY material pack is generated, attached to this
              campaign, and staged as draft production content. These assets
              remain blocked from external publishing until credentials and
              final CCW approval are recorded.
            </p>
          </div>
          <span className="rounded-sm border border-emerald-400/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
            {campaign.assets.length} material records
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {campaign.assets.map(asset => {
            const metadata = asRecord(asset.metadata);
            return (
              <article
                key={asset.id}
                className="rounded-sm border border-white/10 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{asset.title}</h3>
                  <span className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/60">
                    {asset.assetType}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-white/45">
                  {asset.licenceStatus}
                </p>
                <div className="mt-3 grid gap-2 text-sm text-white/70">
                  {'calendarSlots' in metadata && (
                    <p>{String(metadata.calendarSlots)} calendar slots</p>
                  )}
                  {'platformExecutions' in metadata && (
                    <p>
                      {String(metadata.platformExecutions)} platform executions
                    </p>
                  )}
                  {'assetCount' in metadata && (
                    <p>{String(metadata.assetCount)} draft SVG assets</p>
                  )}
                  {'pngAssetCount' in metadata && (
                    <p>{String(metadata.pngAssetCount)} real-product PNGs</p>
                  )}
                  {'productCount' in metadata && (
                    <p>{String(metadata.productCount)} live Shopify products</p>
                  )}
                  {'businessName' in metadata && (
                    <p>Business DNA: {String(metadata.businessName)}</p>
                  )}
                  {'website' in metadata && (
                    <p className="break-all text-white/45">
                      Website: {String(metadata.website)}
                    </p>
                  )}
                  {'externalPomelliApiAvailable' in metadata && (
                    <p>
                      External Pomelli API:{' '}
                      {metadata.externalPomelliApiAvailable
                        ? 'available'
                        : 'not available'}
                    </p>
                  )}
                  {'aiBackgroundModels' in metadata && (
                    <p className="break-all text-white/45">
                      AI background model:{' '}
                      {JSON.stringify(metadata.aiBackgroundModels)}
                    </p>
                  )}
                  {'brandRoot' in metadata && (
                    <p className="break-all text-white/45">
                      CCW folder: {String(metadata.brandRoot)}
                    </p>
                  )}
                  {'assetRoot' in metadata && (
                    <p className="break-all text-white/45">
                      Asset folder: {String(metadata.assetRoot)}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-sm border border-amber-400/25 bg-amber-950/15 p-5">
        <h2 className="text-lg font-semibold">Publishing Gate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The campaign is completed inside Synthex and staged for handoff.
          External posting remains blocked until CCW submits Facebook/Instagram,
          LinkedIn, and Reddit credentials through secure intake.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {blockedReasons.map(reason => (
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
        {appCampaign.posts.map(post => (
          <article
            key={post.id}
            className="rounded-sm border border-white/10 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold capitalize">
                {post.platform}
              </h2>
              <span className="rounded-sm border border-white/15 px-2 py-1 text-xs text-white/65">
                {post.status}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-white/75">
              {post.content}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-sm border border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Campaign Calendar</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Full EOFY campaign run from 3 June to 30 June. Entries are applied
              as scheduled drafts in the CCW content calendar and remain blocked
              from external publishing until credentials and final human
              approval are in place.
            </p>
          </div>
          <span className="rounded-sm border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/65">
            {ccwEofyCampaignCalendar.length} slots
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {ccwEofyCampaignCalendar.map(slot => (
            <article
              key={slot.id}
              className="rounded-sm border border-white/10 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    {slot.date} at {slot.timeAest} AEST
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">{slot.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {slot.platforms.map(platform => (
                    <span
                      key={platform}
                      className="rounded-sm border border-white/10 px-2 py-1 text-xs capitalize text-white/65"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-white/70">{slot.objective}</p>
              <p className="mt-2 text-xs text-white/45">{slot.assetBrief}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-sm border border-white/10 p-5">
          <h2 className="text-lg font-semibold">Evidence Sources</h2>
          <div className="mt-3 grid gap-3">
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
        <h2 className="text-lg font-semibold">Export Handoff</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {exportPackage?.handoffNotes ?? 'No export package found.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(exportPackage?.formats ?? []).map(format => (
            <span
              key={format}
              className="rounded-sm border border-white/10 px-3 py-1 text-sm text-white/75"
            >
              {format}
            </span>
          ))}
        </div>
        <Link
          href="/dashboard/marketing-agency/ccw/studio"
          className="mt-5 inline-flex rounded-sm bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Open Studio Approval Board
        </Link>
      </section>
    </main>
  );
}
