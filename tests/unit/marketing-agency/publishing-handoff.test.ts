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

const TICK = String.fromCharCode(96);
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

/** The clean control. Without it, everything below is satisfied by a renderer hardwired to complain. */
function cleanPack(): PublishingHandoffPack {
  return {
    qualityGate: {
      allowed: true,
      overallScore: 95,
      blockers: [],
      warnings: [],
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
 * structured `draftResults` PLUS the flattened `<slotId>:<code>` arrays derived
 * from them. A test that invented one without the other would not exercise the
 * shape the renderer really receives.
 */
function packWithDrafts(
  drafts: Array<Partial<PublishingHandoffDraftResult> & { slotId: string }>,
  gateLevel: { blockers?: string[]; warnings?: string[] } = {}
): PublishingHandoffPack {
  const draftResults: PublishingHandoffDraftResult[] = drafts.map(draft => ({
    slotId: draft.slotId,
    channel: draft.channel ?? 'linkedin',
    blockers: draft.blockers ?? [],
    warnings: draft.warnings ?? [],
  }));

  const pack = cleanPack();
  pack.qualityGate = {
    ...pack.qualityGate,
    draftResults,
    blockers: [
      ...(gateLevel.blockers ?? []),
      ...draftResults.flatMap(result =>
        result.blockers.map(code => `${result.slotId}:${code}`)
      ),
    ],
    warnings: [
      ...(gateLevel.warnings ?? []),
      ...draftResults.flatMap(result =>
        result.warnings.map(code => `${result.slotId}:${code}`)
      ),
    ],
  };
  pack.qualityGate.allowed = pack.qualityGate.blockers.length === 0;
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
          'quality_claim_evidence_ref_unknown:claim-7:src-99',
        ],
      }
    );
    pack.externalPublishBlocks = {
      reddit: ['platform_credentials_required', 'a_brand_new_block'],
    };

    const doc = renderPublishingHandoff(pack);

    for (const code of [
      ...pack.qualityGate.blockers,
      ...pack.externalPublishBlocks.reddit,
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
    const explained = explainCode('quality_claim_evidence_missing:claim-7');

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
    const explained = explainCode(
      'quality_claim_evidence_ref_unknown:claim-7:src-99'
    );

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
      'quality_claim_evidence_missing'
    );

    expect(explained.slot).toBe('quality_claim_evidence_missing');
    expect(explained.meaning).toBe('The copy is dense with AI-slop phrasing.');
    expect(explained.meaning).not.toContain('claim evidence');
  });

  it('is not confused by a slot id containing a colon', () => {
    const explained = explainCode('draft_slop_density_too_high', 'odd:slot:id');

    expect(explained.slot).toBe('odd:slot:id');
    expect(explained.recognised).toBe(true);
  });

  it('reads the real threshold out of a dynamic code', () => {
    expect(explainCode('draft_humanness_below_60', 'slot-1').meaning).toBe(
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
    expect(inlineCode('   ')).toBe(
      TICK + '(whitespace-only code, 3 characters)' + TICK
    );
  });

  it('names an empty value rather than emitting an unrenderable empty span', () => {
    expect(inlineCode('')).toBe(TICK + '(empty code)' + TICK);
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
