/**
 * Course and FAQPage markup. Google removed both rich results (Course info
 * documentation removed 2025-09-09; FAQ rich result no longer shown from
 * 2026-05-07), so these are emitted for other search and answer engines and
 * always reported as not Google-eligible.
 */
import { assertNoAccreditationClaims } from './claim-guard';
import type { JsonLd, PackOutput } from './types';

export const COURSE_RETIRED =
  'Google removed Course rich results on 2025-09-09; markup kept for other engines';
export const FAQ_RETIRED =
  'Google stopped showing FAQ rich results from 2026-05-07; markup kept for other engines';

export interface CourseFacts {
  name: string;
  description: string;
  url: string;
}

export function buildCourse(facts: CourseFacts, provider: JsonLd): PackOutput {
  assertNoAccreditationClaims({
    'course.name': facts.name,
    'course.description': facts.description,
  });
  return {
    jsonLd: {
      '@type': 'Course',
      name: facts.name,
      description: facts.description,
      url: facts.url,
      provider: { '@id': provider['@id'] },
    },
    googleRichResult: { eligible: false, missing: [], reason: COURSE_RETIRED },
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildFaqPage(entries: FaqEntry[]): PackOutput {
  return {
    jsonLd: {
      '@type': 'FAQPage',
      mainEntity: entries.map(entry => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    },
    googleRichResult: { eligible: false, missing: [], reason: FAQ_RETIRED },
  };
}
