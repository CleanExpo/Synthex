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
// SYN-MCP-007b transitive boundaries (tasks_* / research_* modules).
jest.mock('@/lib/queue/bull-queue', () => ({
  QUEUE_NAMES: { AUTONOMOUS_TASKS: 'autonomous-tasks' },
  getQueue: jest.fn(),
  addJob: jest.fn(),
}));
jest.mock('@/lib/linear/client', () => ({ getLinearClient: jest.fn() }));
jest.mock('@/lib/evidence/retriever', () => ({
  getAvailableRetrievers: jest.fn(() => []),
}));

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
const CREATIVE_NAMES = [
  ...LEGACY_CREATIVE_NAMES,
  'generate_site_from_gbp',
  'list_reference_sets',
];

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

// SYN-MCP-007b — the formerly deferred namespaces.
const TASKS_NAMES = ['tasks_list', 'tasks_get', 'tasks_enqueue'];
const RESEARCH_NAMES = [
  'research_search',
  'research_fetch',
  'research_get_evidence_bundle',
];

// media_* — creative-scope thin clients over the Railway media-worker. Live in
// the MEDIA_TOOLS module (NOT STUDIO_TOOLS), so they widen the creative SCOPE
// without changing the STUDIO_TOOLS set asserted below.
const MEDIA_NAMES = ['media_probe', 'media_extract_frames', 'media_transcode'];

// Everything a creative-scoped key resolves to = the STUDIO_TOOLS creative set
// plus the media_* tools.
const CREATIVE_SCOPE_NAMES = [...CREATIVE_NAMES, ...MEDIA_NAMES];

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
  it('wildcard key sees ALL tools (creative 13 + all new namespaces = 27)', () => {
    const names = toolsForScopes(['*']).map(t => t.name);
    expect(names.sort()).toEqual(
      [
        ...CREATIVE_SCOPE_NAMES,
        ...NEW_NAMESPACE_NAMES,
        ...TASKS_NAMES,
        ...RESEARCH_NAMES,
      ].sort()
    );
    expect(names).toHaveLength(ALL_MCP_TOOLS.length);
    expect(names).toHaveLength(27);
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

  it('a creative-scoped key sees ONLY the 13 creative tools (10 studio + 3 media_*)', () => {
    const names = toolsForScopes(['creative']).map(t => t.name);
    expect(names.sort()).toEqual([...CREATIVE_SCOPE_NAMES].sort());
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
    expect(toolsForScopes(['nonexistent-namespace'])).toEqual([]);
  });

  it('SYN-MCP-007b: a tasks-scoped key sees exactly the 3 tasks_* tools', () => {
    expect(
      toolsForScopes(['tasks'])
        .map(t => t.name)
        .sort()
    ).toEqual([...TASKS_NAMES].sort());
  });

  it('SYN-MCP-007b: a research-scoped key sees exactly the 3 research_* tools', () => {
    expect(
      toolsForScopes(['research'])
        .map(t => t.name)
        .sort()
    ).toEqual([...RESEARCH_NAMES].sort());
  });

  it('SYN-MCP-007b: tasks/research grants never leak other namespaces', () => {
    const names = toolsForScopes(['tasks', 'research']).map(t => t.name);
    expect(names).toHaveLength(6);
    for (const n of names) {
      expect(LEGACY_CREATIVE_NAMES).not.toContain(n);
      expect(NEW_NAMESPACE_NAMES).not.toContain(n);
    }
  });

  it('zero-registration path is safe: filtering to nothing never throws', () => {
    expect(() => {
      for (const _tool of toolsForScopes([])) {
        throw new Error('should not iterate');
      }
    }).not.toThrow();
  });
});
