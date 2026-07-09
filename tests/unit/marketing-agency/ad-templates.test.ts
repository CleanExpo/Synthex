import {
  AD_TEMPLATES,
  AdTemplateError,
  buildAdGenerationRequest,
  buildRegenerateRequest,
  getAdTemplate,
  listAdTemplates,
  renderAdPrompt,
  resolveAdTemplateVariables,
  validateAdGeneration,
  type AdGenerationResult,
  type AdTemplate,
} from '@/lib/marketing-agency/artlist/ad-templates';

describe('ad template library (SYN-46)', () => {
  it('ships exactly the two specified templates', () => {
    const ids = listAdTemplates().map(t => t.id);
    expect(ids).toEqual(['3d-product-spin', 'quick-social-clip']);
  });

  it('every template is Artlist-powered, product-photo sourced, with a thumbnail and the 3 curated variables', () => {
    for (const template of AD_TEMPLATES) {
      expect(template.substrate).toBe('artlist');
      expect(template.sourceInput).toBe('product-photo');
      expect(template.thumbnailUrl).toMatch(/^\/ad-templates\/.+\.svg$/);
      const keys = template.variables.map(v => v.key).sort();
      expect(keys).toEqual(['mood', 'productName', 'style']);
      expect(template.variants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('3D Product Spin exposes an exploded/schematic variant', () => {
    const spin = getAdTemplate('3d-product-spin')!;
    expect(spin.variants.map(v => v.id)).toContain('exploded-schematic');
  });

  it('Quick Social Clip is a 5s vertical (9:16) clip', () => {
    const clip = getAdTemplate('quick-social-clip')!;
    expect(clip.durationSec).toBe(5);
    expect(clip.aspectRatio).toBe('9:16');
  });

  describe('prompt rendering', () => {
    it('substitutes product name, style and mood into every variant prompt', () => {
      for (const template of AD_TEMPLATES) {
        for (const variant of template.variants) {
          const rendered = renderAdPrompt(
            template.id,
            {
              productName: 'Aurora Speaker',
              style: 'premium',
              mood: 'confident',
            },
            variant.id
          );
          expect(rendered.prompt).toContain('Aurora Speaker');
          expect(rendered.prompt).toContain('premium');
          expect(rendered.prompt).toContain('confident');
          expect(rendered.prompt).not.toMatch(/\{\{.*\}\}/); // no unresolved placeholders
          expect(rendered.substrate).toBe('artlist');
        }
      }
    });

    it('falls back to template defaults when style/mood are omitted', () => {
      const result = resolveAdTemplateVariables(
        getAdTemplate('quick-social-clip')!,
        {
          productName: 'Trailblazer Boots',
        }
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.values.style).toBe('bold');
        expect(result.values.mood).toBe('energetic');
      }
    });

    it('throws when the required product name is missing', () => {
      expect(() => renderAdPrompt('3d-product-spin', {})).toThrow(
        AdTemplateError
      );
    });

    it('throws on an unknown template or variant', () => {
      expect(() =>
        renderAdPrompt('does-not-exist', { productName: 'x' })
      ).toThrow(AdTemplateError);
      expect(() =>
        renderAdPrompt(
          'quick-social-clip',
          { productName: 'x' },
          'exploded-schematic'
        )
      ).toThrow(AdTemplateError);
    });
  });

  describe('generation request + one-click regenerate', () => {
    it('builds a mock-mode request by default and regenerates with a fresh seed', () => {
      const req = buildAdGenerationRequest('3d-product-spin', {
        productName: 'Aurora Speaker',
      });
      expect(req.providerMode).toBe('mock');
      expect(req.attempt).toBe(1);

      const again = buildRegenerateRequest(req);
      expect(again.attempt).toBe(2);
      expect(again.prompt).toBe(req.prompt);
      expect(again.seed).not.toBe(req.seed);
    });
  });

  describe('quality validation (auto-reject poor generations)', () => {
    const good = (t: AdTemplate): AdGenerationResult => {
      const [w, h] =
        t.aspectRatio === '9:16'
          ? [1080, 1920]
          : t.aspectRatio === '16:9'
            ? [1920, 1080]
            : [1080, 1080];
      return {
        status: 'completed',
        widthPx: w,
        heightPx: h,
        durationSec: t.durationSec,
        qualityScore: 0.82,
      };
    };

    it('accepts a well-formed generation', () => {
      for (const template of AD_TEMPLATES) {
        const verdict = validateAdGeneration(template, good(template));
        expect(verdict.accepted).toBe(true);
        expect(verdict.rejectionReasons).toEqual([]);
      }
    });

    it('auto-rejects a low quality score', () => {
      const t = getAdTemplate('quick-social-clip')!;
      const verdict = validateAdGeneration(t, {
        ...good(t),
        qualityScore: 0.2,
      });
      expect(verdict.accepted).toBe(false);
      expect(verdict.rejectionReasons.join(' ')).toMatch(/qualityScore/);
    });

    it('auto-rejects a wrong aspect ratio, bad duration, empty frame and failed status', () => {
      const t = getAdTemplate('3d-product-spin')!;
      expect(
        validateAdGeneration(t, { ...good(t), widthPx: 1920, heightPx: 1080 })
          .accepted
      ).toBe(false);
      expect(
        validateAdGeneration(t, { ...good(t), durationSec: 30 }).accepted
      ).toBe(false);
      expect(
        validateAdGeneration(t, { ...good(t), widthPx: 0, heightPx: 0 })
          .accepted
      ).toBe(false);
      expect(
        validateAdGeneration(t, { ...good(t), status: 'failed' }).accepted
      ).toBe(false);
    });
  });
});
