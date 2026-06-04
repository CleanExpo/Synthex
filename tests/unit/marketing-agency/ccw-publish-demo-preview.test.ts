import {
  buildCcwDemoPostPreview,
  renderCcwDemoPostPreviewCard,
  type CcwDemoManifestAsset,
  type CcwDemoProductionExecution,
} from '@/lib/marketing-agency/ccw-publish-demo-preview';

describe('CCW publish demo post preview', () => {
  const productionExecution: CcwDemoProductionExecution = {
    slotId: 'ccw-eofy-2026-06-03-facebook-launch',
    platform: 'facebook',
    title: 'EOFY shortlist launch',
    content: 'EOFY is the practical time to tighten up the gear that matters.',
    cta: 'Build your EOFY equipment shortlist with CCW.',
    hashtags: ['#EOFY', '#CCW'],
    asset: 'assets/svg/2026-06-03-facebook-eofy-shortlist-launch.svg',
    gate: 'Use current CCW range and listed sale pricing only.',
  };

  const realProductAsset: CcwDemoManifestAsset = {
    slotId: 'ccw-eofy-2026-06-03-facebook-launch',
    platform: 'facebook',
    title: 'EOFY shortlist launch',
    html: 'assets/real-product-html/2026-06-03-facebook-eofy-shortlist-launch.html',
    png: 'assets/real-product-png/2026-06-03-facebook-eofy-shortlist-launch.png',
    products: [
      {
        title: 'Dry Air Technology Gale Force Axial Air Mover',
        sku: 'DAT-AF-01T-E1B20339',
        price: '623.04',
        compareAtPrice: null,
        available: true,
        url: 'https://ccwonline.com.au/products/dry-air-gale-force-axial-airmover',
        localImage: 'assets/shopify-products/dry-air-gale-force-axial-airmover.jpg',
      },
    ],
  };

  it('builds a visual preview with campaign creative and real product metadata', () => {
    const preview = buildCcwDemoPostPreview({
      slot: {
        id: 'ccw-eofy-2026-06-03-facebook-launch-facebook',
        platform: 'facebook',
        scheduledAt: '2026-06-03T06:00:00.000Z',
        title: 'Calendar title',
        queueStatus: 'pending',
      },
      productionExecutions: [productionExecution],
      realProductAssets: [realProductAsset],
      materialsRoot: '/repo/docs/marketing-agency/ccw/eofy-2026-materials',
      scratchpadDir: '/repo/.claude/scratchpad',
      fileExists: assetPath =>
        assetPath.endsWith('eofy-shortlist-launch.svg') ||
        assetPath.endsWith('dry-air-gale-force-axial-airmover.jpg'),
    });

    expect(preview.title).toBe('EOFY shortlist launch');
    expect(preview.creativeHref).toBe(
      '../../docs/marketing-agency/ccw/eofy-2026-materials/assets/svg/2026-06-03-facebook-eofy-shortlist-launch.svg'
    );
    expect(preview.products[0]).toMatchObject({
      title: 'Dry Air Technology Gale Force Axial Air Mover',
      sku: 'DAT-AF-01T-E1B20339',
      price: '623.04',
      imageMissing: false,
    });
  });

  it('renders an actual post card rather than only a calendar slot', () => {
    const preview = buildCcwDemoPostPreview({
      slot: {
        id: 'ccw-eofy-2026-06-03-facebook-launch',
        platform: 'facebook',
        scheduledAt: '2026-06-03T06:00:00.000Z',
        title: 'Calendar title',
        queueStatus: 'pending',
      },
      productionExecutions: [productionExecution],
      realProductAssets: [realProductAsset],
      materialsRoot: '/repo/docs/marketing-agency/ccw/eofy-2026-materials',
      scratchpadDir: '/repo/.claude/scratchpad',
      fileExists: () => true,
    });

    const html = renderCcwDemoPostPreviewCard(preview);

    expect(html).toContain('class="post-card"');
    expect(html).toContain('class="creative"');
    expect(html).toContain('EOFY is the practical time');
    expect(html).toContain('Dry Air Technology Gale Force Axial Air Mover');
    expect(html).toContain('Use current CCW range and listed sale pricing only.');
  });
});
