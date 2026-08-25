/**
 * Unit tests for organizationProfileFromAudit — onboarding → Organization map.
 */

import {
  brandColourListFromAudit,
  organizationProfileFromAudit,
} from '@/lib/onboarding/org-profile-from-audit';

describe('organizationProfileFromAudit', () => {
  it('maps identity, branding, socials, and AI snapshot onto Organization fields', () => {
    const data = organizationProfileFromAudit({
      businessName: 'Acme Cafe',
      industry: 'hospitality',
      teamSize: '2-10',
      description: 'Specialty coffee in Melbourne',
      url: 'https://acme.example',
      logoUrl: 'https://acme.example/logo.png',
      faviconUrl: 'https://acme.example/favicon.ico',
      brandColours: {
        primary: '#112233',
        secondary: '#445566',
      },
      socialProfiles: [
        {
          platform: 'Instagram',
          url: 'https://instagram.com/acme',
          verified: true,
        },
        {
          platform: 'LinkedIn',
          url: 'https://linkedin.com/company/acme',
          verified: false,
        },
      ],
      structuredData: { abn: '12 345 678 901', phone: '+61 400 000 000' },
      seoScore: 72,
      keyTopics: ['coffee', 'brunch'],
      targetAudience: 'locals',
      suggestedTone: 'warm',
    });

    expect(data.name).toBe('Acme Cafe');
    expect(data.industry).toBe('hospitality');
    expect(data.teamSize).toBe('2-10');
    expect(data.description).toBe('Specialty coffee in Melbourne');
    expect(data.website).toBe('https://acme.example');
    expect(data.logo).toBe('https://acme.example/logo.png');
    expect(data.favicon).toBe('https://acme.example/favicon.ico');
    expect(data.primaryColor).toBe('#112233');
    expect(data.abn).toBe('12 345 678 901');
    expect(data.phoneNumber).toBe('+61 400 000 000');
    expect(data.socialHandles).toEqual({
      instagram: 'https://instagram.com/acme',
      linkedin: 'https://linkedin.com/company/acme',
    });
    expect(data.aiGeneratedData).toMatchObject({
      seoScore: 72,
      keyTopics: ['coffee', 'brunch'],
      targetAudience: 'locals',
      suggestedTone: 'warm',
    });
  });

  it('does not overwrite with empty optional strings', () => {
    const data = organizationProfileFromAudit({
      businessName: 'Keep Name',
      industry: '  ',
      description: '',
    });
    expect(data.name).toBe('Keep Name');
    expect(data.industry).toBeUndefined();
    expect(data.description).toBeUndefined();
  });
});

describe('brandColourListFromAudit', () => {
  it('normalises object and array colour shapes', () => {
    expect(
      brandColourListFromAudit({
        primary: '#aaa',
        secondary: '#bbb',
        accent: '#ccc',
      })
    ).toEqual(['#aaa', '#bbb', '#ccc']);
    expect(brandColourListFromAudit(['#111', '#222'])).toEqual([
      '#111',
      '#222',
    ]);
    expect(brandColourListFromAudit(null)).toEqual([]);
  });
});
