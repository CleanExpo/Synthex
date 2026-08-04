/**
 * Client-facing accent colours
 *
 * Review-request emails and published SEO articles are the client's own
 * collateral — they go out under the client's business name, so they must never
 * carry Synthex's brand colour. Each organisation's `primaryColor` drives the
 * accent instead. Organisations that haven't set one get a neutral slate, so
 * the output reads as unbranded rather than as somebody else's brand.
 */

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** Slate-700 — deliberately not a brand colour of any tenant. */
const NEUTRAL_ACCENT = '#334155';

export interface ClientAccent {
  /** Solid fill for buttons and header bars. */
  accent: string;
  /** Near-white wash for callout backgrounds. */
  tint: string;
  /** Mid-light border that pairs with `tint`. */
  border: string;
  /** Darkened accent, readable as body text on `tint`. */
  ink: string;
}

export function resolveClientAccent(
  primaryColor?: string | null
): ClientAccent {
  const trimmed = primaryColor?.trim() ?? '';
  const accent = HEX_COLOUR.test(trimmed)
    ? trimmed.toLowerCase()
    : NEUTRAL_ACCENT;

  return {
    accent,
    tint: mix(accent, 0.94),
    border: mix(accent, 0.55),
    ink: mix(accent, -0.45),
  };
}

/**
 * Mixes `hex` toward white (positive `amount`) or black (negative). Results stay
 * in plain 6-digit hex because Outlook drops `rgba()` in inline styles.
 */
function mix(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(channel + (target - channel) * ratio);
  });
  return `#${channels.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}
