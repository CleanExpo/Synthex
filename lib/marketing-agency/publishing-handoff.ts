/**
 * Publishing handoff — the founder-readable review packet.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * BACKLOG item 2: "No founder-readable review packet format exists —
 * `publishing-handoff.md` is 15 internal slugs." That was literal. The Unite
 * Group pack rendered its warnings as one comma-joined line carrying the same
 * code fifteen times, each prefixed with the full campaign id:
 *
 *   Warnings: unite-group-authority-flywheel-2026-06-11-03-linkedin:peer_data_
 *   waiting_for_oauth_or_platform_analytics, unite-group-authority-flywheel-
 *   2026-06-11-04-facebook:peer_data_waiting_for_oauth_or_platform_analytics, ...
 *
 * A founder reading that cannot tell how many distinct problems there are (one),
 * whether any of them block publishing (no), or what to do next (connect
 * platform analytics). This module answers those three questions.
 *
 * THE LOAD-BEARING RULE — translation is an ENHANCEMENT, never a FILTER
 * --------------------------------------------------------------------
 * Every code handed to this renderer is VISIBLY ACCOUNTED FOR in the rendered
 * document, whether or not the catalogue below recognises it. An unrecognised
 * code is rendered with its raw text and marked as untranslated; it is never
 * dropped, never summarised away, and never silently collapsed into a neighbour.
 * The `## Codes` appendix repeats the complete input, so the invariant is
 * checkable from the document itself and not merely asserted here.
 *
 * "Visibly accounted for" is deliberate, and it is stricter than byte-verbatim in
 * the case that matters and weaker in a case that cannot exist:
 *
 *   - STRICTER: the test is what a founder can READ, not what the file contains.
 *     A code of `[]()` interpolated bare is present in the source and renders as
 *     an empty link — invisible. Containment was the original test and it passed
 *     on exactly that document. Every value is therefore emitted as an inline
 *     code span, so code data can never act as document markup.
 *   - WEAKER, unavoidably: an EMPTY code has no visible rendering. There is no
 *     document in which the empty string is legible, so byte-verbatim output is
 *     unachievable for it rather than merely unimplemented. It is named as
 *     `(empty code)`; an all-whitespace code is named with its length. Naming the
 *     degenerate case keeps the founder informed that something was reported,
 *     which is the entire purpose. Silence would not.
 *
 * Newlines are escaped to a visible two-character sequence for the same reason: a
 * value containing a blank line cannot stay inside an inline code span at all, so
 * left raw it would break the fence and inject real markup.
 *
 * KNOWN LIMITS, recorded rather than carried silently
 * ---------------------------------------------------
 *   - Display escaping is NOT injective. A real newline and the two literal
 *     characters backslash-n render identically, as do whitespace-only values of
 *     equal length. Every occurrence still reaches the page and is still counted;
 *     what is lost is the ability to tell two such values apart by eye. The raw
 *     bytes remain in the pack the document was rendered from.
 *   - A slot id containing a colon loses its draft attribution, because the first
 *     colon is taken as the slot/code boundary. No generated slot id has this
 *     shape — they are hyphenated slugs — but the interface accepts any string, so
 *     a future producer could trip it. Such a code is still rendered in full and
 *     marked untranslated; only the "Affects" attribution is missed.
 *
 * This matters because the catalogue is a list of names, and a list of names
 * always loses to a name that was added later. A gate check added tomorrow with
 * no entry here must still reach the founder — looking wrong is recoverable,
 * going missing is not.
 */

/** The shape this renderer needs. Structural, so the pack type stays in its own module. */
export interface PublishingHandoffPack {
  qualityGate: {
    allowed: boolean;
    overallScore: number;
    blockers: string[];
    warnings: string[];
    sourceSummary: {
      totalSources: number;
      checkedSources: number;
      officialPlatformSources: number;
      internalPolicySources: number;
    };
  };
  ownedMediaGate: { allowed: boolean };
  externalPublishBlocks: Record<string, string[]>;
}

export interface ExplainedCode {
  /** The code exactly as the gate emitted it, campaign prefix and all. */
  raw: string;
  /** Draft slot the code was attributed to, when the gate prefixed one. */
  slot?: string;
  /** What went wrong, in words a founder can act on. */
  meaning: string;
  /** The next physical step, or who owns it. */
  action: string;
  /** False when no catalogue entry matched. The code is still rendered. */
  recognised: boolean;
}

interface CatalogueEntry {
  pattern: RegExp;
  /** Captures come from `pattern`, so dynamic suffixes stay specific. */
  meaning: (captures: string[]) => string;
  action: string;
}

/**
 * Gate-level codes carry no slot prefix and are matched against the WHOLE string
 * first. This ordering is load-bearing: `quality_claim_evidence_missing:claim-7`
 * split on its first colon would yield a slot of `quality_claim_evidence_missing`,
 * which is a code, not a slot. Whole-string matching first makes that impossible.
 */
const GATE_CODES: CatalogueEntry[] = [
  {
    pattern: /^quality_sources_below_(\d+)$/,
    meaning: c => `The campaign cites fewer than ${c[0]} sources.`,
    action: 'Add sources to the evidence manifest, then regenerate.',
  },
  {
    pattern: /^quality_sources_missing_checked_locator_or_type$/,
    meaning: () =>
      'At least one source is missing the locator or source-type field that marks it as checked.',
    action: 'Complete the missing fields on the flagged sources.',
  },
  {
    pattern: /^quality_official_platform_sources_missing$/,
    meaning: () =>
      'No source is official platform documentation, so platform claims rest on secondary reporting.',
    action:
      'Cite the platform’s own documentation for any platform behaviour claimed.',
  },
  {
    pattern: /^quality_internal_policy_source_missing$/,
    meaning: () => 'No internal policy source is cited.',
    action: 'Cite the internal policy this campaign operates under.',
  },
  {
    pattern: /^quality_claim_evidence_missing:(.+)$/,
    meaning: c =>
      `Claim ${inlineCode(c[0])} is made with no evidence behind it.`,
    action: 'Attach evidence to the claim, or remove the claim.',
  },
  {
    pattern: /^quality_claim_evidence_ref_unknown:([^:]+):(.+)$/,
    meaning: c =>
      `Claim ${inlineCode(c[0])} cites evidence ${inlineCode(c[1])}, which is not in the manifest.`,
    action: 'Add the missing source, or correct the reference.',
  },
  {
    pattern: /^quality_overall_score_below_(\d+)$/,
    meaning: c => `The campaign’s average draft score is under ${c[0]}.`,
    action: 'Raise the weakest drafts — the per-draft entries above name them.',
  },
];

/** Draft-level codes, matched after the `<slotId>:` prefix has been removed. */
const DRAFT_CODES: CatalogueEntry[] = [
  {
    pattern: /^draft_evidence_refs_missing$/,
    meaning: () => 'This draft cites no evidence at all.',
    action: 'Attach at least one source to the draft.',
  },
  {
    pattern: /^draft_evidence_ref_unknown:(.+)$/,
    meaning: c =>
      `This draft cites evidence ${inlineCode(c[0])}, which is not in the manifest.`,
    action: 'Add the missing source, or correct the reference.',
  },
  {
    pattern: /^draft_humanness_below_(\d+)$/,
    meaning: c =>
      `The copy reads as machine-written — humanness scored under ${c[0]}.`,
    action: 'Rewrite in the brand voice before this goes out.',
  },
  {
    pattern: /^draft_slop_density_too_high$/,
    meaning: () => 'The copy is dense with AI-slop phrasing.',
    action: 'Rewrite the flagged passages; cut filler and hedging.',
  },
  {
    pattern: /^draft_media_plan_missing$/,
    meaning: () => 'This draft has no media plan.',
    action: 'Add a media plan, or drop the draft from the campaign.',
  },
  {
    pattern: /^draft_media_type_expected_(.+)$/,
    meaning: c =>
      `The media plan is the wrong type for this channel — it should be ${inlineCode(c[0])}.`,
    action: 'Correct the media type on the draft.',
  },
  {
    pattern: /^draft_asset_policy_not_publish_safe$/,
    meaning: () => 'The asset source policy is not the publish-safe one.',
    action: 'Confirm every asset is owned, licensed or original.',
  },
  {
    pattern: /^draft_media_review_checks_insufficient$/,
    meaning: () => 'The media plan lists fewer than three review checks.',
    action: 'Add review checks until the plan has at least three.',
  },
  {
    pattern: /^draft_video_ai_disclosure_missing$/,
    meaning: () =>
      'A short-form video draft does not carry the required AI disclosure.',
    action: 'Set the AI disclosure flag before this is published.',
  },
  {
    pattern: /^draft_peer_metrics_missing$/,
    meaning: () =>
      'No comparable peer metrics are recorded for this social draft.',
    action: 'Record the peer metrics being benchmarked against.',
  },
  {
    pattern: /^draft_peer_benchmark_source_missing$/,
    meaning: () => 'The peer benchmark names no source.',
    action: 'Name where the benchmark figures came from.',
  },
  {
    pattern: /^draft_peer_test_method_missing$/,
    meaning: () => 'The peer benchmark names no test method.',
    action: 'State how the comparison was measured.',
  },
  {
    pattern: /^draft_peer_plan_not_applicable$/,
    meaning: () =>
      'The peer benchmark is marked not-applicable on a channel that requires one.',
    action:
      'Supply a peer plan, or move the draft to a channel that does not need one.',
  },
  {
    pattern: /^draft_quality_score_below_(\d+)$/,
    meaning: c => `This draft scored under ${c[0]} overall.`,
    action: 'Address the other entries for this draft; the score follows them.',
  },
  {
    pattern: /^peer_data_waiting_for_oauth_or_platform_analytics$/,
    meaning: () =>
      'Peer benchmark data is waiting on platform analytics access, not on a copy change.',
    action: 'Connect platform analytics. This does not block owned media.',
  },
];

/** Codes used by `externalPublishBlocks`, which are per-channel, not per-draft. */
const EXTERNAL_BLOCK_CODES: CatalogueEntry[] = [
  {
    pattern: /^platform_credentials_required$/,
    meaning: () => 'No publishing credentials are connected for this channel.',
    action: 'Connect the account.',
  },
  {
    pattern: /^human_or_client_approval_required$/,
    meaning: () => 'A person must approve before anything posts here.',
    action: 'Approve the drafts you want published.',
  },
  {
    pattern: /^final_asset_rights_check_required$/,
    meaning: () => 'Asset rights have not had their final check.',
    action: 'Confirm rights for every asset used on this channel.',
  },
  {
    pattern: /^subreddit_rules_and_affiliation_disclosure_required$/,
    meaning: () =>
      'Reddit additionally requires subreddit rules and an affiliation disclosure.',
    action: 'Check the target subreddit’s rules and disclose the affiliation.',
  },
];

/**
 * Render a value as a Markdown inline code span so it survives to the reader.
 *
 * WHY: string containment is the wrong altitude for the never-drop invariant.
 * A code is only genuinely present if a founder can SEE it, and Markdown decides
 * that, not the raw file. Interpolated bare, a code of []() renders as an empty
 * link and disappears from the page while still satisfying a toContain assertion.
 * Codes are data, and data must never be able to act as markup.
 *
 * Fencing follows CommonMark: one more backtick than the longest run inside the
 * value, padded with spaces when the value would otherwise touch a fence.
 */
/**
 * Reduce a value to something that is guaranteed to stay visible inside a
 * Markdown inline code span.
 *
 * Two shapes defeat fencing alone, both found by the independent reviewer's
 * attack harness:
 *
 *   - A value containing a BLANK LINE cannot live in an inline code span at all.
 *     The span terminates at the paragraph break, so `a\n\n## Injected` escapes
 *     the fence and the remainder is parsed as a real heading. Escaping newlines
 *     to a visible two-character sequence removes the vector and keeps the value
 *     legible on one line.
 *   - A value that is EMPTY or ALL WHITESPACE renders as a blank span: present in
 *     the source, invisible on the page. It is named instead, with its length, so
 *     the founder can still see that something was reported.
 *
 * The value is never truncated. Losing data is the failure this whole module
 * exists to prevent, so a pathologically long code is rendered in full.
 */
function forDisplay(value: string): string {
  if (value.length === 0) return '(empty code)';
  if (value.trim().length === 0) {
    return `(whitespace-only code, ${value.length} characters)`;
  }
  return value
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n')
    .replace(/\t/g, '\\t');
}

export function inlineCode(value: string): string {
  const shown = forDisplay(value);
  const longestRun = (shown.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0
  );
  const fence = '`'.repeat(longestRun + 1);
  // CommonMark strips ONE leading and ONE trailing space from a code span when
  // both are present. Padding both ends whenever the value would touch a fence,
  // or already carries edge whitespace, means the stripped result is the value
  // itself — so a code of ' x ' does not silently display as 'x'.
  const touchesFence =
    shown.startsWith('`') ||
    shown.endsWith('`') ||
    shown.startsWith(' ') ||
    shown.endsWith(' ');
  const pad = touchesFence ? ' ' : '';
  return `${fence}${pad}${shown}${pad}${fence}`;
}

function matchIn(
  catalogue: CatalogueEntry[],
  code: string
): { meaning: string; action: string } | null {
  for (const entry of catalogue) {
    const found = entry.pattern.exec(code);
    if (found) {
      return { meaning: entry.meaning(found.slice(1)), action: entry.action };
    }
  }
  return null;
}

const UNTRANSLATED_ACTION =
  'Not yet in the plain-English catalogue. Ask the build agent what it means before publishing.';

/**
 * Translate one gate code. Never throws and never returns null — an unknown code
 * comes back with `recognised: false` and its raw text preserved.
 */
export function explainGateCode(code: string): ExplainedCode {
  const gateLevel = matchIn(GATE_CODES, code);
  if (gateLevel) {
    return { raw: code, recognised: true, ...gateLevel };
  }

  const separator = code.indexOf(':');
  if (separator > 0) {
    const slot = code.slice(0, separator);
    const rest = code.slice(separator + 1);
    const draftLevel = matchIn(DRAFT_CODES, rest);
    if (draftLevel) {
      return { raw: code, slot, recognised: true, ...draftLevel };
    }
  }

  const unprefixed = matchIn(DRAFT_CODES, code);
  if (unprefixed) {
    return { raw: code, recognised: true, ...unprefixed };
  }

  return {
    raw: code,
    meaning: code,
    action: UNTRANSLATED_ACTION,
    recognised: false,
  };
}

export function explainExternalBlock(code: string): ExplainedCode {
  const known = matchIn(EXTERNAL_BLOCK_CODES, code);
  if (known) {
    return { raw: code, recognised: true, ...known };
  }
  return {
    raw: code,
    meaning: code,
    action: UNTRANSLATED_ACTION,
    recognised: false,
  };
}

/**
 * Drop the campaign id that every slot repeats, so `…-2026-06-11-03-linkedin`
 * reads as `03-linkedin`. Only strips on a hyphen boundary, and only when every
 * slot keeps a non-empty remainder — otherwise the slots are returned untouched.
 */
export function shortenSlots(slots: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const unique = [...new Set(slots)];
  if (unique.length < 2) {
    for (const slot of unique) result.set(slot, slot);
    return result;
  }

  let prefix = unique[0];
  for (const slot of unique.slice(1)) {
    while (prefix && !slot.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  const boundary = prefix.lastIndexOf('-');
  const trimmed = boundary > 0 ? prefix.slice(0, boundary + 1) : '';

  const usable =
    trimmed.length > 0 &&
    unique.every(slot => slot.slice(trimmed.length).length > 0);

  for (const slot of unique) {
    result.set(slot, usable ? slot.slice(trimmed.length) : slot);
  }
  return result;
}

interface GroupedIssue {
  meaning: string;
  action: string;
  recognised: boolean;
  slots: string[];
  raws: string[];
}

/** Group by meaning so one problem across fifteen drafts reads as one problem. */
function groupCodes(codes: string[]): GroupedIssue[] {
  const explained = codes.map(explainGateCode);
  const shortened = shortenSlots(
    explained
      .map(item => item.slot)
      .filter((slot): slot is string => Boolean(slot))
  );

  const groups = new Map<string, GroupedIssue>();
  for (const item of explained) {
    const key = `${item.recognised}::${item.meaning}::${item.action}`;
    const existing = groups.get(key);
    const shortSlot = item.slot
      ? (shortened.get(item.slot) ?? item.slot)
      : undefined;
    if (existing) {
      // Every raw occurrence is retained, but a slot is NAMED once: two emissions
      // of the same code from one slot are one affected draft, not two.
      if (shortSlot && !existing.slots.includes(shortSlot)) {
        existing.slots.push(shortSlot);
      }
      existing.raws.push(item.raw);
    } else {
      groups.set(key, {
        meaning: item.meaning,
        action: item.action,
        recognised: item.recognised,
        slots: shortSlot ? [shortSlot] : [],
        raws: [item.raw],
      });
    }
  }
  return [...groups.values()];
}

function renderIssue(issue: GroupedIssue, index: number): string {
  const flag = issue.recognised ? '' : ' **[untranslated code]**';
  const affected =
    issue.slots.length > 0
      ? `\n   Affects ${issue.slots.length} draft${issue.slots.length === 1 ? '' : 's'}: ${issue.slots.map(inlineCode).join(', ')}`
      : '';
  const shown = issue.recognised ? issue.meaning : inlineCode(issue.meaning);
  return `${index}. ${shown}${flag}\n   What to do: ${issue.action}${affected}`;
}

function renderSection(
  title: string,
  codes: string[],
  emptyLine: string
): string {
  if (codes.length === 0) {
    return `## ${title}\n\n${emptyLine}\n`;
  }
  const grouped = groupCodes(codes);
  const body = grouped
    .map((issue, i) => renderIssue(issue, i + 1))
    .join('\n\n');
  return `## ${title}\n\n${body}\n`;
}

function renderExternal(blocks: Record<string, string[]>): string {
  const channels = Object.entries(blocks);
  if (channels.length === 0) {
    return '## External channels\n\nNo external channels are in this campaign.\n';
  }
  const rendered = channels
    .map(([channel, codes]) => {
      const lines = codes
        .map(explainExternalBlock)
        .map(
          item =>
            `- ${item.recognised ? item.meaning : inlineCode(item.meaning)}${item.recognised ? '' : ' **[untranslated code]**'} — ${item.action}`
        )
        .join('\n');
      return `### ${inlineCode(channel)}\n\n${lines}`;
    })
    .join('\n\n');
  return `## External channels — what each still needs\n\n${rendered}\n`;
}

/**
 * The complete raw input, repeated verbatim. This is what makes the
 * never-drop-a-code rule checkable from the document rather than trusted.
 */
function renderCodeAppendix(pack: PublishingHandoffPack): string {
  const external = Object.entries(pack.externalPublishBlocks).flatMap(
    ([channel, codes]) =>
      codes.map(code => `${inlineCode(channel)}: ${inlineCode(code)}`)
  );
  const lines = [
    ...pack.qualityGate.blockers.map(code => `blocker: ${inlineCode(code)}`),
    ...pack.qualityGate.warnings.map(code => `warning: ${inlineCode(code)}`),
    ...external.map(entry => `external: ${entry}`),
  ];
  const body =
    lines.length > 0 ? lines.map(line => `- ${line}`).join('\n') : '- none';
  return `## Codes\n\nEvery code above, exactly as the gate emitted it. Nothing in this document is filtered out of this list.\n\n${body}\n`;
}

export function renderPublishingHandoff(
  pack: PublishingHandoffPack,
  options: { titlePrefix?: string } = {}
): string {
  const prefix = options.titlePrefix ? `${options.titlePrefix} ` : '';
  const gate = pack.qualityGate;
  const summary = gate.sourceSummary;

  // Count DISTINCT problems, the same way the body groups them. Counting raw
  // occurrences here said "BLOCKED — 15 issues" above a single entry reading
  // "Affects 15 drafts", which contradicts the one question this document exists
  // to answer. The verdict and the section must be derived from one grouping.
  const distinctProblems = groupCodes(gate.blockers).length;
  const verdict = gate.allowed
    ? 'PASS — nothing in the quality gate is holding this campaign.'
    : `BLOCKED — ${distinctProblems} issue${distinctProblems === 1 ? '' : 's'} must be cleared first.`;

  return `# ${prefix}Publishing Handoff

## Can I publish?

- **Quality gate:** ${verdict}
- **Blog and newsletter:** ${pack.ownedMediaGate.allowed ? 'ready to publish' : 'blocked'}
- **External social:** never publishes automatically — see the channel list below
- **Score:** ${gate.overallScore}/100
- **Sources:** ${summary.checkedSources} of ${summary.totalSources} checked · ${summary.officialPlatformSources} official platform · ${summary.internalPolicySources} internal policy

${renderSection('What needs your attention', gate.blockers, 'Nothing. The quality gate found no blockers.')}
${renderSection('Waiting on access, not on you', gate.warnings, 'Nothing waiting.')}
${renderExternal(pack.externalPublishBlocks)}
## Publish rule

No external platform post is marked as live unless there is a platform receipt, URL, or API response stored back into the campaign pack.

${renderCodeAppendix(pack)}`;
}
