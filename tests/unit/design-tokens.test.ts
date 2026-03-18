import { simpleModeTokens, proModeTokens } from '@/lib/design-tokens';

describe('v11 mode tokens', () => {
  test('simpleModeTokens exports expected keys', () => {
    expect(simpleModeTokens).toMatchObject({
      background: '#202124',
      surface: '#2b2d31',
      accent: '#a8845c',
      accentSubtle: 'rgba(168,132,92,0.15)',
      accentBorder: 'rgba(168,132,92,0.35)',
      textPrimary: '#e8e0d4',
      textSecondary: 'rgba(232,224,212,0.4)',
    });
  });

  test('proModeTokens exports expected keys', () => {
    expect(proModeTokens).toMatchObject({
      background: '#1c1b1e',
      surface: '#252428',
      accent: '#f59e0b',
      accentSubtle: 'rgba(245,158,11,0.1)',
      accentBorder: 'rgba(245,158,11,0.2)',
      textPrimary: 'rgba(255,255,255,0.85)',
      textSecondary: 'rgba(255,255,255,0.35)',
      dataHighlight: '#f59e0b',
    });
  });
});
