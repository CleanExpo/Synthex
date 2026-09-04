/**
 * Publishing handoff — the founder-readable review packet.
 *
 * WHAT THIS SUITE PROTECTS
 * ------------------------
 * The renderer translates internal gate codes into plain English. A translation
 * layer can fail in two directions, and only one of them is dangerous:
 *
 *   - It can render a code badly. The founder sees something confusing, asks,
 *     and the catalogue gets an entry. Recoverable.
 *   - It can render a code NOWHERE. The founder sees a clean document and
 *     publishes over a blocker nobody showed them. Not recoverable.
 *
 * So the load-bearing test here is not "is every code translated" — it is
 * "does every code survive into the output". That invariant holds whether or not
 * the catalogue knows the code, which is exactly why it is the one worth locking.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT ASSERT
 * --------------------------------------------
 * It does not assert the catalogue covers every code the gate can emit. A test
 * that scraped `blockers.push(...)` out of the gate source and demanded an entry
 * for each would be asserting against a copy of the thing under test, and it
 * would go red the moment someone adds a check — punishing the correct action.
 * The design already handles that case: an unknown code renders with an
 * `[untranslated code]` marker and its raw text. `renders an unknown code rather
 * than dropping it` is the test that proves that path works.
 *
 * Runtime assertions only. `tests/**` is excluded from tsconfig and the repo runs
 * `isolatedModules`, so a type-level assertion in this file cannot fail.
 */

import {
  explainExternalBlock,
  explainGateCode,
  inlineCode,
  renderPublishingHandoff,
  shortenSlots,
  type PublishingHandoffPack,
} from '../../../lib/marketing-agency/publishing-handoff';

const TICK = String.fromCharCode(96);

/** The clean control. Without it, every assertion below is satisfied by a renderer hardwired to complain. */
function cleanPack(): PublishingHandoffPack {
  return {
    qualityGate: {
      allowed: true,
      overallScore: 95,
      blockers: [],
      warnings: [],
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

describe('publishing handoff — the clean control', () => {
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
  it('renders every supplied code verbatim, recognised or not', () => {
    const blockers = [
      'quality_sources_below_6',
      'quality_claim_evidence_ref_unknown:claim-7:src-99',
      'slot-3-linkedin:draft_humanness_below_60',
      'slot-3-linkedin:some_check_invented_next_tuesday',
    ];
    const warnings = [
      'slot-4-reddit:peer_data_waiting_for_oauth_or_platform_analytics',
    ];
    const externalPublishBlocks = {
      reddit: ['platform_credentials_required', 'a_brand_new_block'],
    };

    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers,
      warnings,
    };
    pack.externalPublishBlocks = externalPublishBlocks;

    const doc = renderPublishingHandoff(pack);

    // Each raw code must appear somewhere in the document. This is the guarantee.
    for (const code of [
      ...blockers,
      ...warnings,
      ...externalPublishBlocks.reddit,
    ]) {
      expect(doc).toContain(code);
    }
  });

  it('renders an unknown code rather than dropping it, and marks it untranslated', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers: ['some_check_invented_next_tuesday'],
    };

    const doc = renderPublishingHandoff(pack);

    expect(doc).toContain('some_check_invented_next_tuesday');
    expect(doc).toContain('[untranslated code]');
    expect(doc).toContain(
      'Ask the build agent what it means before publishing.'
    );
  });
});

describe('code parsing', () => {
  it('does not mistake a gate-level parameter for a slot id', () => {
    // Splitting on the first colon would yield slot `quality_claim_evidence_missing`.
    const explained = explainGateCode('quality_claim_evidence_missing:claim-7');

    expect(explained.recognised).toBe(true);
    expect(explained.slot).toBeUndefined();
    expect(explained.meaning).toBe(
      'Claim `claim-7` is made with no evidence behind it.'
    );
  });

  it('keeps both parameters of a two-parameter gate code', () => {
    const explained = explainGateCode(
      'quality_claim_evidence_ref_unknown:claim-7:src-99'
    );

    expect(explained.recognised).toBe(true);
    expect(explained.meaning).toBe(
      'Claim `claim-7` cites evidence `src-99`, which is not in the manifest.'
    );
  });

  it('splits the slot off a draft-level code and keeps the raw text intact', () => {
    const explained = explainGateCode(
      'campaign-2026-03-linkedin:draft_slop_density_too_high'
    );

    expect(explained.recognised).toBe(true);
    expect(explained.slot).toBe('campaign-2026-03-linkedin');
    expect(explained.raw).toBe(
      'campaign-2026-03-linkedin:draft_slop_density_too_high'
    );
  });

  it('reads the real threshold out of a dynamic code rather than saying "a threshold"', () => {
    expect(explainGateCode('slot-1:draft_humanness_below_60').meaning).toBe(
      'The copy reads as machine-written — humanness scored under 60.'
    );
    expect(
      explainGateCode('slot-1:draft_media_type_expected_feed_image').meaning
    ).toBe(
      'The media plan is the wrong type for this channel — it should be `feed_image`.'
    );
  });

  it('marks an unknown code unrecognised instead of throwing', () => {
    const explained = explainGateCode('totally_unknown_code');

    expect(explained.recognised).toBe(false);
    expect(explained.raw).toBe('totally_unknown_code');
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
    expect(
      shortened.get('unite-group-authority-flywheel-2026-06-11-04-facebook')
    ).toBe('04-facebook');
  });

  it('leaves a lone slot untouched, since there is no shared prefix to strip', () => {
    const shortened = shortenSlots(['campaign-2026-03-linkedin']);

    expect(shortened.get('campaign-2026-03-linkedin')).toBe(
      'campaign-2026-03-linkedin'
    );
  });

  it('leaves slots untouched when stripping would empty one of them', () => {
    const shortened = shortenSlots(['post-', 'post-a']);

    expect(shortened.get('post-')).toBe('post-');
    expect(shortened.get('post-a')).toBe('post-a');
  });
});

describe('grouping — the actual complaint in BACKLOG item 2', () => {
  it('renders one problem once, naming the drafts it affects', () => {
    // This is the real Unite Group shape: the SAME warning on fifteen social slots,
    // previously rendered as fifteen comma-joined copies of the same sentence.
    const campaign = 'unite-group-authority-flywheel-2026-06-11';
    const channels = [
      'linkedin',
      'facebook',
      'instagram',
      'youtube_shorts',
      'reddit',
    ];
    const warnings = [3, 10, 17].flatMap(block =>
      channels.map(
        (channel, i) =>
          `${campaign}-${String(block + i).padStart(2, '0')}-${channel}:peer_data_waiting_for_oauth_or_platform_analytics`
      )
    );
    expect(warnings).toHaveLength(15);

    const pack = cleanPack();
    pack.qualityGate = { ...pack.qualityGate, warnings };

    const doc = renderPublishingHandoff(pack);
    const waitingSection = doc
      .split('## Waiting on access, not on you')[1]
      .split('##')[0];

    // One numbered entry, not fifteen.
    expect(waitingSection).toContain(
      '1. Peer benchmark data is waiting on platform analytics'
    );
    expect(waitingSection).not.toContain('2. ');
    expect(waitingSection).toContain('Affects 15 drafts');
    // And the campaign id is stripped from the slot list that names them.
    expect(waitingSection).toContain('03-linkedin');
    expect(waitingSection).not.toContain(`${campaign}-03-linkedin`);
  });

  it('does not merge two genuinely different problems into one entry', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers: [
        'slot-1:draft_slop_density_too_high',
        'slot-2:draft_peer_metrics_missing',
      ],
    };

    const doc = renderPublishingHandoff(pack);
    const section = doc.split('## What needs your attention')[1].split('##')[0];

    expect(section).toContain('1. ');
    expect(section).toContain('2. ');
  });
});

describe('the blocked verdict', () => {
  it('says how many issues must be cleared and marks owned media blocked', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      overallScore: 40,
      blockers: ['quality_internal_policy_source_missing'],
    };
    pack.ownedMediaGate = { allowed: false };

    const doc = renderPublishingHandoff(pack);

    expect(doc).toContain('BLOCKED — 1 issue must be cleared first.');
    expect(doc).toContain('**Blog and newsletter:** blocked');
  });

  it('pluralises correctly for more than one issue', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers: [
        'quality_internal_policy_source_missing',
        'quality_sources_below_6',
      ],
    };

    expect(renderPublishingHandoff(pack)).toContain(
      'BLOCKED — 2 issues must be cleared first.'
    );
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

describe('codes are data, never markup', () => {
  /**
   * Found by independent review, and it invalidated the original invariant test.
   * toContain proves a code is in the STRING. It does not prove a founder can SEE
   * it. Interpolated bare, []() is a well-formed empty Markdown link: it renders
   * as nothing while still satisfying containment. Visibility is the property
   * that matters, so the fence is what has to be asserted.
   */
  function assertAlwaysFenced(doc: string, value: string) {
    const parts = doc.split(value);
    expect(parts.length).toBeGreaterThan(1);
    for (let i = 0; i < parts.length - 1; i += 1) {
      expect(parts[i].endsWith(TICK) || parts[i].endsWith(TICK + ' ')).toBe(
        true
      );
      expect(
        parts[i + 1].startsWith(TICK) || parts[i + 1].startsWith(' ' + TICK)
      ).toBe(true);
    }
  }

  it('fences a markdown-shaped unknown code so it cannot render as an empty link', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers: ['[]()'],
    };

    const doc = renderPublishingHandoff(pack);

    expect(doc).toContain(TICK + '[]()' + TICK);
    assertAlwaysFenced(doc, '[]()');
  });

  it('fences a code that would otherwise open a heading or a list item', () => {
    const pack = cleanPack();
    pack.qualityGate = {
      ...pack.qualityGate,
      allowed: false,
      blockers: ['## Codes', '- not a real bullet'],
    };

    const doc = renderPublishingHandoff(pack);

    expect(doc).toContain(TICK + '## Codes' + TICK);
    expect(doc).toContain(TICK + '- not a real bullet' + TICK);
  });

  it('fences a channel name that carries markup', () => {
    const pack = cleanPack();
    pack.externalPublishBlocks = {
      '[x](y)': ['platform_credentials_required'],
    };

    const doc = renderPublishingHandoff(pack);

    expect(doc).toContain(TICK + '[x](y)' + TICK);
  });
});

describe('inlineCode fencing', () => {
  it('wraps an ordinary value in single backticks', () => {
    expect(inlineCode('draft_evidence_refs_missing')).toBe(
      TICK + 'draft_evidence_refs_missing' + TICK
    );
  });

  it('lengthens the fence so a value containing backticks cannot break out', () => {
    expect(inlineCode('a' + TICK + 'b')).toBe(
      TICK.repeat(2) + 'a' + TICK + 'b' + TICK.repeat(2)
    );
    expect(inlineCode('a' + TICK.repeat(2) + 'b')).toBe(
      TICK.repeat(3) + 'a' + TICK.repeat(2) + 'b' + TICK.repeat(3)
    );
  });

  it('pads when the value would touch its own fence', () => {
    expect(inlineCode(TICK + 'lead')).toBe(
      TICK.repeat(2) + ' ' + TICK + 'lead' + ' ' + TICK.repeat(2)
    );
  });

  it('names an empty value rather than emitting an unrenderable empty span', () => {
    expect(inlineCode('')).toBe(TICK + '(empty)' + TICK);
  });
});
