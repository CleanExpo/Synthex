import type { Sensitivity } from './board-input.schema';

export interface MargotConversationPassInput {
  rawText: string;
  evidenceRefs?: string[];
}

export interface MargotConversationPassResult {
  cleanedText: string;
  sensitivity: Sensitivity;
  intent: 'campaign' | 'presentation' | 'media' | 'engineering' | 'research';
  risks: string[];
}

const RISK_PATTERNS: Array<[RegExp, string]> = [
  [/\b(api[_ -]?key|password|secret|token)\b/i, 'secret_or_credential'],
  [/\b(publish|go live|launch|deploy)\b/i, 'release_action'],
  [/\b(ad spend|budget|payment|invoice|stripe)\b/i, 'commercial_action'],
  [/\b(client data|private|confidential|legal)\b/i, 'sensitive_context'],
];

export function runMargotConversationPass(
  input: MargotConversationPassInput
): MargotConversationPassResult {
  const cleanedText = input.rawText.replace(/\s+/g, ' ').trim();
  const risks = RISK_PATTERNS.filter(([pattern]) => pattern.test(cleanedText)).map(
    ([, risk]) => risk
  );

  return {
    cleanedText,
    sensitivity: classifySensitivity(cleanedText, risks),
    intent: classifyIntent(cleanedText),
    risks,
  };
}

function classifySensitivity(text: string, risks: string[]): Sensitivity {
  if (risks.includes('secret_or_credential')) return 'restricted';
  if (risks.includes('sensitive_context')) return 'confidential';
  if (/\b(client|board|internal|margin|pricing)\b/i.test(text)) return 'internal';
  return 'public';
}

function classifyIntent(
  text: string
): MargotConversationPassResult['intent'] {
  if (/\b(video|short|reel|heygen|remotion|media|thumbnail)\b/i.test(text)) {
    return 'media';
  }
  if (/\b(presentation|deck|slide|event|meeting)\b/i.test(text)) {
    return 'presentation';
  }
  if (/\b(code|build|bug|api|route|database|deploy)\b/i.test(text)) {
    return 'engineering';
  }
  if (/\b(research|trend|competitor|market|seo|geo|aeo)\b/i.test(text)) {
    return 'research';
  }
  return 'campaign';
}
