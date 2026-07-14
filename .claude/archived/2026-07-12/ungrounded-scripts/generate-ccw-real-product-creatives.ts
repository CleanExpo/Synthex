#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
} from '../lib/marketing-agency/ccw-eofy-calendar';

const storefrontBase = 'https://ccwonline.com.au';
const brandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/EOFY-2026-Campaign-Materials';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/eofy-2026-materials'
);

const productRoot = 'assets/shopify-products';
const backgroundRoot = 'assets/ai-brand-backgrounds';
const creativeRoot = 'assets/real-product-png';
const previewRoot = 'assets/real-product-html';
const manifestFile = '09-real-shopify-product-creative-manifest.json';
const openAiImageModel = 'gpt-image-2';

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type?: string;
  type?: string;
  tags: string[];
  featured_image?: string;
  variants: Array<{
    sku: string;
    available: boolean;
    price: string | number;
    compare_at_price: string | number | null;
  }>;
  images: Array<
    | string
    | {
        src: string;
        width?: number;
        height?: number;
        position?: number;
      }
  >;
};

type CreativeProduct = {
  title: string;
  handle: string;
  url: string;
  vendor: string;
  sku: string;
  available: boolean;
  price: string;
  compareAtPrice: string | null;
  imageUrl: string;
  localImage: string;
};

type PlatformSize = {
  width: number;
  height: number;
  backgroundKey: 'square' | 'portrait' | 'landscape';
};

const platformSizes: Record<string, PlatformSize> = {
  linkedin: { width: 1200, height: 627, backgroundKey: 'landscape' },
  facebook: { width: 1080, height: 1080, backgroundKey: 'square' },
  instagram: { width: 1080, height: 1350, backgroundKey: 'portrait' },
  reddit: { width: 1080, height: 1080, backgroundKey: 'square' },
};

const sourceHandles = [
  'dry-air-gale-force-axial-airmover',
  'xpower-low-profile-airmover',
  'dri-eaz-velo-low-profile-air-mover',
  'razorback-aam-pro-axial-air-mover',
  'protimeter-mini-hygrostick-certified-5pack-bld4755-5',
  'powerclean-bioclenz-ultra-1kg-unstocked-add',
  'actichem-solv-sealer-gold-5ltr',
  'actichem-windowgleam-15-ltr-add',
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

function rel(...parts: string[]) {
  return path.join(...parts);
}

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function money(value: string | null) {
  if (!value) return null;
  return `$${Number(value).toFixed(2)}`;
}

function normalizeMoney(value: string | number | null) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 999 ? (numeric / 100).toFixed(2) : numeric.toFixed(2);
}

function normalizeImageUrl(value: ShopifyProduct['images'][number] | string) {
  const raw = typeof value === 'string' ? value : value.src;
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchProduct(handle: string): Promise<ShopifyProduct> {
  return fetchJson<ShopifyProduct>(`${storefrontBase}/products/${handle}.js`);
}

async function download(url: string, relativePath: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Download failed ${response.status}: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeBoth(relativePath, buffer);
}

function normalizeProduct(product: ShopifyProduct): CreativeProduct {
  const variant = product.variants[0];
  const image = normalizeImageUrl(
    product.images[0] ?? product.featured_image ?? ''
  );
  if (!variant) throw new Error(`Product has no variants: ${product.handle}`);
  if (!image) throw new Error(`Product has no images: ${product.handle}`);
  const extension = new URL(image).pathname.split('.').pop() ?? 'jpg';
  const localImage = rel(
    productRoot,
    `${slug(product.handle)}.${extension.replace(/[^a-z0-9]/gi, '')}`
  );

  return {
    title: product.title,
    handle: product.handle,
    url: `${storefrontBase}/products/${product.handle}`,
    vendor: product.vendor,
    sku: variant.sku,
    available: variant.available,
    price: normalizeMoney(variant.price) ?? '0.00',
    compareAtPrice: normalizeMoney(variant.compare_at_price),
    imageUrl: image,
    localImage,
  };
}

function chooseProducts(slotTitle: string, products: CreativeProduct[]) {
  const title = slotTitle.toLowerCase();
  const byHandle = new Map(products.map(product => [product.handle, product]));
  const selected: CreativeProduct[] = [];
  const add = (handle: string) => {
    const product = byHandle.get(handle);
    if (product && !selected.some(item => item.handle === handle)) {
      selected.push(product);
    }
  };

  if (title.includes('xpower') || title.includes('low-profile')) {
    add('xpower-low-profile-airmover');
    add('dri-eaz-velo-low-profile-air-mover');
  } else if (title.includes('gale force')) {
    add('dry-air-gale-force-axial-airmover');
  } else if (title.includes('razorback')) {
    add('razorback-aam-pro-axial-air-mover');
  } else if (title.includes('finance') || title.includes('final')) {
    add('dry-air-gale-force-axial-airmover');
    add('xpower-low-profile-airmover');
    add('razorback-aam-pro-axial-air-mover');
  } else if (title.includes('consumables')) {
    add('powerclean-bioclenz-ultra-1kg-unstocked-add');
    add('actichem-solv-sealer-gold-5ltr');
    add('actichem-windowgleam-15-ltr-add');
  } else if (title.includes('drying')) {
    add('dry-air-gale-force-axial-airmover');
    add('dri-eaz-velo-low-profile-air-mover');
    add('razorback-aam-pro-axial-air-mover');
  } else if (title.includes('moisture')) {
    add('protimeter-mini-hygrostick-certified-5pack-bld4755-5');
  }

  if (selected.length === 0) {
    add('dry-air-gale-force-axial-airmover');
    add('xpower-low-profile-airmover');
    add('protimeter-mini-hygrostick-certified-5pack-bld4755-5');
  }

  return selected.slice(0, 3);
}

async function generateOpenAiBackground(
  key: string,
  size: '1024x1024' | '1536x1024' | '1024x1536'
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const prompt = [
    'Create a premium Australian trade equipment EOFY sale campaign background for CCW.',
    'No products, no tools, no fake objects, no people.',
    'Use deep green, white, black, and warm sale accent colours.',
    'Make it polished, modern, high-contrast, and suitable for product photos to be placed on top later.',
    'Leave clear negative space for real Shopify product photography and crisp text overlays.',
    'Do not invent logos. Do not include distorted text.',
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openAiImageModel,
      prompt,
      n: 1,
      size,
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI background failed ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const base64 = data.data?.[0]?.b64_json;
  if (!base64) throw new Error(`OpenAI returned no image for ${key}`);

  writeBoth(rel(backgroundRoot, `${key}.png`), Buffer.from(base64, 'base64'));
  return { provider: 'openai', model: openAiImageModel };
}

async function generateGeminiBackground(key: string) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  'Create a premium Australian trade equipment EOFY sale campaign background for CCW.',
                  'No products, no tools, no fake objects, no people.',
                  'Use deep green, white, black, and warm sale accent colours.',
                  'Leave clear negative space for real Shopify product photography and text overlays.',
                  'Do not invent logos. Do not include distorted text.',
                ].join(' '),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini background failed ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string } }> };
    }>;
  };
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    part => part.inlineData?.data
  );
  const base64 = imagePart?.inlineData?.data;
  if (!base64) throw new Error(`Gemini returned no image for ${key}`);

  writeBoth(rel(backgroundRoot, `${key}.png`), Buffer.from(base64, 'base64'));
  return { provider: 'google', model: 'gemini-3-pro-image-preview' };
}

async function ensureBackgrounds() {
  const configs = [
    { key: 'square', size: '1024x1024' as const },
    { key: 'portrait', size: '1024x1536' as const },
    { key: 'landscape', size: '1536x1024' as const },
  ];
  const results: Record<string, { provider: string; model: string }> = {};

  for (const config of configs) {
    const existing = path.join(docsRoot, backgroundRoot, `${config.key}.png`);
    if (fs.existsSync(existing)) {
      results[config.key] = {
        provider: 'google',
        model: 'gemini-3-pro-image-preview',
      };
      continue;
    }
    try {
      results[config.key] = await generateOpenAiBackground(
        config.key,
        config.size
      );
    } catch (openAiError) {
      console.warn(
        `[ccw-real-products] OpenAI background failed for ${config.key}; trying Nano Banana Pro.`
      );
      results[config.key] = await generateGeminiBackground(config.key).catch(
        geminiError => {
          throw new Error(
            `AI background generation failed for ${config.key}: ${String(
              openAiError
            )}; ${String(geminiError)}`
          );
        }
      );
    }
  }

  return results;
}

function productCards(products: CreativeProduct[], docsAssetRoot: string) {
  return products
    .map((product, index) => {
      const currentPrice = money(product.price);
      const comparePrice = money(product.compareAtPrice);
      const imageUrl = pathToFileURL(
        path.join(docsAssetRoot, product.localImage)
      ).href;
      return `<div class="product-card product-${index}">
  <img src="${imageUrl}" alt="${htmlEscape(product.title)}" />
  <div class="product-meta">
    <strong>${htmlEscape(product.title)}</strong>
    <span>${htmlEscape(product.sku || product.vendor)}</span>
    <span>${currentPrice ?? ''}${
      comparePrice ? ` <em>was ${comparePrice}</em>` : ''
    }</span>
  </div>
</div>`;
    })
    .join('\n');
}

function renderHtml(
  execution: {
    slotId: string;
    date: string;
    platform: string;
    title: string;
    objective: string;
    cta: string;
  },
  products: CreativeProduct[],
  size: PlatformSize,
  backgroundPath: string,
  docsAssetRoot: string
) {
  const bg = pathToFileURL(path.join(docsAssetRoot, backgroundPath)).href;
  const isPortrait = size.height > size.width;
  const isLandscape = size.width > size.height;
  const titleSize = isLandscape ? 58 : isPortrait ? 64 : 62;
  const productBottom = isLandscape ? 38 : isPortrait ? 170 : 148;
  const productHeight = isLandscape ? 500 : isPortrait ? 500 : 420;
  const productImageHeight = isLandscape ? 245 : isPortrait ? 240 : 220;
  const productWidth = isLandscape ? '520px' : isPortrait ? '760px' : '760px';
  const ctaWidth = isLandscape ? '540px' : 'calc(100% - 128px)';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; width: ${size.width}px; height: ${size.height}px; overflow: hidden; font-family: Inter, Arial, sans-serif; background: #0b1411; }
      .frame { position: relative; width: ${size.width}px; height: ${size.height}px; background-image: linear-gradient(90deg, rgba(7,20,15,.9), rgba(7,20,15,.42)), url('${bg}'); background-size: cover; background-position: center; color: #fff; padding: ${isLandscape ? 54 : 64}px; }
      .brand { position: absolute; top: 34px; left: 44px; display: flex; align-items: center; gap: 14px; font-weight: 900; letter-spacing: .08em; }
      .mark { width: 64px; height: 64px; border-radius: 10px; background: #f3c53c; color: #0c1915; display: grid; place-items: center; font-size: 24px; font-weight: 950; }
      .eyebrow { margin-top: ${isLandscape ? 74 : 96}px; font-size: ${isLandscape ? 24 : 28}px; font-weight: 900; color: #f5d05c; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 16px 0 0; max-width: ${isLandscape ? 560 : 760}px; font-size: ${titleSize}px; line-height: .95; letter-spacing: 0; text-transform: uppercase; }
      .body { margin-top: 22px; max-width: ${isLandscape ? 520 : 700}px; font-size: ${isLandscape ? 24 : 30}px; line-height: 1.15; color: rgba(255,255,255,.86); font-weight: 650; }
      .cta { position: absolute; left: ${isLandscape ? 54 : 64}px; bottom: ${isLandscape ? 50 : 44}px; width: ${ctaWidth}; max-width: ${ctaWidth}; background: #f3c53c; color: #0d1915; font-size: ${isLandscape ? 22 : 28}px; font-weight: 900; padding: 18px 22px; border-radius: 8px; z-index: 3; }
      .products { position: absolute; right: ${isLandscape ? 44 : 48}px; bottom: ${productBottom}px; width: ${productWidth}; height: ${productHeight}px; display: flex; align-items: flex-end; justify-content: flex-end; gap: 18px; }
      .product-card { background: rgba(255,255,255,.96); color: #101917; border-radius: 10px; box-shadow: 0 24px 70px rgba(0,0,0,.36); padding: 16px; width: ${products.length > 2 ? '31%' : '46%'}; min-width: 0; }
      .product-card img { width: 100%; height: ${productImageHeight}px; object-fit: contain; display: block; }
      .product-meta { border-top: 2px solid #e8ebe8; padding-top: 10px; display: grid; gap: 5px; }
      .product-meta strong { font-size: ${isLandscape ? 15 : 18}px; line-height: 1.08; }
      .product-meta span { font-size: ${isLandscape ? 14 : 17}px; font-weight: 800; color: #305046; }
      .product-meta em { color: #7a2d20; font-style: normal; text-decoration: line-through; }
      .proof { position: absolute; right: 40px; top: 32px; font-size: 15px; color: rgba(255,255,255,.7); font-weight: 700; }
    </style>
  </head>
  <body>
    <section class="frame">
      <div class="brand"><div class="mark">CCW</div><div>CARPET CLEANERS WAREHOUSE</div></div>
      <div class="proof">Real Shopify product images</div>
      <div class="eyebrow">EOFY SALE SHORTLIST</div>
      <h1>${htmlEscape(execution.title)}</h1>
      <p class="body">${htmlEscape(execution.objective)}</p>
      <div class="products">${productCards(products, docsAssetRoot)}</div>
      <div class="cta">${htmlEscape(execution.cta)}</div>
    </section>
  </body>
</html>`;
}

async function renderPngs(
  products: CreativeProduct[],
  backgroundResults: Record<string, { provider: string; model: string }>
) {
  const browser = await chromium.launch({ headless: true });
  const docsAssetRoot = docsRoot;
  const executions = ccwEofyCampaignCalendar.flatMap(slot =>
    slot.platforms.map(platform => ({
      slotId: slot.id,
      date: slot.date,
      platform,
      title: slot.title,
      objective: slot.objective,
      cta: slot.cta,
    }))
  );
  const assets = [];

  try {
    for (const execution of executions) {
      const size = platformSizes[execution.platform] ?? platformSizes.facebook;
      const selectedProducts = chooseProducts(execution.title, products);
      const fileBase = `${execution.date}-${execution.platform}-${slug(
        execution.title
      )}`;
      const htmlRelative = rel(previewRoot, `${fileBase}.html`);
      const pngRelative = rel(creativeRoot, `${fileBase}.png`);
      const backgroundRelative = rel(
        backgroundRoot,
        `${size.backgroundKey}.png`
      );
      const html = renderHtml(
        execution,
        selectedProducts,
        size,
        backgroundRelative,
        docsAssetRoot
      );
      writeBoth(htmlRelative, html);

      const page = await browser.newPage({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
      });
      await page.goto(pathToFileURL(path.join(docsRoot, htmlRelative)).href, {
        waitUntil: 'networkidle',
      });
      await page.screenshot({
        path: path.join(docsRoot, pngRelative),
        fullPage: false,
      });
      fs.copyFileSync(
        path.join(docsRoot, pngRelative),
        path.join(brandRoot, pngRelative)
      );
      await page.close();

      assets.push({
        id: fileBase,
        slotId: execution.slotId,
        date: execution.date,
        platform: execution.platform,
        title: execution.title,
        png: pngRelative,
        html: htmlRelative,
        width: size.width,
        height: size.height,
        background: {
          path: backgroundRelative,
          ...backgroundResults[size.backgroundKey],
        },
        products: selectedProducts.map(product => ({
          title: product.title,
          handle: product.handle,
          url: product.url,
          sku: product.sku,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          available: product.available,
          imageUrl: product.imageUrl,
          localImage: product.localImage,
        })),
      });
    }
  } finally {
    await browser.close();
  }

  return assets;
}

async function main() {
  ensureDir(brandRoot);
  ensureDir(docsRoot);
  for (const root of [brandRoot, docsRoot]) {
    ensureDir(path.join(root, productRoot));
    ensureDir(path.join(root, backgroundRoot));
    ensureDir(path.join(root, creativeRoot));
    ensureDir(path.join(root, previewRoot));
  }

  const shopifyProducts = await Promise.all(sourceHandles.map(fetchProduct));
  const products = shopifyProducts.map(normalizeProduct);
  for (const product of products) {
    await download(product.imageUrl, product.localImage);
  }

  const backgroundResults = await ensureBackgrounds();
  const assets = await renderPngs(products, backgroundResults);

  const manifest = {
    campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
    campaignName: CCW_EOFY_CAMPAIGN_NAME,
    generatedAt: new Date().toISOString(),
    productSource: 'ccwonline.com.au Shopify storefront JSON and CDN images',
    productSourceUrls: sourceHandles.map(
      handle => `${storefrontBase}/products/${handle}.js`
    ),
    productCount: products.length,
    platformExecutions: assets.length,
    aiBackgroundModels: backgroundResults,
    finalCreativeRule:
      'Final PNG assets use real Shopify product photos. AI is used only for branded background templates; product photos are downloaded from CCW Shopify CDN and composited unchanged.',
    products,
    assets,
  };

  writeBoth(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        products: products.length,
        assets: assets.length,
        manifest: path.join(docsRoot, manifestFile),
        creativeRoot: path.join(docsRoot, creativeRoot),
        aiBackgroundModels: backgroundResults,
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
