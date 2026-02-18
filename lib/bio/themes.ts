/**
 * Bio Page Theme Presets
 *
 * @description Predefined themes for bio pages with colors and styling.
 */

export interface BioTheme {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonStyle: 'rounded' | 'pill' | 'square';
  preview: string; // CSS gradient for preview card
}

export const BIO_THEMES: BioTheme[] = [
  {
    id: 'default',
    name: 'Synthex',
    primaryColor: '#06b6d4',
    backgroundColor: '#0f172a',
    textColor: '#ffffff',
    buttonStyle: 'rounded',
    preview: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    primaryColor: '#000000',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    buttonStyle: 'square',
    preview: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
  },
  {
    id: 'gradient',
    name: 'Gradient',
    primaryColor: '#8b5cf6',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: '#ffffff',
    buttonStyle: 'pill',
    preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'dark',
    name: 'Midnight',
    primaryColor: '#f59e0b',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    buttonStyle: 'rounded',
    preview: 'linear-gradient(135deg, #000000 0%, #1a1a2e 100%)',
  },
  {
    id: 'neon',
    name: 'Neon',
    primaryColor: '#22d3ee',
    backgroundColor: '#0c0a09',
    textColor: '#22d3ee',
    buttonStyle: 'pill',
    preview: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#22c55e',
    backgroundColor: '#14532d',
    textColor: '#ffffff',
    buttonStyle: 'rounded',
    preview: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
  },
];

/**
 * Get theme by ID
 */
export function getThemeById(id: string): BioTheme | undefined {
  return BIO_THEMES.find((theme) => theme.id === id);
}

/**
 * Get default theme
 */
export function getDefaultTheme(): BioTheme {
  return BIO_THEMES[0];
}
