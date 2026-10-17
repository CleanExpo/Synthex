/**
 * Motion Studio — fact guard.
 *
 * Every figure that appears on screen must be present in the brief's source,
 * or be a declared derived figure that we recompute here. Motion-style tools
 * happily compute their own percentages; a wrong one in a client video is a
 * claim we cannot stand behind, so an unsupported figure blocks the render.
 */
import type { DerivedFigure } from './brief';

export interface Figure {
  raw: string;
  value: number;
  percent: boolean;
}

const FIGURE = /(?:\$\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b)?/gi;
// Links (with or without a scheme), bare domains with a path, and email addresses.
const NOT_PROSE =
  /\b(?:https?:\/\/|www\.)\S+|\S+@\S+\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi;

export function extractFigures(text: string): Figure[] {
  return [...text.matchAll(FIGURE)].map(m => {
    const raw = m[0].trim();
    const percent = /%|percent/i.test(raw);
    const value = Number(raw.replace(/[^\d.]/g, ''));
    return { raw, value, percent };
  });
}

export function computeDerived(d: DerivedFigure): Figure {
  const [a, b] = d.inputs;
  const factor = 10 ** d.decimals;
  const round = (n: number) => Math.round(n * factor) / factor;
  switch (d.operation) {
    case 'percent':
      return { raw: d.label, value: round((a / b) * 100), percent: true };
    case 'ratio':
      return { raw: d.label, value: round(a / b), percent: false };
    case 'difference':
      return { raw: d.label, value: round(a - b), percent: false };
    case 'sum':
      return {
        raw: d.label,
        value: round(d.inputs.reduce((s, n) => s + n, 0)),
        percent: false,
      };
  }
}

export interface FactCheck {
  ok: boolean;
  checked: string[];
  unsupported: string[];
}

const same = (x: Figure, y: Figure) =>
  x.percent === y.percent && Math.abs(x.value - y.value) < 1e-9;

export function checkFigures(
  onScreen: string[],
  source: string,
  derived: DerivedFigure[] = []
): FactCheck {
  // Digits inside a link or email address are not claims; only prose counts.
  const sourceFigures = extractFigures(source.replace(NOT_PROSE, ' '));
  const unsupported: string[] = [];

  // A derived figure is only usable if every input is itself in the source.
  const allowedDerived = derived.flatMap(d =>
    d.inputs.every(n => sourceFigures.some(f => f.value === n))
      ? [computeDerived(d)]
      : []
  );
  for (const d of derived) {
    if (!d.inputs.every(n => sourceFigures.some(f => f.value === n))) {
      unsupported.push(`${d.label}: inputs not found in source`);
    }
  }

  const allowed = [...sourceFigures, ...allowedDerived];
  const checked: string[] = [];
  for (const text of onScreen) {
    for (const fig of extractFigures(text)) {
      checked.push(fig.raw);
      if (!allowed.some(a => same(a, fig))) unsupported.push(fig.raw);
    }
  }
  return { ok: unsupported.length === 0, checked, unsupported };
}
