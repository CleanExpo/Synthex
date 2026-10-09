/** Offline visual readiness audit. No provider, database or render imports. */
import fs from 'node:fs';
import path from 'node:path';
import { brands } from '../../packages/brand-config/src/brands';
import {
  BRAND_SLUG_MAP,
  BRAND_IDENTITY_SLUG_MAP,
} from '../remotion/brand-registry';
import identityGaps from '../../config/brand-identity-gaps.json';
import { BRAND_CONTENT } from '../remotion/brand-content';
import logoBaseline from '../../config/brand-logo-baseline.json';
import logoPacks from '../../config/brand-logo-packs.json';

const REQUIRED_SLUGS = [
  'dr',
  'nrpg',
  'ra',
  'carsi',
  'synthex',
  'unite',
  'john-coutis',
  'ccw',
];

export interface ReferenceManifest {
  industries: Record<
    string,
    {
      subjects?: Record<
        string,
        {
          rights?: string;
          images?: Array<{
            file: string;
            width: number;
            height: number;
            source: string;
          }>;
        }
      >;
    }
  >;
}

/** A missing or invalid local asset cannot count as usable reference coverage. */
export function auditReferenceManifest(
  root: string,
  manifest: ReferenceManifest
) {
  const missingAssets: string[] = [];
  const invalidImages: string[] = [];
  const rightsGaps: string[] = [];
  let subjects = 0;
  let images = 0;
  let usableImages = 0;
  for (const [industry, data] of Object.entries(manifest.industries)) {
    for (const [subject, record] of Object.entries(data.subjects ?? {})) {
      subjects++;
      const pointer = `public/reference-library/manifest.json#/industries/${industry}/subjects/${subject}`;
      if (record.rights !== 'owned') rightsGaps.push(`${pointer}/rights`);
      for (const [index, image] of (record.images ?? []).entries()) {
        images++;
        const asset = `public/reference-library/${industry}/${image.file}`;
        const safe =
          /^[a-z0-9-]+$/.test(industry) &&
          typeof image.file === 'string' &&
          image.file.length > 0 &&
          !image.file.includes('..') &&
          !/[\\/]/.test(image.file);
        const valid =
          safe &&
          Number.isFinite(image.width) &&
          image.width > 0 &&
          Number.isFinite(image.height) &&
          image.height > 0 &&
          typeof image.source === 'string' &&
          image.source.length > 0;
        if (!valid) {
          invalidImages.push(`${pointer}/images/${index}`);
          continue;
        }
        if (
          !fs.existsSync(path.join(root, asset)) ||
          !fs.statSync(path.join(root, asset)).isFile()
        ) {
          missingAssets.push(asset);
        } else if (record.rights === 'owned') usableImages++;
      }
    }
  }
  return {
    industries: Object.keys(manifest.industries).length,
    subjects,
    images,
    usableImages,
    missingAssets,
    invalidImages,
    rightsGaps,
  };
}

export function runBrandVisualPreflight(repositoryRoot: string) {
  const root = path.resolve(repositoryRoot);
  const configuredBrandSlugs = Object.keys(brands);
  const pendingBrandSlugs = Object.keys(identityGaps).filter(
    slug => !(slug in brands)
  );
  const missingBrandSlugs = REQUIRED_SLUGS.filter(
    slug =>
      !configuredBrandSlugs.includes(slug) && !pendingBrandSlugs.includes(slug)
  );
  const mapped = new Set(Object.values(BRAND_IDENTITY_SLUG_MAP));
  const unmappedBrandSlugs = configuredBrandSlugs.filter(
    slug => !mapped.has(slug as keyof typeof brands)
  );
  const declaredAssets = [
    ...new Set([
      ...Object.values(brands).flatMap(brand => [
        ...Object.values(brand.typography)
          .filter(Boolean)
          .map(font => font!.src),
        brand.logo.primary,
        brand.logo.inverted,
        brand.logo.icon,
      ]),
      ...Object.values(logoPacks)
        .flat()
        .map(asset => asset.slice(7)),
    ]),
  ].sort();
  // Only public/ is deployable. A file in the package directory is not a CDN asset.
  const missingAssets = declaredAssets
    .filter(asset => {
      const file = path.join(root, 'public', asset);
      return !fs.existsSync(file) || !fs.statSync(file).isFile();
    })
    .map(asset => `public/${asset}`);
  const declaredLogos = Object.values(brands).flatMap(brand => [
    brand.logo.primary,
    brand.logo.inverted,
    brand.logo.icon,
  ]);
  const actualMissingLogos = missingAssets
    .filter(asset => asset.startsWith('public/logos/'))
    .map(asset => asset.slice(7))
    .filter(asset => declaredLogos.includes(asset));
  const baselineMissingLogos = new Set<string>(logoBaseline.missing);
  const logoBaselineDrift = [
    ...new Set([...actualMissingLogos, ...logoBaseline.missing]),
  ].filter(
    asset =>
      actualMissingLogos.includes(asset) !== baselineMissingLogos.has(asset) ||
      !declaredLogos.includes(asset)
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, 'public/reference-library/manifest.json'),
      'utf8'
    )
  ) as ReferenceManifest;
  const referenceCoverage = auditReferenceManifest(root, manifest);
  const colourDivergences: string[] = [];
  for (const content of BRAND_CONTENT) {
    const slug = BRAND_SLUG_MAP[content.id];
    if (!slug || !brands[slug]) {
      colourDivergences.push(
        `lib/remotion/brand-content.ts#${content.id}.unmapped`
      );
    } else if (
      brands[slug].colour.primary.toLowerCase() !==
      content.brandColour.toLowerCase()
    ) {
      colourDivergences.push(
        `lib/remotion/brand-content.ts#${content.id}.brandColour`
      );
    }
  }
  const approvalGaps = Object.entries(identityGaps).flatMap(([slug, gap]) =>
    gap.required.map(requirement => ({
      slug,
      file: `config/brand-identity-gaps.json#/${slug}`,
      source: gap.source,
      requirement,
    }))
  );
  // Every proposal needs an explicit approval intake entry, never an implicit pass.
  const untrackedProposals = Object.values(brands)
    .filter(
      brand => brand.tokenStatus === 'proposal' && !(brand.slug in identityGaps)
    )
    .map(brand => brand.slug);
  const brandReadiness = Object.fromEntries(
    Object.entries(brands).map(([slug, brand]) => {
      const assets = [
        ...Object.values(brand.typography)
          .filter(Boolean)
          .map(font => `public/${font!.src}`),
        ...(['primary', 'inverted', 'icon'] as const).map(
          variant => `public/${brand.logo[variant]}`
        ),
        ...(logoPacks[slug as keyof typeof logoPacks] ?? []),
      ];
      const absent = missingAssets.filter(asset => assets.includes(asset));
      const approvals = approvalGaps.filter(gap => gap.slug === slug);
      return [
        slug,
        {
          ready:
            absent.length === 0 &&
            approvals.length === 0 &&
            brand.tokenStatus !== 'proposal',
          missingAssets: absent,
          approvalGaps: approvals,
        },
      ];
    })
  );
  const codeDebtCount =
    missingBrandSlugs.length +
    unmappedBrandSlugs.length +
    logoBaselineDrift.length +
    colourDivergences.length +
    referenceCoverage.invalidImages.length +
    untrackedProposals.length;
  const assetGapCount =
    missingAssets.length + referenceCoverage.missingAssets.length;
  const rightsGapCount =
    approvalGaps.length + referenceCoverage.rightsGaps.length;
  const coverageGapCount = referenceCoverage.usableImages === 0 ? 1 : 0;
  const debtCount =
    codeDebtCount + assetGapCount + rightsGapCount + coverageGapCount;
  return {
    root,
    configuredBrandSlugs,
    pendingBrandSlugs,
    missingBrandSlugs,
    unmappedBrandSlugs,
    declaredAssets: declaredAssets.map(asset => `public/${asset}`),
    missingAssets,
    logoBaselineDrift,
    colourDivergences,
    untrackedProposals,
    approvalGaps,
    brandReadiness,
    referenceCoverage,
    readiness: {
      ready: debtCount === 0,
      codeDebtCount,
      assetGapCount,
      rightsGapCount,
      coverageGapCount,
      debtCount,
    },
    execution: { providerCalls: 0, spend: 0, deploys: 0, productionWrites: 0 },
  };
}

export function brandVisualPreflightExitCode(
  report: ReturnType<typeof runBrandVisualPreflight>
): 0 | 1 {
  return report.readiness.ready ? 0 : 1;
}
