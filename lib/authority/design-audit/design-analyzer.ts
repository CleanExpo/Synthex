import { analyseHeadingHierarchy } from './heading-hierarchy';
import { analyseContentStructure } from './content-structure';
import { analyseCROSignals } from './cro-signals';
import { analyseMobileReadiness } from './mobile-readiness';
import { checkPerformance } from './performance-checker';
import { analyseLLMCitationFitness } from './llm-citation-fitness';
import type {
  DesignAuditResult,
  DesignQualityScore,
  LLMCitationFitnessScore,
  DesignIssue,
  DesignRecommendation,
  PageContent,
} from './types';

// --- HTML Parser ---

function parseHTML(html: string, url?: string): PageContent {
  // Extract meta
  const viewportMatch = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

  // Extract headings
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: PageContent['headings'] = [];
  let match: RegExpExecArray | null;
  let pos = 0;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ level: parseInt(match[1], 10), text: match[2].replace(/<[^>]+>/g, '').trim(), position: pos++ });
  }

  // Extract paragraphs text
  const paraRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs: string[] = [];
  while ((match = paraRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 20) paragraphs.push(text);
  }

  // Extract links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: PageContent['links'] = [];
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    links.push({ text, href, isExternal: href.startsWith('http') });
  }

  // Extract images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:width=["']?(\d+)["']?)?[^>]*(?:height=["']?(\d+)["']?)?[^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const images: PageContent['images'] = [];
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({
      src: match[1],
      alt: match[4] ?? '',
      width: match[2] ? parseInt(match[2], 10) : undefined,
      height: match[3] ? parseInt(match[3], 10) : undefined,
    });
  }

  // Count tables and lists
  const tables = (html.match(/<table/gi) ?? []).length;
  const lists = (html.match(/<[ou]l/gi) ?? []).length;

  // Extract forms
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  const forms: PageContent['forms'] = [];
  while ((match = formRegex.exec(html)) !== null) {
    const formHtml = match[1];
    const fields = (formHtml.match(/<input|<textarea|<select/gi) ?? []).length;
    const hasSubmit =
      /<(input|button)[^>]*type=["']?submit["']?/i.test(formHtml) ||
      /<button[^>]*>submit/i.test(formHtml);
    forms.push({ fields, hasSubmit });
  }

  // Extract plain text
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    html,
    text,
    url,
    headings,
    paragraphs,
    links,
    images,
    tables,
    lists,
    forms,
    meta: {
      title: titleMatch?.[1],
      description: descMatch?.[1],
      viewport: viewportMatch?.[1],
    },
  };
}

// --- Main Orchestrator ---

export async function analyseDesign(input: {
  content?: string;
  url?: string;
  html?: string;
}): Promise<DesignAuditResult> {
  let pageContent: PageContent;

  if (input.url) {
    try {
      const res = await fetch(input.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Synthex-Authority-Analyzer' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      pageContent = parseHTML(html, input.url);
    } catch {
      // Fall back to empty content if URL fetch fails
      pageContent = parseHTML('', input.url);
    }
  } else if (input.html) {
    pageContent = parseHTML(input.html);
  } else if (input.content) {
    // Convert markdown-like content to basic HTML
    const html = input.content
      .replace(/^#{1} (.+)$/gm, '<h1>$1</h1>')
      .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
    pageContent = parseHTML(html);
  } else {
    pageContent = parseHTML('');
  }

  // Run all analysers in parallel
  const [headingResult, contentResult, croResult, mobileResult, perfResult, citationResult] =
    await Promise.all([
      Promise.resolve(analyseHeadingHierarchy(pageContent)),
      Promise.resolve(analyseContentStructure(pageContent)),
      Promise.resolve(analyseCROSignals(pageContent)),
      Promise.resolve(analyseMobileReadiness(pageContent)),
      input.url
        ? checkPerformance(input.url)
        : Promise.resolve({
            score: 0,
            metrics: { lcp: 0, inp: 0, cls: 0, performanceScore: 0, accessibilityScore: 0 },
            issues: [] as DesignIssue[],
          }),
      Promise.resolve(analyseLLMCitationFitness(pageContent)),
    ]);

  // Suppress unused contentResult — its data flows through citationResult
  void contentResult;

  // Compose design quality score
  const designQuality: DesignQualityScore = {
    headingHierarchy: headingResult.score,
    mobileReadiness: mobileResult.score,
    aboveFoldClarity: pageContent.headings.length > 0 ? 10 : 0,
    informationDensity: Math.min(15, pageContent.paragraphs.length > 3 ? 12 : 6),
    performance: perfResult.score,
    mediaOptimisation:
      pageContent.images.length > 0 && pageContent.images.every(i => i.alt) ? 10 : 5,
    interstitialPenalty: 15, // default full — no penalty
    total: 0,
  };
  designQuality.total =
    designQuality.headingHierarchy +
    designQuality.mobileReadiness +
    designQuality.aboveFoldClarity +
    designQuality.informationDensity +
    designQuality.performance +
    designQuality.mediaOptimisation;

  // Compose LLM citation fitness
  const llmCitationFitness: LLMCitationFitnessScore = {
    ...citationResult.score,
    total:
      citationResult.score.claimIsolation +
      citationResult.score.inlineAttribution +
      citationResult.score.tableListStructure +
      citationResult.score.answerQueryAlignment +
      citationResult.score.boldEntityDefinitions +
      citationResult.score.logicalHeadingDepth +
      citationResult.score.entityConsistency,
  };

  // Weighted overall: Design 35%, CRO 30%, LLM 35%
  const overallScore = Math.round(
    (designQuality.total / 100) * 35 +
      (croResult.score.total / 100) * 30 +
      (llmCitationFitness.total / 100) * 35
  );

  // Collect all issues
  const allIssues: DesignIssue[] = [
    ...headingResult.issues,
    ...croResult.issues,
    ...mobileResult.issues,
    ...perfResult.issues,
    ...citationResult.issues,
  ];

  // Generate top recommendations based on lowest scores
  const recommendations: DesignRecommendation[] = [];
  if (designQuality.headingHierarchy < 10) {
    recommendations.push({
      priority: 'high',
      category: 'heading',
      title: 'Fix heading hierarchy',
      description: 'Ensure H1→H2→H3 progression without skipping levels',
      impact: 'Improves both search engine and AI crawler understanding',
    });
  }
  if (llmCitationFitness.claimIsolation < 8) {
    recommendations.push({
      priority: 'high',
      category: 'citation',
      title: 'Break up long paragraphs',
      description: 'Aim for 25-40 word paragraphs with single claims',
      impact: 'Increases AI citation pickup by up to 3x',
    });
  }
  if (llmCitationFitness.tableListStructure < 8) {
    recommendations.push({
      priority: 'medium',
      category: 'structure',
      title: 'Add structured data tables or lists',
      description: 'Include numbered lists and comparison tables',
      impact: 'Structured content gets cited 2.3x more by AI search engines',
    });
  }
  if (croResult.score.trustSignals < 12) {
    recommendations.push({
      priority: 'medium',
      category: 'cro',
      title: 'Add trust signals',
      description: 'Include author bio, testimonials, and credentials',
      impact: 'Trust signals increase conversion rates and source authority',
    });
  }
  if (designQuality.mobileReadiness < 10) {
    recommendations.push({
      priority: 'high',
      category: 'mobile',
      title: 'Improve mobile readiness',
      description: 'Add viewport meta, fix touch targets, ensure responsive tables',
      impact: 'Mobile-first indexing affects both rankings and AI citations',
    });
  }

  return {
    designQuality,
    croReadiness: croResult.score,
    llmCitationFitness,
    overallScore,
    issues: allIssues,
    recommendations: recommendations.slice(0, 5),
  };
}
