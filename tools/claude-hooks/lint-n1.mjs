#!/usr/bin/env node
/**
 * tools/claude-hooks/lint-n1.mjs — H15 PostToolUse advisory lint (research N1, Australian
 * marketing compliance). After a Write/Edit/MultiEdit of a content or campaign file:
 *   - an email template needs an unsubscribe / opt-out (Spam Act s18);
 *   - a trade ad needs a licence number (NSW Home Building Act, QLD QBCC Act).
 * Advisory only: the tool already ran, so it adds a warning next to the result
 * (hookSpecificOutput.additionalContext) and a systemMessage for the user; it never blocks.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emit, readInput } from './lib.mjs';

const EMAIL_PATH =
  /(^|[/_.-])(e?mail|newsletter|review-request|drip|sequence)s?([/_.-]|$)/i;
const EMAIL_BODY =
  /<html|<body|\bsubject\s*[:=]|\bresend\b|sendEmail|\bhtml\s*[:=]/i;
const UNSUBSCRIBE = /unsubscribe|opt[\s-]?out|\{\{\s*unsub/i;
const AD_PATH =
  /(^|[/_.-])(ads?|adverts?|advertising|campaigns?|creatives?|promos?)([/_.-]|$)/i;
const TRADE =
  /\b(plumb\w*|electric\w*|builders?|building work|renovat\w*|roof\w*|restoration|waterproof\w*|tiling|tiler|carpent\w*|landscap\w*|pest control|air[\s-]?con\w*|hvac|painting|painters?|concret\w*|fenc\w*|glazi\w*|demolition|mould remediation)\b/i;
const LICENCE =
  /\blicen[cs]e\s*(no\.?|number|#)?\s*[:#]?\s*[A-Z0-9][A-Z0-9-]{3,}|\bLic\.?\s*(No\.?)?\s*[:#]?\s*\d{3,}|\bQBCC\s*(no\.?|licence)?\s*[:#]?\s*\d{4,}/i;

export function lintN1(file, text) {
  const rel = String(file || '').replace(/\\/g, '/');
  const warnings = [];
  if (/\.(test|spec)\.[jt]sx?$/.test(rel)) return warnings;
  if (EMAIL_PATH.test(rel) && EMAIL_BODY.test(text) && !UNSUBSCRIBE.test(text))
    warnings.push(
      'email template has no unsubscribe or opt-out (Spam Act s18 requires a functional unsubscribe)'
    );
  if (AD_PATH.test(rel) && TRADE.test(text) && !LICENCE.test(text))
    warnings.push(
      'trade ad has no licence number (NSW Home Building Act; QLD QBCC Act require the licensed name and number)'
    );
  return warnings;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const input = readInput();
    const file = (input.tool_input || {}).file_path;
    if (file && existsSync(file)) {
      const w = lintN1(
        path.relative(input.cwd || process.cwd(), file),
        readFileSync(file, 'utf8')
      );
      if (w.length) {
        const msg = `H15 N1 compliance lint (advisory) for ${file}: ${w.join('; ')}`;
        emit({
          systemMessage: msg,
          hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: msg,
          },
        });
      }
    }
    process.exit(0);
  } catch (e) {
    process.stderr.write(`synthex-hooks lint-n1 failed: ${e.message}\n`);
    process.exit(1);
  }
}
