#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import prisma from '../lib/prisma';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
} from '../lib/marketing-agency/ccw-eofy-calendar';
import { buildCcwEofyAuthorityMetadata } from '../lib/marketing-agency/ccw-eofy-authority-manifest';

const model = 'gpt-image-2';
const provider = 'openai';
const generatedRoot = 'assets/openai-generated';
const manifestFile = '11-openai-image-generation-manifest.json';
const brandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/EOFY-2026-Campaign-Materials';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/eofy-2026-materials'
);

type ImageSpec = {
  id: string;
  title: string;
  size: '1024x1024' | '1536x1024';
  prompt: string;
};

const imageSpecs: ImageSpec[] = [
  {
    id: 'ccw-eofy-trade-equipment-shortlist-openai',
    title: 'CCW EOFY trade equipment shortlist OpenAI campaign image',
    size: '1536x1024',
    prompt: [
      'Create a premium campaign image background for Carpet Cleaners Warehouse, abbreviated CCW, for an Australian EOFY trade equipment shortlist campaign.',
      'The image should feel like a professional cleaning and restoration supplier campaign: practical, high trust, polished, trade-focused, and ready for product photography overlays.',
      'Use deep green, clean white, charcoal black, and a restrained warm yellow sale accent.',
      'Show no readable text, no invented logos, no fake product labels, no people, no brand marks, and no specific product replicas.',
      'Use abstract warehouse shelving, clean geometric panels, subtle moisture/drying cues, and clear negative space for CCW Shopify product photos to be composited later.',
    ].join(' '),
  },
  {
    id: 'ccw-eofy-final-week-finance-reminder-openai',
    title: 'CCW EOFY final week finance reminder OpenAI campaign image',
    size: '1024x1024',
    prompt: [
      'Create a square premium social campaign image background for CCW, Carpet Cleaners Warehouse, for a final week EOFY equipment planning and finance enquiry reminder.',
      'Make it suitable for Australian carpet cleaning and restoration operators reviewing equipment purchases before 30 June.',
      'Use deep green, charcoal, clean white, and small warm yellow highlights.',
      'Show no readable text, no invented logos, no fake forms, no fake finance claims, no tax wording, no people, and no product replicas.',
      'Use abstract planning-board shapes, clean trade-supplier visual language, subtle checklist geometry, and open space for real Shopify product photos and approved copy overlays.',
    ].join(' '),
  },
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeBoth(relativePath: string, content: string | Buffer) {
  for (const root of [brandRoot, docsRoot]) {
    const filePath = path.join(root, relativePath);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function generateImage(spec: ImageSpec) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: spec.prompt,
      n: 1,
      size: spec.size,
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI image generation failed ${response.status}: ${body}`
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = data.data?.[0]?.b64_json;
  if (!base64) throw new Error(`OpenAI returned no image for ${spec.id}`);

  const relativePath = path.join(generatedRoot, `${spec.id}.png`);
  writeBoth(relativePath, Buffer.from(base64, 'base64'));

  return {
    id: spec.id,
    title: spec.title,
    provider,
    model,
    size: spec.size,
    path: relativePath,
    prompt: spec.prompt,
    usage:
      'OpenAI-generated campaign support image. Use as brand/campaign background only; real product photography remains sourced from CCW Shopify.',
  };
}

async function attachCampaignAsset(manifest: Record<string, unknown>) {
  const ccw = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
    select: { id: true },
  });
  if (!ccw) throw new Error('CCW organization not found');

  const ownerEmails = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
  const owner =
    (await prisma.user.findFirst({
      where: {
        email: { in: ownerEmails },
        activeOrganizationId: ccw.id,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, email: true },
    })) ??
    (await prisma.user.findFirst({
      where: { email: { in: ownerEmails } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, email: true },
    }));
  if (!owner) throw new Error('No owner user found from OWNER_EMAILS');

  const marketingCampaign = await prisma.marketingAgencyCampaign.findFirst({
    where: {
      organizationId: ccw.id,
      slug: CCW_EOFY_CAMPAIGN_SLUG,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, metadata: true },
  });
  if (!marketingCampaign) {
    throw new Error(
      `Marketing agency campaign not found: ${CCW_EOFY_CAMPAIGN_SLUG}`
    );
  }

  const appCampaign = await prisma.campaign.findFirst({
    where: {
      organizationId: ccw.id,
      name: CCW_EOFY_CAMPAIGN_NAME,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, settings: true },
  });
  if (!appCampaign)
    throw new Error(`App campaign not found: ${CCW_EOFY_CAMPAIGN_NAME}`);

  const authorityMetadata = buildCcwEofyAuthorityMetadata({
    campaignId: appCampaign.id,
  });

  await prisma.marketingAgencyAsset.deleteMany({
    where: {
      campaignId: marketingCampaign.id,
      provider,
      providerAssetId: `${CCW_EOFY_CAMPAIGN_SLUG}-openai-generated-images`,
    },
  });

  const asset = await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      provider,
      providerAssetId: `${CCW_EOFY_CAMPAIGN_SLUG}-openai-generated-images`,
      assetType: 'openai_generated_campaign_image_set',
      title: 'CCW EOFY 2026 OpenAI generated campaign images',
      licenceStatus: 'openai_generated_campaign_support_ready_for_ccw_review',
      licenceUrl: 'https://openai.com/',
      metadata: {
        ...manifest,
        brandRoot,
        docsRoot,
        externalPublishBlocked: true,
        ...authorityMetadata,
      },
    },
  });

  await prisma.campaign.update({
    where: { id: appCampaign.id },
    data: {
      settings: {
        ...asRecord(appCampaign.settings),
        openAiGeneratedCampaignImages: {
          assetId: asset.id,
          manifest: path.join(docsRoot, manifestFile),
          imageCount: imageSpecs.length,
          provider,
          model,
          status: 'generated_ready_for_ccw_review',
        },
      },
    },
  });

  await prisma.marketingAgencyCampaign.update({
    where: { id: marketingCampaign.id },
    data: {
      metadata: {
        ...asRecord(marketingCampaign.metadata),
        openAiGeneratedCampaignImages: {
          assetId: asset.id,
          manifest: path.join(docsRoot, manifestFile),
          imageCount: imageSpecs.length,
          provider,
          model,
          status: 'generated_ready_for_ccw_review',
        },
      },
    },
  });

  return asset.id;
}

async function main() {
  ensureDir(path.join(docsRoot, generatedRoot));
  ensureDir(path.join(brandRoot, generatedRoot));

  const images = [];
  for (const spec of imageSpecs) {
    images.push(await generateImage(spec));
  }

  const manifest = {
    campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
    campaignName: CCW_EOFY_CAMPAIGN_NAME,
    generatedAt: new Date().toISOString(),
    provider,
    model,
    imageCount: images.length,
    use: 'Two explicit OpenAI-generated campaign support images requested for the CCW EOFY campaign. These are attached as campaign support images, not as product photography.',
    finalCreativeRule:
      'Real product photography remains sourced from CCW Shopify. OpenAI images are brand/campaign support backgrounds and should not imply product, finance, tax, or stock claims.',
    images,
  };

  writeBoth(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const campaignAssetId = await attachCampaignAsset(manifest);

  console.log(
    JSON.stringify(
      {
        provider,
        model,
        imageCount: images.length,
        manifest: path.join(docsRoot, manifestFile),
        imageRoot: path.join(docsRoot, generatedRoot),
        campaignAssetId,
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
