/**
 * SYN-MCP-007 (SYN-1084) — scope-filtered registration semantics.
 *
 * Covered-by is exact: '*' ∈ scopes → all tools; else tool.scope ∈ scopes;
 * empty/absent scopes → ZERO tools (DB keys default scopes [] — deny by
 * default). Legacy env-map callers get ['*'] and must keep seeing all 8
 * creative tools byte-identical.
 */

// --- mock the heavy transitive imports of the studio-tools registry ---
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn(),
}));
jest.mock('@/lib/video/social-derivation', () => ({
  deriveSocialCut: jest.fn(),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: jest.fn(),
}));
jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: jest.fn(),
}));
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {},
}));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));

import {
  ALL_MCP_TOOLS,
  STUDIO_TOOLS,
  isScopeCovered,
  toolsForScopes,
} from '@/lib/services/ai/studio-tools';

const LEGACY_CREATIVE_NAMES = [
  'derive_cuts',
  'draft_caption',
  'generate_image',
  'generate_video',
  'get_job',
  'list_cards',
  'list_jobs',
  'search_media_library',
];

// Creative tools added after the legacy set (still scope 'creative', draft-class)
const CREATIVE_NAMES = [...LEGACY_CREATIVE_NAMES, 'generate_site_from_gbp'];

const NEW_NAMESPACE_NAMES = [
  'approvals_list_pending',
  'approvals_get',
  'context_get_brand',
  'context_get_client_profile',
  'context_preview_layered_prompt',
  'performance_get_outcomes',
  'performance_get_scores',
  'performance_cost_report',
];

describe('isScopeCovered', () => {
  it("wildcard '*' covers every scope", () => {
    expect(isScopeCovered('creative', ['*'])).toBe(true);
    expect(isScopeCovered('approvals', ['*'])).toBe(true);
    expect(isScopeCovered('anything', ['bogus', '*'])).toBe(true);
  });

  it('exact scope membership covers, others do not', () => {
    expect(isScopeCovered('creative', ['creative'])).toBe(true);
    expect(isScopeCovered('approvals', ['creative'])).toBe(false);
    expect(isScopeCovered('context', ['approvals', 'context'])).toBe(true);
  });

  it('empty or absent scopes cover NOTHING (deny by default)', () => {
    expect(isScopeCovered('creative', [])).toBe(false);
    expect(isScopeCovered('creative', undefined)).toBe(false);
  });
});

describe('toolsForScopes (per-key tools/list contract)', () => {
  it('wildcard key sees ALL tools (creative 9 + all new namespaces)', () => {
    const names = toolsForScopes(['*']).map(t => t.name);
    expect(names.sort()).toEqual(
      [...CREATIVE_NAMES, ...NEW_NAMESPACE_NAMES].sort()
    );
    expect(names).toHaveLength(ALL_MCP_TOOLS.length);
  });

  it('legacy wildcard caller keeps the original 8 creative tools available', () => {
    // Legacy env-map keys get scopes ['*'] (app/api/mcp/auth.ts LEGACY_SCOPES)
    const names = toolsForScopes(['*']).map(t => t.name);
    for (const legacy of LEGACY_CREATIVE_NAMES) {
      expect(names).toContain(legacy);
    }
    // ...and STUDIO_TOOLS itself is exactly the creative set (legacy 8 + additive)
    expect(STUDIO_TOOLS.map(t => t.name).sort()).toEqual(
      [...CREATIVE_NAMES].sort()
    );
  });

  it('a creative-scoped key sees ONLY the 9 creative tools', () => {
    const names = toolsForScopes(['creative']).map(t => t.name);
    expect(names.sort()).toEqual([...CREATIVE_NAMES].sort());
  });

  it('an approvals-scoped key sees only the 2 approvals tools', () => {
    expect(
      toolsForScopes(['approvals'])
        .map(t => t.name)
        .sort()
    ).toEqual(['approvals_get', 'approvals_list_pending']);
  });

  it('multi-scope keys see the union of their namespaces, nothing else', () => {
    const names = toolsForScopes(['context', 'performance']).map(t => t.name);
    expect(names.sort()).toEqual(
      [
        'context_get_brand',
        'context_get_client_profile',
        'context_preview_layered_prompt',
        'performance_cost_report',
        'performance_get_outcomes',
        'performance_get_scores',
      ].sort()
    );
    for (const n of names) expect(LEGACY_CREATIVE_NAMES).not.toContain(n);
  });

  it('a zero-scope key (DB default scopes []) sees an EMPTY tools/list', () => {
    expect(toolsForScopes([])).toEqual([]);
    expect(toolsForScopes(undefined)).toEqual([]);
  });

  it('unknown scopes grant nothing', () => {
    expect(toolsForScopes(['bogus'])).toEqual([]);
    expect(toolsForScopes(['tasks'])).toEqual([]); // deferred to 007b
    expect(toolsForScopes(['research'])).toEqual([]); // lands with 006 wiring
  });

  it('zero-registration path is safe: filtering to nothing never throws', () => {
    expect(() => {
      for (const _tool of toolsForScopes([])) {
        throw new Error('should not iterate');
      }
    }).not.toThrow();
  });
});
