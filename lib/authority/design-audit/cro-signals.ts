import type { PageContent, CROReadinessScore, DesignIssue } from './types';

export function analyseCROSignals(content: PageContent): { score: CROReadinessScore; issues: DesignIssue[] } {
  const issues: DesignIssue[] = [];

  // Conversion Funnel (0-20): CTA detection
  const ctaKeywords = /\b(buy|sign up|get started|contact|request|book|register|subscribe|download|try|start|join|learn more|get quote|shop)\b/gi;
  const ctaLinks = content.links.filter(l => ctaKeywords.test(l.text));
  let conversionFunnel = 0;
  if (ctaLinks.length === 0) {
    issues.push({ type: 'warning', category: 'cro', message: 'No clear call-to-action links detected', penalty: 0 });
  } else if (ctaLinks.length <= 2) {
    conversionFunnel = 12;
  } else if (ctaLinks.length <= 5) {
    conversionFunnel = 20;
  } else {
    conversionFunnel = 15; // too many = friction
    issues.push({ type: 'info', category: 'cro', message: `${ctaLinks.length} CTAs may cause choice overload — reduce to 3-5`, penalty: 0 });
  }

  // Trust Signals (0-20)
  const trustPatterns = [
    /author|written by|by [A-Z]/i,
    /testimonial|review|star|rating|client|customer/i,
    /certified|accredited|member of|licensed/i,
    /trust|guarantee|secure|privacy/i,
    /years of experience|founded in|established/i,
  ];
  const fullText = content.text + ' ' + content.html;
  const trustCount = trustPatterns.filter(p => p.test(fullText)).length;
  const trustSignals = Math.min(20, trustCount * 4);

  // Friction Reduction (0-20): form complexity
  let frictionReduction = 20;
  for (const form of content.forms) {
    if (form.fields > 7) {
      frictionReduction = Math.max(0, frictionReduction - 10);
      issues.push({ type: 'warning', category: 'cro', message: `Form with ${form.fields} fields may cause friction — reduce to 3-5 fields`, penalty: 0 });
    } else if (form.fields > 4) {
      frictionReduction = Math.max(0, frictionReduction - 5);
    }
  }

  // Mobile Conversion (0-20)
  const hasTel = /href="tel:/i.test(content.html);
  const mobileConversion = hasTel ? 20 : 10;

  // Above-Fold Conversion (0-20): check if headline + CTA appear early
  const firstHeading = content.headings[0];
  const hasEarlyCTA = ctaLinks.length > 0 && content.paragraphs.length > 0;
  const aboveFoldConversion = (firstHeading && hasEarlyCTA) ? 20 : firstHeading ? 12 : 5;

  const total = conversionFunnel + trustSignals + frictionReduction + mobileConversion + aboveFoldConversion;

  return {
    score: { total, conversionFunnel, trustSignals, frictionReduction, mobileConversion, aboveFoldConversion },
    issues,
  };
}
