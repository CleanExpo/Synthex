import {
  resolveAdvancedTool,
  getAdvancedBreadcrumbs,
} from '@/lib/dashboard/advanced-tool-meta';

describe('resolveAdvancedTool', () => {
  it('recognises the Power Tools hub', () => {
    const ctx = resolveAdvancedTool('/dashboard/advanced');
    expect(ctx.isHub).toBe(true);
    expect(ctx.isAdvanced).toBe(true);
    expect(ctx.tool).toBeNull();
  });

  it('matches top-level advanced tools', () => {
    const ctx = resolveAdvancedTool('/dashboard/autopilot');
    expect(ctx.tool?.label).toBe('Autopilot');
    expect(ctx.section?.id).toBe('operations');
  });

  it('inherits parent tool for nested advanced routes', () => {
    const ctx = resolveAdvancedTool('/dashboard/seo/audit');
    expect(ctx.tool?.href).toBe('/dashboard/seo');
    expect(ctx.section?.id).toBe('growth');
  });

  it('returns non-advanced for basic routes', () => {
    const ctx = resolveAdvancedTool('/dashboard/content');
    expect(ctx.isAdvanced).toBe(false);
  });
});

describe('getAdvancedBreadcrumbs', () => {
  it('builds hub crumbs', () => {
    const crumbs = getAdvancedBreadcrumbs('/dashboard/advanced');
    expect(crumbs.map(c => c.label)).toEqual(['Dashboard', 'Power Tools']);
  });

  it('builds nested crumbs under an advanced tool', () => {
    const crumbs = getAdvancedBreadcrumbs('/dashboard/seo/audit');
    expect(crumbs.some(c => c.label === 'SEO')).toBe(true);
    expect(crumbs.some(c => c.label === 'Audit')).toBe(true);
    expect(crumbs.at(-1)?.current).toBe(true);
  });
});
