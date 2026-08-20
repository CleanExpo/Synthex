import { validateProfileUrl } from '@/lib/profile-analyser/urls';

describe('validateProfileUrl', () => {
  it('accepts public LinkedIn profile and company URLs', () => {
    expect(
      validateProfileUrl(
        'linkedin',
        'https://www.linkedin.com/in/williamhgates'
      )
    ).toEqual({
      ok: true,
      url: 'https://www.linkedin.com/in/williamhgates',
    });
    expect(
      validateProfileUrl(
        'linkedin',
        'https://linkedin.com/company/synthex'
      ).ok
    ).toBe(true);
  });

  it('rejects LinkedIn URLs that are not a profile or company page', () => {
    const result = validateProfileUrl(
      'linkedin',
      'https://www.linkedin.com/feed/'
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a Facebook URL when LinkedIn is selected', () => {
    const result = validateProfileUrl(
      'linkedin',
      'https://www.facebook.com/cocacola'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/linkedin\.com/i);
    }
  });

  it('accepts facebook.com and fb.com page URLs', () => {
    expect(
      validateProfileUrl('facebook', 'https://www.facebook.com/cocacola').ok
    ).toBe(true);
    expect(validateProfileUrl('facebook', 'https://fb.com/cocacola').ok).toBe(
      true
    );
  });

  it('rejects the Facebook homepage', () => {
    const result = validateProfileUrl('facebook', 'https://www.facebook.com/');
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid URL', () => {
    const result = validateProfileUrl('linkedin', 'not-a-url');
    expect(result.ok).toBe(false);
  });
});
