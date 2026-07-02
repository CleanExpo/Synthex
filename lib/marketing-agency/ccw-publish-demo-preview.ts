import path from 'node:path';

export interface CcwDemoSlotSummary {
  id: string;
  platform: string;
  scheduledAt: string;
  title: string;
  queueStatus: string;
}

export interface CcwDemoProductionExecution {
  slotId: string;
  platform: string;
  title: string;
  content: string;
  cta: string;
  hashtags: string[];
  asset?: string | null;
  gate?: string | null;
}

export interface CcwDemoManifestProduct {
  title: string;
  sku?: string | null;
  price?: string | null;
  compareAtPrice?: string | null;
  available?: boolean | null;
  url?: string | null;
  localImage?: string | null;
}

export interface CcwDemoManifestAsset {
  slotId: string;
  platform: string;
  title: string;
  png?: string | null;
  html?: string | null;
  products?: CcwDemoManifestProduct[];
}

export interface CcwDemoPreviewProduct {
  title: string;
  sku: string | null;
  price: string | null;
  compareAtPrice: string | null;
  available: boolean | null;
  url: string | null;
  imageHref: string | null;
  imageMissing: boolean;
}

export interface CcwDemoPostPreview {
  slotId: string;
  platform: string;
  scheduledAt: string;
  queueStatus: string;
  title: string;
  content: string;
  cta: string;
  hashtags: string[];
  gate: string | null;
  creativeHref: string | null;
  creativeMissing: boolean;
  creativeSource: string;
  realProductHtmlHref: string | null;
  realProductPngMissing: boolean;
  products: CcwDemoPreviewProduct[];
}

interface BuildPreviewOptions {
  slot: CcwDemoSlotSummary;
  productionExecutions: CcwDemoProductionExecution[];
  realProductAssets: CcwDemoManifestAsset[];
  materialsRoot: string;
  scratchpadDir: string;
  fileExists: (absolutePath: string) => boolean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function relativeHref(scratchpadDir: string, absolutePath: string): string {
  return path.relative(scratchpadDir, absolutePath).split(path.sep).join('/');
}

function findBySlotAndPlatform<T extends { slotId: string; platform: string }>(
  items: T[],
  slotId: string,
  platform: string
): T | undefined {
  const baseSlotId = slotId.endsWith(`-${platform}`)
    ? slotId.slice(0, -platform.length - 1)
    : slotId;
  return items.find(
    item =>
      (item.slotId === slotId || item.slotId === baseSlotId) &&
      item.platform === platform
  );
}

function optionalMaterialHref({
  materialPath,
  materialsRoot,
  scratchpadDir,
  fileExists,
}: {
  materialPath?: string | null;
  materialsRoot: string;
  scratchpadDir: string;
  fileExists: (absolutePath: string) => boolean;
}): { href: string | null; missing: boolean } {
  if (!materialPath) return { href: null, missing: false };
  const absolutePath = path.join(materialsRoot, materialPath);
  if (!fileExists(absolutePath)) return { href: null, missing: true };
  return {
    href: relativeHref(scratchpadDir, absolutePath),
    missing: false,
  };
}

export function buildCcwDemoPostPreview({
  slot,
  productionExecutions,
  realProductAssets,
  materialsRoot,
  scratchpadDir,
  fileExists,
}: BuildPreviewOptions): CcwDemoPostPreview {
  const execution = findBySlotAndPlatform(
    productionExecutions,
    slot.id,
    slot.platform
  );
  const realProductAsset = findBySlotAndPlatform(
    realProductAssets,
    slot.id,
    slot.platform
  );

  const productionCreative = optionalMaterialHref({
    materialPath: execution?.asset,
    materialsRoot,
    scratchpadDir,
    fileExists,
  });
  const realProductPng = optionalMaterialHref({
    materialPath: realProductAsset?.png,
    materialsRoot,
    scratchpadDir,
    fileExists,
  });
  const realProductHtml = optionalMaterialHref({
    materialPath: realProductAsset?.html,
    materialsRoot,
    scratchpadDir,
    fileExists,
  });

  const products = (realProductAsset?.products ?? []).map(product => {
    const image = optionalMaterialHref({
      materialPath: product.localImage,
      materialsRoot,
      scratchpadDir,
      fileExists,
    });

    return {
      title: product.title,
      sku: product.sku ?? null,
      price: product.price ?? null,
      compareAtPrice: product.compareAtPrice ?? null,
      available: product.available ?? null,
      url: product.url ?? null,
      imageHref: image.href,
      imageMissing: image.missing,
    };
  });

  return {
    slotId: slot.id,
    platform: slot.platform,
    scheduledAt: slot.scheduledAt,
    queueStatus: slot.queueStatus,
    title: execution?.title ?? realProductAsset?.title ?? slot.title,
    content: execution?.content ?? '',
    cta: execution?.cta ?? '',
    hashtags: execution?.hashtags ?? [],
    gate: execution?.gate ?? null,
    creativeHref: realProductPng.href ?? productionCreative.href,
    creativeMissing: productionCreative.missing && realProductPng.missing,
    creativeSource: realProductPng.href
      ? 'real-product PNG creative'
      : productionCreative.href
        ? 'production SVG campaign asset'
        : 'missing local creative asset',
    realProductHtmlHref: realProductHtml.href,
    realProductPngMissing: realProductPng.missing,
    products,
  };
}

function renderProduct(product: CcwDemoPreviewProduct): string {
  const price = product.price ? `$${escapeHtml(product.price)}` : 'Price not listed';
  const compareAt = product.compareAtPrice
    ? `<span class="compare">$${escapeHtml(product.compareAtPrice)}</span>`
    : '';
  const image = product.imageHref
    ? `<img src="${escapeHtml(product.imageHref)}" alt="${escapeHtml(product.title)}" />`
    : `<span class="image-missing">Image pending</span>`;
  const availability =
    product.available === null ? 'Availability not listed' : product.available ? 'Available' : 'Unavailable';

  return `<li>
    <a href="${escapeHtml(product.url ?? '#')}">
      ${image}
      <span>
        <strong>${escapeHtml(product.title)}</strong>
        <small>${escapeHtml(product.sku ?? 'No SKU')} &middot; ${price} ${compareAt} &middot; ${escapeHtml(availability)}</small>
      </span>
    </a>
  </li>`;
}

export function renderCcwDemoPostPreviewCard(
  preview: CcwDemoPostPreview
): string {
  const creative = preview.creativeHref
    ? `<img class="creative" src="${escapeHtml(preview.creativeHref)}" alt="${escapeHtml(preview.title)} creative" />`
    : `<div class="creative missing">Creative asset pending</div>`;
  const products = preview.products.length
    ? `<ul class="products">${preview.products.map(renderProduct).join('\n')}</ul>`
    : '<p class="products-empty">No product metadata attached to this slot.</p>';
  const htmlLink = preview.realProductHtmlHref
    ? `<a class="asset-link" href="${escapeHtml(preview.realProductHtmlHref)}">Open real-product HTML</a>`
    : '';

  return `<article class="post-card" data-platform="${escapeHtml(preview.platform)}">
    <div class="post-meta">
      <span class="brand-mark">CCW</span>
      <span>
        <strong>CCW Online</strong>
        <small>${escapeHtml(preview.platform)} &middot; ${escapeHtml(preview.scheduledAt.slice(0, 16).replace('T', ' '))} &middot; ${escapeHtml(preview.queueStatus)}</small>
      </span>
    </div>
    <div class="creative-frame">${creative}</div>
    <div class="post-copy">
      <h3>${escapeHtml(preview.title)}</h3>
      <p>${escapeHtml(preview.content)}</p>
      <p class="cta">${escapeHtml(preview.cta)}</p>
      <p class="hashtags">${escapeHtml(preview.hashtags.join(' '))}</p>
    </div>
    <div class="product-strip">
      ${products}
    </div>
    <footer>
      <span>${escapeHtml(preview.creativeSource)}</span>
      ${htmlLink}
      <small>${escapeHtml(preview.gate ?? 'No extra gate note.')}</small>
    </footer>
  </article>`;
}
