/**
 * Experience Detector
 *
 * Detects first-hand experience signals in content.
 * Looks for: first-person narratives, original media, case studies, process docs.
 *
 * @module lib/eeat/experience-detector
 */

import type { ExperienceSignals } from './types';

export function detectExperience(content: string): ExperienceSignals {
  const signals: string[] = [];

  // First-person narratives
  const firstPersonPatterns = /\b(I tested|I found|in my experience|I've been|I discovered|I noticed|I implemented|I built|I measured|our team|we found|we tested|we discovered|we implemented|our results|my experience)/gi;
  const firstPersonMatches = content.match(firstPersonPatterns) || [];
  if (firstPersonMatches.length > 0) signals.push(`${firstPersonMatches.length} first-person narrative${firstPersonMatches.length > 1 ? 's' : ''} detected`);

  // Original photos/screenshots
  const originalPhotos = /\b(screenshot|photo I took|original image|our photo|my photo|taken on|photographed|I captured|our team photo)/i.test(content) ||
    /!\[.*(?:screenshot|result|before|after|test|my|our).*\]/i.test(content);
  if (originalPhotos) signals.push('Original photo/screenshot references detected');

  // Case studies
  const caseStudyPatterns = /\b(case study|client story|real example|actual project|we worked with|our client|specific instance|real-world example)/gi;
  const caseStudies = (content.match(caseStudyPatterns) || []).length;
  if (caseStudies > 0) signals.push(`${caseStudies} case study reference${caseStudies > 1 ? 's' : ''}`);

  // Process documentation
  const processDocumentation = /\b(step by step|our process|we followed|methodology|our approach|how we did|implementation steps|workflow)/i.test(content);
  if (processDocumentation) signals.push('Process documentation detected');

  // Before/after results
  const beforeAfterResults = /\b(before and after|before\/after|prior to.*after|improved from.*to|increased.*from.*to|decreased.*from.*to|results showed|outcome was)/i.test(content);
  if (beforeAfterResults) signals.push('Before/after results detected');

  // Specific examples with details
  const specificExamplePatterns = /\b(\d+%\s+(?:increase|decrease|improvement|growth|reduction|decline)|\$[\d,]+|(?:from|went from)\s+\d+\s+to\s+\d+|specifically|for example|for instance|in one case)/gi;
  const specificExamples = (content.match(specificExamplePatterns) || []).length;
  if (specificExamples > 0) signals.push(`${specificExamples} specific example${specificExamples > 1 ? 's' : ''} with data`);

  return {
    firstPersonNarratives: firstPersonMatches.length,
    originalPhotos,
    caseStudies,
    processDocumentation,
    beforeAfterResults,
    specificExamples,
    signals,
  };
}
