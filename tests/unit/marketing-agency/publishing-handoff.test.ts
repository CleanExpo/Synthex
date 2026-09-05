/**
 * Publishing handoff — the founder-readable review packet.
 *
 * WHAT THIS SUITE PROTECTS
 * ------------------------
 * A translation layer can fail in two directions and only one is dangerous:
 *
 *   - It can render a code badly. The founder sees something confusing, asks, and
 *     the catalogue gets an entry. Recoverable.
 *   - It can render a code NOWHERE, or render it as the WRONG instruction. The
 *     founder sees a clean document and publishes over a blocker, or is told to
 *     fix the wrong thing. Not recoverable.
 *
 * So the load-bearing tests are about what a founder can READ and whether it is
 * TRUE, not about what the file happens to contain.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT ASSERT
 * --------------------------------------------
 * It does not assert the catalogue covers every code the gate can emit. A test
 * that scraped `blockers.push(...)` out of the gate source would assert against a
 * copy of the thing under test and would go red the moment someone adds a check,
 * punishing the correct action. Unknown codes are designed to surface as
 * untranslated; the uncatalogued-check cases below prove that path.
 *
 * Runtime assertions only. `tests/**` is excluded from tsconfig and the repo runs
 * `isolatedModules`, so a type-level assertion in this file cannot fail.
 */

import {
  explainCode,
  explainExternalBlock,
  inlineCode,
  renderPublishingHandoff,
  shortenSlots,
  type PublishingHandoffDraftResult,
  type PublishingHandoffPack,
} from '../../../lib/marketing-agency/publishing-handoff';
import {
  evaluateCampaignQualityGate,
  type CampaignQualityDraftInput,
  type CampaignQualityIssue,
} from '../../../lib/marketing-agency/campaign-quality-gate';
import type { CampaignEvidenceManifest } from '../../../lib/marketing-agency/campaign-authority-manifest';

const TICK = String.fromCharCode(96);
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);
const BACKSLASH = String.fromCharCode(92);

/**
 * A code as a test writes one. A bare string is a code that carries no value;
 * anything with a value must be written out, so a test cannot accidentally
 * assert on a parameter the gate never actually passed separately.
 */
type IssueSpec = string | CampaignQualityIssue;

function toIssue(spec: IssueSpec): CampaignQualityIssue {
  return typeof spec === 'string' ? { code: spec, params: [] } : spec;
}

/** The clean control. Without it, everything below is satisfied by a renderer hardwired to complain. */
function cleanPack(): PublishingHandoffPack {
  return {
    qualityGate: {
      allowed: true,
      overallScore: 95,
      blockerIssues: [],
      warningIssues: [],
      draftResults: [],
      sourceSummary: {
        totalSources: 7,
        checkedSources: 7,
        officialPlatformSources: 5,
        internalPolicySources: 1,
      },
    },
    ownedMediaGate: { allowed: true },
    externalPublishBlocks: {},
  };
}

/**
 * Build a pack the way `evaluateCampaignQualityGate` actually builds one: the
 * gate's own findings, plus each draft's findings on the draft that reported
 * them. Nothing is flattened, because the renderer no longer reads a flattened
 * array — and a fixture that supplied one would be testing a shape the renderer
 * cannot see.
 */
function packWithDrafts(
  drafts: Array<{
    slotId: string;
    channel?: string;
    blockers?: IssueSpec[];
    warnings?: IssueSpec[];
  }>,
  gateLevel: { blockers?: IssueSpec[]; warnings?: IssueSpec[] } = {}
): PublishingHandoffPack {
  const draftResults: PublishingHandoffDraftResult[] = drafts.map(draft => ({
    slotId: draft.slotId,
    channel: draft.channel ?? 'linkedin',
    blockerIssues: (draft.blockers ?? []).map(toIssue),
    warningIssues: (draft.warnings ?? []).map(toIssue),
  }));

  const pack = cleanPack();
  pack.qualityGate = {
    ...pack.qualityGate,
    draftResults,
    blockerIssues: (gateLevel.blockers ?? []).map(toIssue),
    warningIssues: (gateLevel.warnings ?? []).map(toIssue),
  };
  pack.qualityGate.allowed =
    pack.qualityGate.blockerIssues.length === 0 &&
    draftResults.every(result => result.blockerIssues.length === 0);
  return pack;
}

describe('the clean control', () => {
  it('reports a passing campaign as publishable and raises nothing', () => {
    const doc = renderPublishingHandoff(cleanPack());

    expect(doc).toContain(
      'PASS — nothing in the quality gate is holding this campaign.'
    );
    expect(doc).toContain('**Blog and newsletter:** ready to publish');
    expect(doc).toContain('Nothing. The quality gate found no blockers.');
    expect(doc).toContain('Nothing waiting.');
    expect(doc).not.toContain('[untranslated code]');
  });
});

describe('the never-drop invariant', () => {
  it('renders every supplied code, recognised or not', () => {
    const pack = packWithDrafts(
      [
        {
          slotId: 'camp-03-linkedin',
          blockers: [
            'draft_humanness_below_60',
            'some_check_from_next_tuesday',
          ],
        },
      ],
      {
        blockers: [
          'quality_sources_below_6',
          {
            code: 'quality_claim_evidence_ref_unknown',
            params: ['claim-7', 'src-99'],
          },
        ],
      }
    );
    pack.externalPublishBlocks = {
      reddit: ['platform_credentials_required', 'a_brand_new_block'],
    };

    const doc = renderPublishingHandoff(pack);

    // Named explicitly rather than read back off the pack: an assertion that
    // loops over the same field the renderer read cannot notice a dropped code.
    for (const code of [
      'quality_sources_below_6',
      'quality_claim_evidence_ref_unknown:claim-7:src-99',
      'draft_humanness_below_60',
      'some_check_from_next_tuesday',
      'platform_credentials_required',
      'a_brand_new_block',
    ]) {
      expect(doc).toContain(code);
    }
  });

  it('renders an unknown code rather than dropping it, and marks it untranslated', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        {
          slotId: 'camp-01-linkedin',
          blockers: ['some_check_from_next_tuesday'],
        },
      ])
    );

    expect(doc).toContain('some_check_from_next_tuesday');
    expect(doc).toContain('[untranslated code]');
    expect(doc).toContain(
      'Ask the build agent what it means before publishing.'
    );
  });
});

describe('explainCode — the slot is given, never parsed', () => {
  it('treats a colon-bearing gate code as gate-level with its parameter intact', () => {
    const explained = explainCode('quality_claim_evidence_missing', [
      'claim-7',
    ]);

    expect(explained.recognised).toBe(true);
    expect(explained.slot).toBeUndefined();
    expect(explained.meaning).toBe(
      'Claim ' +
        TICK +
        'claim-7' +
        TICK +
        ' is made with no evidence behind it.'
    );
  });

  it('keeps both parameters of a two-parameter gate code', () => {
    const explained = explainCode('quality_claim_evidence_ref_unknown', [
      'claim-7',
      'src-99',
    ]);

    expect(explained.meaning).toBe(
      'Claim ' +
        TICK +
        'claim-7' +
        TICK +
        ' cites evidence ' +
        TICK +
        'src-99' +
        TICK +
        ', which is not in the manifest.'
    );
  });

  it('attributes a draft code to the slot it was given', () => {
    const explained = explainCode(
      'draft_slop_density_too_high',
      [],
      'camp-2026-03-linkedin'
    );

    expect(explained.recognised).toBe(true);
    expect(explained.slot).toBe('camp-2026-03-linkedin');
    expect(explained.raw).toBe(
      'camp-2026-03-linkedin:draft_slop_density_too_high'
    );
  });

  /**
   * ROUND 5 P1-2. The old code recovered the slot boundary by finding the first
   * colon in the flattened string. A slot id that happened to equal a gate-code
   * name therefore produced a string that whole-string gate matching claimed
   * first, so the document dropped the attribution and told the founder to attach
   * claim evidence when the real problem was the draft copy.
   */
  it('is not confused by a slot id that collides with a gate-code name', () => {
    const explained = explainCode(
      'draft_slop_density_too_high',
      [],
      'quality_claim_evidence_missing'
    );

    expect(explained.slot).toBe('quality_claim_evidence_missing');
    expect(explained.meaning).toBe('The copy is dense with AI-slop phrasing.');
    expect(explained.meaning).not.toContain('claim evidence');
  });

  it('is not confused by a slot id containing a colon', () => {
    const explained = explainCode(
      'draft_slop_density_too_high',
      [],
      'odd:slot:id'
    );

    expect(explained.slot).toBe('odd:slot:id');
    expect(explained.recognised).toBe(true);
  });

  it('reads the real threshold out of a dynamic code', () => {
    expect(explainCode('draft_humanness_below_60', [], 'slot-1').meaning).toBe(
      'The copy reads as machine-written — humanness scored under 60.'
    );
  });

  it('marks an unknown code unrecognised instead of throwing', () => {
    expect(explainCode('totally_unknown_code').recognised).toBe(false);
  });

  it('translates external channel blocks', () => {
    expect(
      explainExternalBlock('platform_credentials_required').recognised
    ).toBe(true);
    expect(explainExternalBlock('who_knows').recognised).toBe(false);
  });
});

describe('slot shortening', () => {
  it('strips the campaign id every slot repeats', () => {
    const shortened = shortenSlots([
      'unite-group-authority-flywheel-2026-06-11-03-linkedin',
      'unite-group-authority-flywheel-2026-06-11-04-facebook',
    ]);

    expect(
      shortened.get('unite-group-authority-flywheel-2026-06-11-03-linkedin')
    ).toBe('03-linkedin');
  });

  it('leaves a lone slot untouched', () => {
    const shortened = shortenSlots(['camp-2026-03-linkedin']);
    expect(shortened.get('camp-2026-03-linkedin')).toBe(
      'camp-2026-03-linkedin'
    );
  });

  it('leaves slots untouched when stripping would empty one', () => {
    const shortened = shortenSlots(['post-', 'post-a']);
    expect(shortened.get('post-')).toBe('post-');
  });
});

describe('grouping — the actual complaint in BACKLOG item 2', () => {
  it('renders one problem once, naming the drafts it affects', () => {
    const campaign = 'unite-group-authority-flywheel-2026-06-11';
    const channels = [
      'linkedin',
      'facebook',
      'instagram',
      'youtube_shorts',
      'reddit',
    ];
    const drafts = [3, 10, 17].flatMap(block =>
      channels.map((channel, i) => ({
        slotId: `${campaign}-${String(block + i).padStart(2, '0')}-${channel}`,
        channel,
        warnings: ['peer_data_waiting_for_oauth_or_platform_analytics'],
      }))
    );
    expect(drafts).toHaveLength(15);

    const doc = renderPublishingHandoff(packWithDrafts(drafts));
    const section = doc
      .split('## Waiting on access, not on you')[1]
      .split('##')[0];

    expect(section).toContain(
      '1. Peer benchmark data is waiting on platform analytics'
    );
    expect(section).not.toContain('2. ');
    expect(section).toContain('Affects 15 drafts');
    expect(section).toContain('03-linkedin');
    expect(section).not.toContain(`${campaign}-03-linkedin`);
  });

  it('does not merge two genuinely different problems', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        { slotId: 'camp-01', blockers: ['draft_slop_density_too_high'] },
        { slotId: 'camp-02', blockers: ['draft_peer_metrics_missing'] },
      ])
    );
    const section = doc.split('## What needs your attention')[1].split('##')[0];

    expect(section).toContain('1. ');
    expect(section).toContain('2. ');
  });
});

describe('the verdict count matches the body', () => {
  it('counts distinct problems, not raw occurrences', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        {
          slotId: 'camp-03-linkedin',
          blockers: ['draft_slop_density_too_high'],
        },
        {
          slotId: 'camp-04-facebook',
          blockers: ['draft_slop_density_too_high'],
        },
      ])
    );

    expect(doc).toContain('BLOCKED — 1 issue must be cleared first.');
    expect(doc).toContain('Affects 2 drafts');
  });

  it('counts two different problems as two', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        { slotId: 'camp-03', blockers: ['draft_slop_density_too_high'] },
        { slotId: 'camp-04', blockers: ['draft_peer_metrics_missing'] },
      ])
    );

    expect(doc).toContain('BLOCKED — 2 issues must be cleared first.');
  });

  it('names an affected draft once even if its slot reports the code twice', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        {
          slotId: 'camp-03-linkedin',
          blockers: [
            'draft_slop_density_too_high',
            'draft_slop_density_too_high',
          ],
        },
      ])
    );

    expect(doc).toContain('Affects 1 draft:');
    expect(doc).toContain('BLOCKED — 1 issue must be cleared first.');
  });

  it('groups one UNCATALOGUED check across two drafts as a single problem', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        { slotId: 'camp-01-linkedin', blockers: ['draft_new_safety_check'] },
        { slotId: 'camp-02-facebook', blockers: ['draft_new_safety_check'] },
      ])
    );

    expect(doc).toContain('BLOCKED — 1 issue must be cleared first.');
    expect(doc).toContain('Affects 2 drafts');
    expect(doc).toContain('[untranslated code]');
  });
});

describe('the verdict never contradicts the body — round 5 P1-3', () => {
  it('does not print PASS above a populated blocker list', () => {
    const pack = packWithDrafts([
      { slotId: 'camp-01', blockers: ['draft_slop_density_too_high'] },
    ]);
    // The input type permits this combination; the producer normally avoids it.
    pack.qualityGate.allowed = true;

    const doc = renderPublishingHandoff(pack);

    expect(doc).not.toContain('PASS — nothing in the quality gate');
    expect(doc).toContain('BLOCKED — 1 issue listed below.');
    expect(doc).toContain('which contradicts them');
  });

  it('does not print PASS when the gate says not allowed but lists nothing', () => {
    const pack = cleanPack();
    pack.qualityGate.allowed = false;

    const doc = renderPublishingHandoff(pack);

    expect(doc).not.toContain('PASS — nothing in the quality gate');
    expect(doc).toContain('lists no blocker');
  });
});

describe('codes are data, never markup', () => {
  function docWithBlocker(code: string): string {
    return renderPublishingHandoff(
      packWithDrafts([{ slotId: 'camp-01', blockers: [code] }])
    );
  }

  it('fences a markdown-shaped code so it cannot render as an empty link', () => {
    expect(docWithBlocker('[]()')).toContain(TICK + '[]()' + TICK);
  });

  it('fences a code that would otherwise open a heading or a list item', () => {
    expect(docWithBlocker('## Codes')).toContain(TICK + '## Codes' + TICK);
    expect(docWithBlocker('- x')).toContain(TICK + '- x' + TICK);
  });

  it('fences a channel name that carries markup', () => {
    const pack = cleanPack();
    pack.externalPublishBlocks = {
      '[x](y)': ['platform_credentials_required'],
    };

    expect(renderPublishingHandoff(pack)).toContain(TICK + '[x](y)' + TICK);
  });
});

describe('inlineCode fencing and display sanitising', () => {
  it('wraps an ordinary value in single backticks', () => {
    expect(inlineCode('draft_evidence_refs_missing')).toBe(
      TICK + 'draft_evidence_refs_missing' + TICK
    );
  });

  it('lengthens the fence so a value containing backticks cannot break out', () => {
    expect(inlineCode('a' + TICK + 'b')).toBe(
      TICK.repeat(2) + 'a' + TICK + 'b' + TICK.repeat(2)
    );
  });

  it('escapes a newline so the value cannot terminate its own code span', () => {
    expect(inlineCode('a\nb')).toBe(TICK + 'a\\nb' + TICK);
  });

  it('escapes a blank line, which would otherwise inject real markup', () => {
    const rendered = inlineCode('a\n\n## Injected');

    expect(rendered).toBe(TICK + 'a\\n\\n## Injected' + TICK);
    expect(rendered).not.toContain('\n');
  });

  /**
   * ROUND 5 P1-1. CommonMark replaces U+0000 with U+FFFD, so a value carrying a
   * NUL reached the page as a DIFFERENT value — in the source, absent from every
   * rendered node.
   */
  it('escapes a NUL byte, which Markdown would otherwise replace', () => {
    const rendered = inlineCode('null' + NUL + 'byte');

    expect(rendered).toBe(TICK + 'null\\x00byte' + TICK);
    expect(rendered).not.toContain(NUL);
  });

  it('escapes other C0 control characters', () => {
    expect(inlineCode('a' + BEL + 'b')).toBe(TICK + 'a\\x07b' + TICK);
  });

  it('names an all-whitespace code with its length', () => {
    expect(inlineCode('   ')).toBe(TICK + BACKSLASH + '(3 spaces)' + TICK);
  });

  it('names an empty value rather than emitting an unrenderable empty span', () => {
    expect(inlineCode('')).toBe(TICK + BACKSLASH + '(empty code)' + TICK);
  });

  it('preserves edge whitespace that CommonMark would otherwise strip', () => {
    expect(inlineCode(' x ')).toBe(TICK + '  x  ' + TICK);
  });

  it('does not truncate a pathologically long code', () => {
    const long = 'x'.repeat(100_000);
    expect(inlineCode(long)).toContain(long);
  });
});

describe('title prefix', () => {
  it('keeps the per-campaign title both generators previously hardcoded', () => {
    expect(renderPublishingHandoff(cleanPack())).toContain(
      '# Publishing Handoff'
    );
    expect(
      renderPublishingHandoff(cleanPack(), { titlePrefix: 'CARSI' })
    ).toContain('# CARSI Publishing Handoff');
  });
});

describe('restored — assertions the draftResults rewrite dropped', () => {
  /**
   * The rewrite at f4f29c5bb replaced this suite rather than extending it, and
   * three assertions went with it. They are restored by name so the coverage
   * that was silently lost is visible again.
   */
  it('pads when the value would touch its own fence', () => {
    // Longest backtick run inside is one, so the fence is two. Without the pad
    // the value's own leading backtick would run into the fence.
    expect(inlineCode(TICK + 'boom')).toBe(
      TICK + TICK + ' ' + TICK + 'boom' + ' ' + TICK + TICK
    );
  });

  it('marks owned media blocked', () => {
    const pack = cleanPack();
    pack.ownedMediaGate = { allowed: false };

    expect(renderPublishingHandoff(pack)).toContain(
      '**Blog and newsletter:** blocked'
    );
  });

  it('leaves a colon-free unknown code unattributed', () => {
    const explained = explainCode('totally_unknown_code');

    expect(explained.slot).toBeUndefined();
    expect(explained.recognised).toBe(false);
  });
});

describe('round 6 — no value is recovered from a code string', () => {
  /**
   * ROUND 6 P1-1. The renderer used to split the joined code on its colons to
   * recover the claim id and the evidence ref. Both are unconstrained strings,
   * so a claim id of `claim:7` rendered as claim `claim` citing evidence
   * `7:src-99` — a confidently wrong instruction at the approval point. The
   * parameters now arrive as separate fields and there is nothing to split.
   */
  it('keeps a colon-bearing claim id and evidence ref whole', () => {
    const explained = explainCode('quality_claim_evidence_ref_unknown', [
      'claim:7',
      'src:99:x',
    ]);

    expect(explained.meaning).toBe(
      'Claim ' +
        TICK +
        'claim:7' +
        TICK +
        ' cites evidence ' +
        TICK +
        'src:99:x' +
        TICK +
        ', which is not in the manifest.'
    );
    expect(explained.meaning).not.toContain('cites evidence ' + TICK + '7:');
  });

  it('renders a colon-bearing parameter into the document, fenced and whole', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([], {
        blockers: [
          {
            code: 'quality_claim_evidence_ref_unknown',
            params: ['claim:7', 'src:99:x'],
          },
        ],
      })
    );

    expect(doc).toContain(TICK + 'claim:7' + TICK);
    expect(doc).toContain(TICK + 'src:99:x' + TICK);
    // And the appendix still carries the flat form, byte for byte.
    expect(doc).toContain(
      'quality_claim_evidence_ref_unknown:claim:7:src:99:x'
    );
  });

  it('escapes a newline inside a parameter rather than letting it break the span', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([], {
        blockers: [
          {
            code: 'quality_claim_evidence_missing',
            params: ['claim\n\n## Injected'],
          },
        ],
      })
    );

    expect(doc).not.toContain('\n## Injected');
    expect(doc).toContain('Injected');
  });

  /**
   * ROUND 6 P1-2. `draftResults` became authoritative for the body while the
   * appendix still enumerated the flattened arrays, so a blocker present in one
   * and absent from the other rendered its English meaning with its raw code
   * nowhere on the page and `Codes` reading `none`.
   */
  it('shows every draft blocker in the Codes appendix, not just in the body', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        {
          slotId: 'camp-01-linkedin',
          blockers: ['draft_slop_density_too_high'],
        },
      ])
    );

    expect(doc).toContain('The copy is dense with AI-slop phrasing.');
    expect(doc).toContain(
      'blocker: ' + TICK + 'camp-01-linkedin:draft_slop_density_too_high' + TICK
    );
    expect(doc).not.toContain('- none');
  });

  /**
   * ROUND 6 P1-3. Grouping tested the slot for truthiness, so a draft whose
   * slotId is the empty string was dropped from the affected list and the count
   * disagreed with the structured input it came from.
   */
  it('counts a draft whose slotId is the empty string', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([
        { slotId: '', blockers: ['draft_slop_density_too_high'] },
      ])
    );

    expect(doc).toContain('Affects 1 draft');
  });
});

describe('round 7 — the REAL gate feeds the REAL renderer', () => {
  /**
   * ROUND 7 P1-2. Every other test in this file hand-builds the pack, so all of
   * them agree with my belief about the producer rather than with the producer.
   * Codex mutated the claim emitter to put `claim.id` and `evidenceRef` back
   * inside the code with `params` empty; the published flattened string stayed
   * BYTE-IDENTICAL and 67/67 tests still passed.
   *
   * That is not a gap a better string assertion can close. The joined form is
   * deliberately byte-stable, so no assertion on it can ever see the regression —
   * only running the real gate into the real renderer can, because the difference
   * lives entirely in the structured field.
   *
   * The values carry colons on purpose: that is the exact input the round-6 fix
   * exists to handle, and the one a re-flattening emitter gets wrong.
   */
  function manifestWithColonBearingClaim(): CampaignEvidenceManifest {
    return {
      manifestId: 'producer-to-renderer',
      topic: 'Structured issues survive the trip to the founder',
      audience: 'Australian restoration contractors',
      businessGoal: 'Prove the producer contract end to end',
      sources: [
        {
          id: 'src-platform',
          label: 'LinkedIn official posting policy',
          url: 'https://www.linkedin.com/legal/professional-community-policies',
          sourceType: 'official_platform_documentation',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'src-policy',
          label: 'Internal publication policy',
          path: 'docs/marketing/synthex-rules-v1.md',
          sourceType: 'internal_policy',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'src-regulator',
          label: 'Code Governance Committee annual report',
          url: 'https://insurancecode.org.au/',
          sourceType: 'regulator_publication',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      claims: [
        {
          // Both values carry colons. A renderer that recovers them by splitting
          // the joined code reports the wrong claim and the wrong evidence.
          id: 'claim:7',
          statement: 'A claim whose id contains the separator.',
          status: 'verified',
          evidenceRefs: ['src:99:x'],
        },
      ],
      platformOutputs: [],
      approval: { status: 'pending_review' },
    };
  }

  function renderFromRealGate(): string {
    const gate = evaluateCampaignQualityGate({
      evidenceManifest: manifestWithColonBearingClaim(),
      drafts: [],
    });
    return renderPublishingHandoff({
      qualityGate: gate,
      ownedMediaGate: { allowed: true },
      externalPublishBlocks: {},
    });
  }

  it('carries a colon-bearing claim id and evidence ref from gate to document', () => {
    const doc = renderFromRealGate();

    expect(doc).toContain(
      'Claim ' +
        TICK +
        'claim:7' +
        TICK +
        ' cites evidence ' +
        TICK +
        'src:99:x' +
        TICK +
        ', which is not in the manifest.'
    );
  });

  it('never truncates either value at the separator', () => {
    const doc = renderFromRealGate();

    // What the pre-round-6 renderer produced, and what an emitter that
    // re-flattens the values would make it produce again.
    expect(doc).not.toContain('Claim ' + TICK + 'claim' + TICK);
    expect(doc).not.toContain('cites evidence ' + TICK + '7:src:99:x' + TICK);
  });

  it('still accounts for the code in the appendix, from the real gate', () => {
    const doc = renderFromRealGate();

    expect(doc).toContain(
      'quality_claim_evidence_ref_unknown:claim:7:src:99:x'
    );
  });
});

describe('round 7 — a malformed issue degrades, it never throws', () => {
  /**
   * ROUND 7 P1-1. `meaning` indexed `params` with no check while
   * `CampaignQualityIssue` permits any `string[]` and `explainCode` defaults
   * `params` to `[]`. A type-valid call therefore threw inside `inlineCode`, so a
   * single malformed producer issue took the entire founder document down — the
   * exact opposite of the never-drop rule.
   */
  it('renders a recognised code supplied with no params instead of throwing', () => {
    const explained = explainCode('quality_claim_evidence_missing');

    expect(explained.recognised).toBe(false);
    expect(explained.meaning).toBe('quality_claim_evidence_missing');
  });

  it('renders a code supplied with too few params instead of throwing', () => {
    const explained = explainCode('quality_claim_evidence_ref_unknown', [
      'claim-7',
    ]);

    expect(explained.recognised).toBe(false);
    expect(explained.meaning).toBe(
      'quality_claim_evidence_ref_unknown:claim-7'
    );
  });

  it('still translates the same code when the params ARE supplied', () => {
    // The control. Without it, the two assertions above are satisfied by a
    // catalogue that simply stopped translating anything.
    const explained = explainCode('quality_claim_evidence_ref_unknown', [
      'claim-7',
      'src-99',
    ]);

    expect(explained.recognised).toBe(true);
  });

  it('keeps a malformed issue visible in the rendered document', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([], {
        blockers: [{ code: 'quality_claim_evidence_missing', params: [] }],
      })
    );

    expect(doc).toContain('quality_claim_evidence_missing');
    expect(doc).toContain('[untranslated code]');
  });
});

describe('round 8 — EVERY structured emitter is bound, not just one', () => {
  /**
   * ROUND 8 P1. The round-7 control bound `quality_claim_evidence_ref_unknown`
   * and passed `drafts: []`, so three of the four emitters that carry values
   * structurally were never exercised. Re-flattening any of them left the whole
   * 51-test suite green while the founder document quietly downgraded a known
   * issue to untranslated. The P1 was a quarter closed.
   *
   * Each emitter below is now bound by its own assertion through the REAL gate.
   */
  function manifestExercisingBothClaimCodes(): CampaignEvidenceManifest {
    return {
      manifestId: 'producer-to-renderer-all',
      topic: 'Every structured emitter survives the trip',
      audience: 'Australian restoration contractors',
      businessGoal: 'Bind the producer contract for all four codes',
      sources: [
        {
          id: 'src-platform',
          label: 'LinkedIn official posting policy',
          url: 'https://www.linkedin.com/legal/professional-community-policies',
          sourceType: 'official_platform_documentation',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'src-policy',
          label: 'Internal publication policy',
          path: 'docs/marketing/synthex-rules-v1.md',
          sourceType: 'internal_policy',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'src-regulator',
          label: 'Code Governance Committee annual report',
          url: 'https://insurancecode.org.au/',
          sourceType: 'regulator_publication',
          checkedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      claims: [
        {
          // Fires quality_claim_evidence_missing with a colon-bearing id.
          id: 'claim:missing:7',
          statement: 'A claim with no evidence behind it.',
          status: 'verified',
          evidenceRefs: [],
        },
        {
          // Fires quality_claim_evidence_ref_unknown, so this ONE fixture
          // exercises all four emitters that carry values structurally.
          id: 'claim:ref:9',
          statement: 'A claim citing a source that is not in the manifest.',
          status: 'verified',
          evidenceRefs: ['src:unknown:1'],
        },
      ],
      platformOutputs: [],
      approval: { status: 'pending_review' },
    };
  }

  /**
   * Fires draft_evidence_ref_unknown (colon-bearing ref) and
   * draft_media_type_expected (linkedin expects feed_image, not carousel).
   * Other blockers fire too and are harmless: each assertion below names the
   * exact sentence it is looking for.
   */
  function draftExercisingDraftCodes(): CampaignQualityDraftInput {
    return {
      slotId: 'slot:01:linkedin',
      channel: 'linkedin',
      title: 'A draft that trips the draft-level emitters',
      body: 'Short body. The score blockers it also trips are irrelevant here.',
      cta: 'Read more.',
      evidenceRefs: ['ref:with:colons'],
      assetBrief: 'Owned original artwork',
      mediaPlan: {
        mediaType: 'carousel',
        format: '1200x627 PNG',
        visualRequirement: 'Owned diagram',
        assetSourcePolicy: 'owned_licensed_original_only',
        aiDisclosureRequired: false,
        reviewChecks: [
          'rights_cleared',
          'no_identifiable_persons',
          'claims_match_sources',
        ],
      },
      peerBenchmark: {
        status: 'data_required_until_credentials',
        comparableMetrics: ['impressions'],
        benchmarkSource: 'LinkedIn native analytics',
        testMethod: 'Trailing six-post median',
      },
    };
  }

  function realGate() {
    return evaluateCampaignQualityGate({
      evidenceManifest: manifestExercisingBothClaimCodes(),
      drafts: [draftExercisingDraftCodes()],
    });
  }

  function renderAll(): string {
    return renderPublishingHandoff({
      qualityGate: realGate(),
      ownedMediaGate: { allowed: true },
      externalPublishBlocks: {},
    });
  }

  it('binds quality_claim_evidence_missing through the real gate', () => {
    expect(renderAll()).toContain(
      'Claim ' +
        TICK +
        'claim:missing:7' +
        TICK +
        ' is made with no evidence behind it.'
    );
  });

  it('binds draft_evidence_ref_unknown through the real gate', () => {
    expect(renderAll()).toContain(
      'This draft cites evidence ' +
        TICK +
        'ref:with:colons' +
        TICK +
        ', which is not in the manifest.'
    );
  });

  it('binds draft_media_type_expected through the real gate', () => {
    expect(renderAll()).toContain(
      'The media plan is the wrong type for this channel — it should be ' +
        TICK +
        'feed_image' +
        TICK +
        '.'
    );
  });

  /**
   * A shape check over the emitters THIS FIXTURE FIRES. Nothing more.
   *
   * It was first written claiming to be "future-proof" and to protect any
   * emitter added later. That was wrong and round 9 said so: it inspects only
   * the issues a fixture actually produces, so an emitter no fixture fires is
   * not covered — and re-flattening one of those left it green. It also cannot
   * see a value joined with `_` rather than `:`, which is exactly how
   * `draft_media_type_expected` joins, so only the explicit assertion above
   * catches that one.
   *
   * What it genuinely adds: a second, cheaper way to catch `:`-joining across
   * every emitter the fixture fires, without asserting that the catalogue covers
   * every code — an assertion this suite deliberately refuses to make, because
   * it would go red whenever someone correctly adds a new check. Coverage for a
   * NEW emitter comes from adding it to the fixture, not from this loop
   * noticing on its own. The four assertions below are what keep that honest:
   * if a fixture change stops firing one, this test says so instead of quietly
   * covering less.
   */
  it('never lets a fired gate emitter join a value into the code itself', () => {
    const gate = realGate();
    const every = [
      ...gate.blockerIssues,
      ...gate.warningIssues,
      ...gate.draftResults.flatMap(r => [
        ...r.blockerIssues,
        ...r.warningIssues,
      ]),
    ];

    // Non-vacuity control: the fixture must actually produce issues, or the loop
    // below passes over an empty list and proves nothing.
    expect(every.length).toBeGreaterThan(0);

    // And the emitters this claims to cover must genuinely be among them, or the
    // loop is green for the wrong reason.
    const codes = every.map(i => i.code);
    expect(codes).toContain('quality_claim_evidence_missing');
    expect(codes).toContain('quality_claim_evidence_ref_unknown');
    expect(codes).toContain('draft_evidence_ref_unknown');
    expect(codes).toContain('draft_media_type_expected');

    for (const issue of every) {
      expect(issue.code).not.toContain(':');
    }
  });
});

describe('round 9 — a value that occupies no space is still readable', () => {
  /**
   * ROUND 9 P1. `trim` does not strip zero-width and format characters and they
   * are not C0, so they passed through the display sanitiser and rendered as
   * nothing. A code of one ZERO WIDTH SPACE became an empty-looking span, and
   * `claim<ZWSP>7` was pixel-identical to `claim7` while being a DIFFERENT id.
   * The never-drop rule is about what a founder can READ, so an invisible value
   * fails it exactly as a dropped one does.
   */
  const ZWSP = String.fromCharCode(0x200b);
  const SOFT_HYPHEN = String.fromCharCode(0x00ad);

  it('escapes a zero-width space so the code cannot render as nothing', () => {
    expect(inlineCode(ZWSP)).toBe(TICK + '\\u200b' + TICK);
  });

  it('escapes a soft hyphen', () => {
    expect(inlineCode(SOFT_HYPHEN)).toBe(TICK + '\\u00ad' + TICK);
  });

  it('keeps two values that differ only by a zero-width character distinct', () => {
    expect(inlineCode('claim' + ZWSP + '7')).not.toBe(inlineCode('claim7'));
  });

  it('leaves ordinary accented text alone', () => {
    // The control. Escaping combining marks would corrupt legitimate values to
    // defend against a case that does not exist, so the fix must be scoped.
    expect(inlineCode('caf\u00e9')).toBe(TICK + 'caf\u00e9' + TICK);
  });

  it('keeps an invisible code visible in the rendered document', () => {
    const doc = renderPublishingHandoff(
      packWithDrafts([], { blockers: [{ code: ZWSP, params: [] }] })
    );

    expect(doc).toContain('\\u200b');
  });
});

describe('round 10 P2 — an escape cannot be forged and no escape class stops short', () => {
  /**
   * Three residuals from the round-10 independent review, filed as BACKLOG rows
   * 23-25 by #944 and fixed here. Each is written as the collision it produces,
   * because the rule this module enforces is that two different values must never
   * look like one — a rule an escape function breaks by being non-injective.
   *
   * No invisible character is typed into this file. Every real one is built with
   * `String.fromCodePoint` and every expected escape is written as its literal
   * text, so the file itself stays readable and greppable.
   */
  const ZWSP = String.fromCodePoint(0x200b);
  const VS17 = String.fromCodePoint(0xe0100);

  it('escapes a literal backslash, so escape text cannot forge an escape', () => {
    expect(inlineCode('claim\\u200b7')).toBe(TICK + 'claim\\\\u200b7' + TICK);
  });

  it('keeps a genuine zero-width space distinct from its literal escape text', () => {
    // The collision itself. Before the fix both rendered as the same seven characters.
    expect(inlineCode('claim' + ZWSP + '7')).not.toBe(
      inlineCode('claim\\u200b7')
    );
  });

  it('degrades a sparse params array instead of throwing', () => {
    // Length matches `paramCount`, but index 0 is a hole, so `meaning` indexed an
    // absent value and threw where a publishing decision belongs.
    const sparse = new Array<string>(1);

    expect(() =>
      explainCode('quality_claim_evidence_missing', sparse)
    ).not.toThrow();
    expect(
      explainCode('quality_claim_evidence_missing', sparse).recognised
    ).toBe(false);
  });

  it('escapes a supplementary variation selector', () => {
    expect(inlineCode(VS17)).toBe(TICK + '\\u{e0100}' + TICK);
  });

  it('leaves no unescaped supplementary variation selector in the document', () => {
    // Raw string inequality is NOT the property. Two values already differ as
    // bytes while the selector is present; what the founder needs is that the
    // difference is VISIBLE, so the assertion is on the escape reaching the page
    // and the raw character not surviving into it.
    const doc = renderPublishingHandoff(
      packWithDrafts([], { blockers: [{ code: VS17, params: [] }] })
    );

    expect(doc).toContain('\\u{e0100}');
    expect(doc).not.toContain(VS17);
  });

  it('still leaves ordinary accented text alone', () => {
    // The control, repeated for this block: a widened escape class must not
    // start corrupting legitimate values.
    expect(inlineCode('café')).toBe(TICK + 'café' + TICK);
  });
});

describe('round 11 - forDisplay is injective, and the reviewer proved it was not', () => {
  /**
   * Round-10 independent review returned FAIL on the injectivity claim. Closing
   * the literal-backslash forgery was necessary and not sufficient: the reviewer
   * ran Node probes against the transpiled module and produced a document
   * containing two DISTINCT claim ids rendered as two identical appendix lines.
   *
   * Three surviving collision classes, each asserted below:
   *   - CR, LF and CRLF all collapsed to the single escape for a line feed.
   *   - The empty sentinel was forgeable by an input of exactly its own text.
   *   - Whitespace-only values of equal length rendered identically regardless of
   *     which whitespace they were made of.
   *
   * A sentinel now opens with ONE backslash. Escaping doubles every literal
   * backslash, so no input can produce a single one - that is what makes the
   * sentinels unforgeable rather than merely unlikely.
   */
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const TAB_CHAR = String.fromCharCode(9);
  const BS = String.fromCharCode(92);

  it('keeps carriage return, line feed and CRLF distinct', () => {
    const cr = inlineCode('claim' + CR + '7');
    const lf = inlineCode('claim' + LF + '7');
    const crlf = inlineCode('claim' + CR + LF + '7');

    expect(new Set([cr, lf, crlf]).size).toBe(3);
  });

  it('escapes carriage return as its own sequence, not as a line feed', () => {
    expect(inlineCode('a' + CR + 'b')).toBe(TICK + 'a' + BS + 'rb' + TICK);
  });

  it('renders an empty code so no literal input can forge it', () => {
    expect(inlineCode('')).not.toBe(inlineCode('(empty code)'));
  });

  it('renders a whitespace-only code so no literal input can forge it', () => {
    expect(inlineCode('   ')).not.toBe(
      inlineCode('(whitespace-only code, 3 characters)')
    );
  });

  it('keeps whitespace-only values of equal length distinct by composition', () => {
    const spaces = inlineCode('   ');
    const tabs = inlineCode(TAB_CHAR + TAB_CHAR + TAB_CHAR);

    expect(spaces).not.toBe(tabs);
  });

  it('renders two distinct claim ids as two distinct appendix lines', () => {
    // The reviewer's own reproduction, as a regression. Before the fix this
    // document carried one translated issue and two identical appendix entries.
    const doc = renderPublishingHandoff(
      packWithDrafts([], {
        blockers: [
          {
            code: 'quality_claim_evidence_missing',
            params: ['claim' + CR + '7'],
          },
          {
            code: 'quality_claim_evidence_missing',
            params: ['claim' + LF + '7'],
          },
        ],
      })
    );

    expect(doc).toContain('claim' + BS + 'r7');
    expect(doc).toContain('claim' + BS + 'n7');
  });
});
