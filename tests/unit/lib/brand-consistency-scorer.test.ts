/**
 * SYN-858: regression tests for getPlatformMeta — ensures URL classification
 * uses parsed hostname, not raw substring includes() against the URL.
 *
 * The original implementation used url.toLowerCase().includes('linkedin.com'),
 * which can be bypassed by URLs like https://evil.com/?ref=linkedin.com.
 */

import { scoreConsistency } from '@/lib/brand/consistency-scorer';

describe('SYN-858 — consistency-scorer hostname checks', () => {
  it('does not classify https://evil.com/?ref=linkedin.com as LinkedIn', () => {
    const report = scoreConsistency({
      entityType: 'organization',
      canonicalName: 'Synthex',
      canonicalUrl: 'https://synthex.social',
      // Attacker-controlled URL placed in the LinkedIn slot. Hostname is
      // evil.com — must NOT be classified as LinkedIn (weight 3, sameAs).
      linkedinUrl: 'https://evil.com/?ref=linkedin.com',
    });

    const result = report.results[0];
    expect(result).toBeDefined();
    expect(result.platform).not.toBe('LinkedIn');
    expect(result.weight).toBe(1); // unknown platforms get weight 1, not 3
  });

  it('does not classify https://attacker.test/youtube.com/foo as YouTube', () => {
    const report = scoreConsistency({
      entityType: 'organization',
      canonicalName: 'Synthex',
      canonicalUrl: 'https://synthex.social',
      youtubeUrl: 'https://attacker.test/youtube.com/foo',
    });
    expect(report.results[0]?.platform).not.toBe('YouTube');
  });

  it('still classifies https://www.linkedin.com/company/synthex as LinkedIn', () => {
    const report = scoreConsistency({
      entityType: 'organization',
      canonicalName: 'Synthex',
      canonicalUrl: 'https://synthex.social',
      linkedinUrl: 'https://www.linkedin.com/company/synthex',
    });
    expect(report.results[0]?.platform).toBe('LinkedIn');
    expect(report.results[0]?.weight).toBe(3);
  });

  it('still classifies https://youtube.com/@synthex as YouTube', () => {
    const report = scoreConsistency({
      entityType: 'organization',
      canonicalName: 'Synthex',
      canonicalUrl: 'https://synthex.social',
      youtubeUrl: 'https://youtube.com/@synthex',
    });
    expect(report.results[0]?.platform).toBe('YouTube');
  });

  it('classifies subdomains of platform domains correctly (en.wikipedia.org)', () => {
    const report = scoreConsistency({
      entityType: 'organization',
      canonicalName: 'Synthex',
      canonicalUrl: 'https://synthex.social',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Synthex',
    });
    expect(report.results[0]?.platform).toBe('Wikipedia');
  });
});
