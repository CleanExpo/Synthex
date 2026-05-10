/**
 * Unit tests for the demo-URL-pipeline industry classifier.
 *
 * Regression coverage for SYN-853:
 *   - CARSI (online IICRC training) was returning "beauty salon"
 *     because /colour/ matched any AU-English page.
 *   - RestoreAssist (B2B SaaS for property restoration) was returning
 *     "real estate" because /propert/ matched "property damage".
 *
 * These tests lock the new behaviour: education & B2B SaaS are first-class
 * categories, and the over-broad "colour" / "propert" patterns are gone.
 */

import { detectIndustry } from '@/lib/demo/industry-classifier';

describe('detectIndustry — SYN-853 regressions', () => {
  it('classifies CARSI-style training copy as education & training', () => {
    const carsiCopy = `
      CARSI delivers online IICRC continuing education credits (CEC) and CPD
      courses for restoration professionals across Australia. Our certification
      program covers carpet cleaning, water damage, and colour restoration.
    `;
    expect(detectIndustry(carsiCopy)).toBe('education & training');
  });

  it('classifies RestoreAssist-style B2B SaaS copy as B2B SaaS', () => {
    const restoreAssistCopy = `
      RestoreAssist is the B2B SaaS platform purpose-built for property
      restoration companies. Manage claims, jobs, and operations from one
      dashboard. Used by leading restoration software providers.
    `;
    expect(detectIndustry(restoreAssistCopy)).toBe('B2B SaaS');
  });

  it('does NOT classify a page mentioning "colour" as beauty salon', () => {
    const auEnglishCopy = `
      We deliver high-quality colour matching for residential interiors.
      Our colour palette consultations help homeowners pick the right shade.
    `;
    // Should fall through to local business, NOT beauty salon
    expect(detectIndustry(auEnglishCopy)).not.toBe('beauty salon');
  });

  it('does NOT classify "property damage" pages as real estate', () => {
    const propertyDamageCopy = `
      We help homeowners recover from water damage to their property.
      Fast restoration of property after fire and flood incidents.
    `;
    // Should match cleaning & restoration, not real estate
    expect(detectIndustry(propertyDamageCopy)).toBe('cleaning & restoration');
  });
});

describe('detectIndustry — smoke tests for 5 canonical business types', () => {
  it('cafe', () => {
    expect(
      detectIndustry('Our cafe serves single-origin coffee roasted by our barista team.')
    ).toBe('cafe');
  });

  it('real estate (genuine — listings & sales)', () => {
    expect(
      detectIndustry(
        'Browse properties for sale across Sydney. Contact our real estate agents for property valuations.'
      )
    ).toBe('real estate');
  });

  it('beauty salon (genuine — hair salon)', () => {
    expect(
      detectIndustry('Our hair salon and day spa offer premium hairdresser services.')
    ).toBe('beauty salon');
  });

  it('legal', () => {
    expect(
      detectIndustry('Top law firm in Melbourne. Our solicitors provide commercial legal services.')
    ).toBe('legal');
  });

  it('cleaning & restoration', () => {
    expect(
      detectIndustry('Specialist water damage restoration and mould remediation across Brisbane.')
    ).toBe('cleaning & restoration');
  });

  it('falls back to local business when no category matches', () => {
    expect(detectIndustry('We are a friendly Australian business serving the community.')).toBe(
      'local business'
    );
  });
});

describe('detectIndustry — specific-before-generic ordering', () => {
  it('B2B SaaS wins over generic technology when both signals present', () => {
    expect(
      detectIndustry('Our restoration software platform is the leading SaaS for B2B teams.')
    ).toBe('B2B SaaS');
  });

  it('education wins over technology when both signals present', () => {
    expect(
      detectIndustry(
        'Our online learning management system delivers professional certification courses.'
      )
    ).toBe('education & training');
  });
});
