/** Brand colours and persona colour mapping for Synthex Board */

export const BRAND = {
  bg: '#0A0A0F',
  bgCard: '#12121A',
  bgOverlay: 'rgba(10, 10, 15, 0.85)',
  accent: '#F59E0B', // Synthex amber
  accentLight: '#FBBF24',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  border: '#1F2937',
  borderGlow: 'rgba(245, 158, 11, 0.3)',
  decision: '#EF4444', // Red for decision moments
  risk: '#F97316', // Orange for risk warnings
  success: '#10B981', // Green for positive metrics
} as const;

/** Map persona colour descriptions to hex for avatar placeholder backgrounds */
export const PERSONA_COLOURS: Record<string, string> = {
  ceo: '#F59E0B',                 // amber/orange
  'senior-pm': '#2563EB',         // sapphire blue
  moonshot: '#22C55E',            // neon green
  'algorithm-engineer': '#EC4899', // magenta/pink
  technical: '#84CC16',           // lime/yellow-green
  'qa-engineer': '#E5E7EB',       // pearl white
  'security-engineer': '#7C3AED', // deep purple/violet
  'ai-ml-engineer': '#06B6D4',    // cyan/teal
  'database-engineer': '#DC2626', // crimson/deep red
  'frontend-engineer': '#F87171', // coral/salmon-red
  'bigdata-architect': '#14B8A6', // teal/cyan
  'api-reliability-engineer': '#EAB308', // bright yellow/golden
  'devops-engineer': '#34D399',   // mint/emerald green
  'systems-architect': '#1D4ED8', // navy/cobalt blue
  'infosec-compliance': '#8B5CF6', // violet/purple
  'mobile-engineer': '#4ADE80',   // electric/neon green
  cmo: '#EA580C',                 // deep orange-red/amber
  'social-pr-director': '#EC4899', // hot pink/magenta
  market: '#D97706',              // amber/golden orange
  oracle: '#4338CA',              // deep indigo/purple
  compounder: '#166534',          // deep forest green
  contrarian: '#374151',          // smoke/dark charcoal
  product: '#D946EF',             // magenta/fuchsia pink
  revenue: '#2563EB',             // cobalt/royal blue
};

/** Scene type to background accent colour */
export const SCENE_COLOURS: Record<string, string> = {
  title_card: BRAND.accent,
  narration: BRAND.accent,
  deliberation: '#3B82F6',
  decision: BRAND.decision,
  decision_body: BRAND.decision,
  next_actions: BRAND.success,
  risk: BRAND.risk,
  closing: BRAND.accent,
};
