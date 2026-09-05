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
 *   - Display escaping IS injective, and that is load-bearing rather than
 *     incidental: two different values must never reach the founder looking like
 *     one. It was NOT injective until round 11, when an independent reviewer
 *     rendered two distinct claim ids as two identical appendix lines. Four
 *     collision classes are closed - a literal backslash forging an escape, CR
 *     and LF and CRLF collapsing into one sequence, the degenerate-value
 *     sentinels being forgeable by an input of their own text, and whitespace
 *     that occupies space without being a space. The argument is in `forDisplay`.
 *   - Nothing here is recovered by parsing. Slot, code and every parameter
 *     arrive as separate fields from the gate, so a colon inside a slot id, a
 *     claim id or an evidence ref carries no meaning and cannot mis-attribute
 *     anything. The joined strings the gate also publishes are a view of those
 *     fields, never the source this renderer reads.
 *
 * This matters because the catalogue is a list of names, and a list of names
 * always loses to a name that was added later. A gate check added tomorrow with
 * no entry here must still reach the founder — looking wrong is recoverable,
 * going missing is not.
 */

import { joinIssue, type CampaignQualityIssue } from './campaign-quality-gate';

/**
 * The shape this renderer needs.
 *
 * It takes the STRUCTURED issues and not the gate's flattened strings. The
 * flattened arrays are deliberately absent from this interface: a renderer that
 * cannot see them cannot drift from them, which is how the body and the `## Codes`
 * appendix came to disagree in round 6. `joinIssue` is imported rather than
 * re-implemented so there is exactly one rule for how an issue reads when flat.
 */
export interface PublishingHandoffDraftResult {
  slotId: string;
  channel: string;
  blockerIssues: CampaignQualityIssue[];
  warningIssues: CampaignQualityIssue[];
}

export interface PublishingHandoffPack {
  qualityGate: {
    allowed: boolean;
    overallScore: number;
    /** Gate-level findings only. Per-draft findings live on `draftResults`. */
    blockerIssues: CampaignQualityIssue[];
    warningIssues: CampaignQualityIssue[];
    draftResults: PublishingHandoffDraftResult[];
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
  /**
   * Matched against the CODE alone. Captures are limited to digits, which are
   * part of a check's name (`..._below_75`) rather than a value it found. Any
   * value the check found arrives in `params` instead, because recovering one
   * from the code text is the guess this module no longer makes.
   */
  pattern: RegExp;
  /**
   * How many `params` this entry's `meaning` reads. Omitted means none.
   *
   * WHY THIS IS DECLARED RATHER THAN ASSUMED: `meaning` used to index `params`
   * with no check, while `CampaignQualityIssue` permits any `string[]` and
   * `explainCode` defaults `params` to `[]`. A type-valid
   * `explainCode('quality_claim_evidence_missing')` therefore threw inside
   * `inlineCode`, and one malformed producer issue took the WHOLE document down
   * — the opposite of the never-drop rule, which exists precisely so that a code
   * nobody anticipated still reaches the founder.
   *
   * A mismatch is fail-safe by construction: the entry is skipped and the code
   * renders raw and marked untranslated. Visibly wrong beats invisible, and both
   * beat a stack trace where a publishing decision should be.
   *
   * An entry that forgets to declare a count therefore reads as zero, so a code
   * carrying values falls to the same visible path rather than throwing.
   */
  paramCount?: number;
  meaning: (captures: string[], params: string[]) => string;
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
    pattern: /^quality_claim_evidence_missing$/,
    paramCount: 1,
    meaning: (_c, p) =>
      `Claim ${inlineCode(p[0])} is made with no evidence behind it.`,
    action: 'Attach evidence to the claim, or remove the claim.',
  },
  {
    pattern: /^quality_claim_evidence_ref_unknown$/,
    paramCount: 2,
    meaning: (_c, p) =>
      `Claim ${inlineCode(p[0])} cites evidence ${inlineCode(p[1])}, which is not in the manifest.`,
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
    pattern: /^draft_evidence_ref_unknown$/,
    paramCount: 1,
    meaning: (_c, p) =>
      `This draft cites evidence ${inlineCode(p[0])}, which is not in the manifest.`,
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
    pattern: /^draft_media_type_expected$/,
    paramCount: 1,
    meaning: (_c, p) =>
      `The media plan is the wrong type for this channel — it should be ${inlineCode(p[0])}.`,
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
  const shown = value
    // FIRST, before every other escape, or the escapes escape each other. A
    // value carrying the six literal characters `\u200b` used to render
    // identically to one carrying a genuine ZERO WIDTH SPACE, so two different
    // codes shared display text and a translated group.
    //
    // It is also what makes the two sentinels at the bottom unforgeable. Every
    // literal backslash becomes two, and no escape emitted below is a backslash
    // followed by an opening bracket, so an escaped value can never begin with
    // the single `\(` that a sentinel begins with.
    .replace(/\\/g, '\\\\')
    // CR, LF and CRLF are THREE different values that used to collapse into one
    // escape. The round-10 reviewer rendered `claim<CR>7` and `claim<LF>7` into
    // one document and got two identical appendix lines. Escaped separately,
    // CRLF falls out as the pair `\r\n`, distinct from either alone.
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    // Any REMAINING C0 control, NUL included. CommonMark replaces NUL with
    // U+FFFD, so a value carrying one reaches the page as a different value -
    // present in the source, absent from every rendered node.
    .replace(
      /[\u0000-\u001f\u007f]/g,
      ch => '\\x' + ch.charCodeAt(0).toString(16).padStart(2, '0')
    )
    // Characters that OCCUPY NO SPACE, plus the ones that occupy space without
    // being a space. `trim` does not remove the first group and they are not C0,
    // so before this they reached the page and rendered as nothing: a code of one
    // ZERO WIDTH SPACE became an empty-looking span, and `claim<ZWSP>7` was
    // pixel-identical to `claim7` while being a DIFFERENT claim id. Both defeat
    // the rule this module exists for - the founder must be able to READ what was
    // reported, and two different values must never look like one.
    //
    // Combining marks are deliberately NOT included: they are how ordinary
    // accented text is written, and escaping them would corrupt legitimate values
    // to defend against a case that does not exist.
    //
    // The range runs past U+FE0F to the SUPPLEMENTARY variation selectors
    // U+E0100-U+E01EF, which fall outside both the BMP range and Cf. A
    // supplementary code point is written in brace form, because `\uE0100` is not
    // an escape for U+E0100 - it is one for U+E010 followed by a zero, and a
    // founder must be able to read back what was actually reported.
    //
    // The trailing members are the space separators OTHER than U+0020. Those do
    // occupy space, so they are not invisible, but they are indistinguishable
    // from an ordinary space by eye, which is the same defect wearing a different
    // hat. Escaping them is also what lets the whitespace sentinel below name a
    // value exactly rather than by length alone.
    .replace(
      /[\p{Cf}\p{Zl}\p{Zp}\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/gu,
      ch => {
        const point = ch.codePointAt(0) ?? 0;
        return point > 0xffff
          ? '\\u{' + point.toString(16).padStart(5, '0') + '}'
          : '\\u' + point.toString(16).padStart(4, '0');
      }
    );

  // The degenerate cases come AFTER escaping, so each is built from the escaped
  // form rather than the raw value. Both begin with a single backslash, which no
  // escaped value can, so an input of a sentinel's own text renders as something
  // else and the sentinel cannot be forged.
  if (value.length === 0) return '\\(empty code)';
  // Every whitespace character except U+0020 is escaped above, so whatever
  // survives `trim` here is a run of plain spaces and its length names it
  // exactly. Previously any two whitespace-only values of equal length collided.
  if (shown.trim().length === 0) return `\\(${shown.length} spaces)`;
  return shown;
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
  code: string,
  params: string[]
): { meaning: string; action: string } | null {
  for (const entry of catalogue) {
    const found = entry.pattern.exec(code);
    if (!found) continue;
    // Arity is checked BEFORE `meaning` runs, because `meaning` indexes `params`
    // directly and an absent value would throw rather than render. The count must
    // match exactly: too few and the sentence loses a value it needs, too many and
    // the producer is sending something this entry was never written to explain.
    // Either way the honest output is the raw code, visibly marked.
    if (params.length !== (entry.paramCount ?? 0)) return null;
    // Length is not presence. `new Array(1)` has length 1 and no element 0, so a
    // length comparison alone let a hole reach `meaning`, which indexes `params`
    // directly and threw. Indexed, not `.some`/`.every`, because those SKIP holes
    // in a sparse array and would report the absent value as fine.
    for (let index = 0; index < params.length; index += 1) {
      if (typeof params[index] !== 'string') return null;
    }
    const [, ...captures] = found;
    return {
      meaning: entry.meaning(captures, params),
      action: entry.action,
    };
  }
  return null;
}

const UNTRANSLATED_ACTION =
  'Not yet in the plain-English catalogue. Ask the build agent what it means before publishing.';

/**
 * Translate one gate code. Never throws and never returns null — an unknown code
 * comes back with `recognised: false` and its raw text preserved.
 */
/**
 * Explain one code.
 *
 * WHY THIS TAKES A SLOT INSTEAD OF PARSING ONE OUT
 * ------------------------------------------------
 * It used to receive the gate's flattened `<slotId>:<code>` string and recover
 * the boundary by finding the first colon. That is guesswork, because `slotId` is
 * an unconstrained `string`. A draft whose slot id happened to equal a gate-code
 * name produced `quality_claim_evidence_missing:draft_slop_density_too_high`,
 * which whole-string gate matching claimed first — so the document dropped the
 * draft attribution and told the founder to attach claim evidence when the actual
 * problem was the copy. A confidently wrong instruction at the approval point is
 * worse than an unreadable one.
 *
 * Four consecutive review rounds each fixed one consequence of that flattening
 * and left the ambiguity itself in place. The renderer now takes the slot as a
 * separate argument, sourced from `draftResults` where the gate never joined them
 * in the first place, so there is nothing left to parse and no boundary to guess.
 *
 * A code with a slot is draft-level; a code without one is gate-level. The two
 * catalogues are never consulted for the same value.
 */
export function explainCode(
  code: string,
  params: string[] = [],
  slot?: string
): ExplainedCode {
  // The flat form is produced by the gate's own join rule, never re-parsed.
  const flat = joinIssue({ code, params });
  const raw = slot === undefined ? flat : `${slot}:${flat}`;
  const matched = matchIn(
    slot === undefined ? GATE_CODES : DRAFT_CODES,
    code,
    params
  );
  if (matched) {
    return { raw, slot, recognised: true, ...matched };
  }
  return {
    raw,
    slot,
    meaning: flat,
    action: UNTRANSLATED_ACTION,
    recognised: false,
  };
}

/** One reported problem, before explanation, with its origin still intact. */
interface StructuredIssue {
  code: string;
  params: string[];
  slot?: string;
}

/**
 * Collect every reported problem into ONE list, drafts first then gate-level.
 *
 * There is nothing to partition any more. Draft issues carry their slot because
 * they came from the draft that reported them, and gate issues have no slot
 * because the gate has no draft. The previous version reconstructed this split by
 * removing `<slot>:<code>` strings from the flattened array, which meant the body
 * and the `## Codes` appendix read different sources and could disagree — an
 * issue present structurally but absent from the flattened array rendered its
 * English meaning with its raw code nowhere on the page. Both now read this list.
 */
function collectIssues(
  gateIssues: CampaignQualityIssue[],
  draftResults: PublishingHandoffDraftResult[],
  pick: (result: PublishingHandoffDraftResult) => CampaignQualityIssue[]
): StructuredIssue[] {
  const issues: StructuredIssue[] = [];

  for (const result of draftResults) {
    for (const issue of pick(result)) {
      issues.push({
        code: issue.code,
        params: issue.params,
        slot: result.slotId,
      });
    }
  }

  for (const issue of gateIssues) {
    issues.push({ code: issue.code, params: issue.params });
  }

  return issues;
}

export function explainExternalBlock(code: string): ExplainedCode {
  // External block codes are whole-string literals and take no parameters.
  const known = matchIn(EXTERNAL_BLOCK_CODES, code, []);
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
function groupIssues(issues: StructuredIssue[]): GroupedIssue[] {
  const explained = issues.map(issue =>
    explainCode(issue.code, issue.params, issue.slot)
  );
  // `!== undefined`, never truthiness: '' is a slot the gate reported, and
  // dropping it made the affected-draft count disagree with the input.
  const shortened = shortenSlots(
    explained
      .map(item => item.slot)
      .filter((slot): slot is string => slot !== undefined)
  );

  const groups = new Map<string, GroupedIssue>();
  for (const item of explained) {
    const key = `${item.recognised}::${item.meaning}::${item.action}`;
    const existing = groups.get(key);
    const shortSlot =
      item.slot !== undefined
        ? (shortened.get(item.slot) ?? item.slot)
        : undefined;
    if (existing) {
      // Every raw occurrence is retained, but a slot is NAMED once: two emissions
      // of the same code from one slot are one affected draft, not two.
      if (shortSlot !== undefined && !existing.slots.includes(shortSlot)) {
        existing.slots.push(shortSlot);
      }
      existing.raws.push(item.raw);
    } else {
      groups.set(key, {
        meaning: item.meaning,
        action: item.action,
        recognised: item.recognised,
        slots: shortSlot !== undefined ? [shortSlot] : [],
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
  issues: StructuredIssue[],
  emptyLine: string
): string {
  if (issues.length === 0) {
    return `## ${title}\n\n${emptyLine}\n`;
  }
  const grouped = groupIssues(issues);
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

/** The flat text of one collected issue, by the gate's own join rule. */
function rawOf(issue: StructuredIssue): string {
  const flat = joinIssue({ code: issue.code, params: issue.params });
  return issue.slot === undefined ? flat : `${issue.slot}:${flat}`;
}

/**
 * The complete raw input, repeated verbatim. This is what makes the
 * never-drop-a-code rule checkable from the document rather than trusted.
 *
 * It is handed the SAME lists the body rendered. Reading its own source — the
 * gate's flattened arrays — is what let round 6 find a blocker whose meaning was
 * printed in the body while its code appeared nowhere and this section said
 * `none`. An appendix that can disagree with the body proves nothing.
 */
function renderCodeAppendix(
  pack: PublishingHandoffPack,
  blockerIssues: StructuredIssue[],
  warningIssues: StructuredIssue[]
): string {
  const external = Object.entries(pack.externalPublishBlocks).flatMap(
    ([channel, codes]) =>
      codes.map(code => `${inlineCode(channel)}: ${inlineCode(code)}`)
  );
  const lines = [
    ...blockerIssues.map(issue => `blocker: ${inlineCode(rawOf(issue))}`),
    ...warningIssues.map(issue => `warning: ${inlineCode(rawOf(issue))}`),
    ...external.map(entry => `external: ${entry}`),
  ];
  const body =
    lines.length > 0 ? lines.map(line => `- ${line}`).join('\n') : '- none';
  return `## Codes\n\nEvery code above, one line each, nothing filtered out. Values are shown in the same display form used throughout: newlines and tabs escaped, empty and whitespace-only values named. The unaltered bytes are in the campaign pack this document was rendered from.\n\n${body}\n`;
}

export function renderPublishingHandoff(
  pack: PublishingHandoffPack,
  options: { titlePrefix?: string } = {}
): string {
  const prefix = options.titlePrefix ? `${options.titlePrefix} ` : '';
  const gate = pack.qualityGate;
  const summary = gate.sourceSummary;

  // Everything below is derived from the STRUCTURED per-draft results, so the
  // verdict, the section and the affected-draft counts cannot disagree: they are
  // three views of one list.
  const blockerIssues = collectIssues(
    gate.blockerIssues,
    gate.draftResults,
    result => result.blockerIssues
  );
  const warningIssues = collectIssues(
    gate.warningIssues,
    gate.draftResults,
    result => result.warningIssues
  );

  // Count DISTINCT problems, the same way the body groups them. Counting raw
  // occurrences here said "BLOCKED — 15 issues" above a single entry reading
  // "Affects 15 drafts", which contradicts the one question this document exists
  // to answer.
  const problems = groupIssues(blockerIssues);
  const distinctProblems = problems.length;
  const plural = distinctProblems === 1 ? '' : 's';

  // `allowed` is NOT trusted on its own. The input type permits `allowed: true`
  // alongside a populated blocker list, and a document that prints PASS above
  // listed blockers can get a campaign published over one. Where the two
  // disagree, the blockers win and the disagreement is stated rather than hidden.
  let verdict: string;
  if (distinctProblems > 0) {
    verdict = gate.allowed
      ? `BLOCKED — ${distinctProblems} issue${plural} listed below. The gate also reports this campaign as allowed, which contradicts them. Treat it as blocked and ask why the two disagree.`
      : `BLOCKED — ${distinctProblems} issue${plural} must be cleared first.`;
  } else {
    verdict = gate.allowed
      ? 'PASS — nothing in the quality gate is holding this campaign.'
      : 'BLOCKED — the gate reports this campaign as not allowed but lists no blocker. Treat it as blocked and ask why.';
  }

  return `# ${prefix}Publishing Handoff

## Can I publish?

- **Quality gate:** ${verdict}
- **Blog and newsletter:** ${pack.ownedMediaGate.allowed ? 'ready to publish' : 'blocked'}
- **External social:** never publishes automatically — see the channel list below
- **Score:** ${gate.overallScore}/100
- **Sources:** ${summary.checkedSources} of ${summary.totalSources} checked · ${summary.officialPlatformSources} official platform · ${summary.internalPolicySources} internal policy

${renderSection('What needs your attention', blockerIssues, 'Nothing. The quality gate found no blockers.')}
${renderSection('Waiting on access, not on you', warningIssues, 'Nothing waiting.')}
${renderExternal(pack.externalPublishBlocks)}
## Publish rule

No external platform post is marked as live unless there is a platform receipt, URL, or API response stored back into the campaign pack.

${renderCodeAppendix(pack, blockerIssues, warningIssues)}`;
}
