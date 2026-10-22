/**
 * JEV sweep G3 — no retired model defaults.
 *
 * SEAM: the source text of lib/ and services/ (every model-id literal in a
 * value position, found by a small scanner at run time, so the branch under
 * test is what is measured), resolved through the real registries
 * (lib/ai/model-registry.ts getModels, lib/services/ai/image/registry.ts
 * IMAGE_MODELS / estimateImageCostUsd / selectImageModel).
 * Catches: a default that names a registry entry deprecated as of a date, a
 * default the registry does not know, an image default that is unpriced or
 * deprecated, an unpriced image model that can still be costed or selected.
 * Misses: model ids built at run time from env or string concatenation, ids
 * outside the scanned pattern, and whether a vendor has actually retired a
 * model the registry still lists as current (the registry is the oracle).
 *
 * Criteria:
 *  G3.C1 default x as-of date: the default does not resolve to an entry
 *        deprecated as of that date (unregistered default: INCONCLUSIVE here).
 *  G3.C2 default: it resolves to a registry entry at all.
 *  G3.C3 image default: it resolves to a priced, non-deprecated image model.
 *  G3.C4 image model x output size: an unpriced model cannot be costed
 *        (estimateImageCostUsd throws UnpricedModelError).
 *  G3.C5 image model x preference: selectImageModel never hands back an
 *        unpriced or deprecated model.
 *  G3.C6 registry entry x as-of date: a deprecated entry's replacementModel is
 *        registered and not itself deprecated as of that date.
 */
import fs from 'fs';
import path from 'path';
import {
  getModels,
  type AIProvider,
  type ModelConfig,
} from '@/lib/ai/model-registry';
import {
  IMAGE_MODELS,
  UnpricedModelError,
  estimateImageCostUsd,
  selectImageModel,
  type ImageModel,
} from '@/lib/services/ai/image/registry';
import { Sink, SWEEP, disarmed } from './lib/sink';

const ROOT = path.join(__dirname, '../../../..');
const PROVIDERS: AIProvider[] = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'ollama',
];
const EXCLUDE = new Set([
  'lib/ai/model-registry.ts',
  'lib/services/ai/image/registry.ts',
  'lib/services/ai/video/registry.ts',
]);
const MODEL_RE =
  /(['"])((?:claude-[a-z0-9.-]+)|(?:gpt-[a-z0-9.-]+)|(?:gemini-[a-z0-9.-]+)|(?:o[134](?:-mini|-pro)?)|(?:dall-e-[0-9])|(?:stable-diffusion-[0-9a-z.-]+)|(?:fal-ai\/[a-z0-9./-]+)|(?:(?:anthropic|google|openai|deepseek|meta-llama|mistralai|x-ai|qwen)\/[a-zA-Z0-9.:-]+))\1/g;

interface Site {
  file: string;
  line: number;
  id: string;
}

/** Blank out comments, keeping strings and line numbers. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += n ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '#' && (i === 0 || src[i - 1] === '\n')) {
      // Python / shell comment line (services/ holds some Python).
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Every model-id literal in a value position (not an object key, not a comparison). */
function scanDefaults(): Site[] {
  const sites: Site[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (
          ['node_modules', '__tests__', '__mocks__', 'dist', '.next'].includes(
            e.name
          )
        )
          continue;
        walk(abs);
      } else if (
        /\.(ts|tsx|js|mjs|cjs|py)$/.test(e.name) &&
        !/\.(test|spec)\.[a-z]+$/.test(e.name) &&
        !EXCLUDE.has(rel)
      ) {
        const text = stripComments(fs.readFileSync(abs, 'utf8'));
        const lines = text.split('\n');
        lines.forEach((ln, idx) => {
          for (const m of ln.matchAll(MODEL_RE)) {
            const before = ln.slice(0, m.index);
            const after = ln.slice((m.index ?? 0) + m[0].length);
            if (/^\s*:(?!:)/.test(after) && !/\?\s*$/.test(before)) continue; // object key
            if (/[!=]==?\s*$/.test(before) || /^\s*[!=]==?/.test(after))
              continue; // comparison
            if (/(startsWith|endsWith|includes|indexOf)\(\s*$/.test(before))
              continue;
            if (/\breadonly\s+id\s*=\s*$/.test(before)) continue; // connector id, not a model
            sites.push({ file: rel, line: idx + 1, id: m[2] });
          }
        });
      }
    }
  };
  walk(path.join(ROOT, 'lib'));
  walk(path.join(ROOT, 'services'));
  return sites.sort((a, b) =>
    a.file === b.file
      ? a.line - b.line || a.id.localeCompare(b.id)
      : a.file < b.file
        ? -1
        : 1
  );
}

// ── Registry view (the seam the controls mutate) ─────────────────────────────

interface Registry {
  text: ModelConfig[];
  image: ImageModel[];
}

const realRegistry = (): Registry => ({
  text: PROVIDERS.flatMap(p => getModels(p)),
  image: IMAGE_MODELS,
});

const DATED = /-(?:\d{8}|\d{4}-\d{2}-\d{2})$/;

/** Same matching rule as lib/pipelines/track-cost.ts findRegistryModel: exact, or a date stamp on one side. */
function resolveText(reg: Registry, id: string): ModelConfig | null {
  const exact = reg.text.find(m => m.id === id);
  if (exact) return exact;
  if (DATED.test(id))
    return reg.text.find(m => m.id === id.replace(DATED, '')) ?? null;
  const dated = reg.text.filter(
    m => DATED.test(m.id) && m.id.replace(DATED, '') === id
  );
  return dated.length === 1 ? dated[0] : null;
}

/** Deprecated as of `day`: a recorded deprecation date on or before it, or the flag when no date is recorded. */
function deprecatedAsOf(m: ModelConfig, day: string): boolean {
  if (m.deprecatedDate)
    return m.deprecatedDate.getTime() <= Date.parse(`${day}T23:59:59.999Z`);
  return m.isDeprecated;
}

const imageUsable = (m: ImageModel) => Boolean(m.pricing) && !m.deprecated;

function asOfDates(): string[] {
  const out = new Set<string>([SWEEP.asOf]);
  for (let y = 2026; y <= 2027; y++)
    for (let mo = 1; mo <= 12; mo++)
      out.add(`${y}-${String(mo).padStart(2, '0')}-01`);
  return [...out].sort();
}

// ── Detectors (shared by cases and controls) ─────────────────────────────────

function judgeDeprecated(
  reg: Registry,
  site: Site,
  day: string
): boolean | null {
  const m = resolveText(reg, site.id);
  if (!m) return null;
  return !deprecatedAsOf(m, day);
}

function judgeImageEstimate(
  model: ImageModel,
  dims: { width: number; height: number },
  estimate: typeof estimateImageCostUsd
): { passed: boolean; detail: string } {
  try {
    const usd = estimate(model, dims);
    return model.pricing
      ? { passed: true, detail: `priced ${usd} USD` }
      : { passed: false, detail: `unpriced model costed at ${usd} USD` };
  } catch (err) {
    if (err instanceof UnpricedModelError)
      return model.pricing
        ? {
            passed: true,
            detail: `priced model refused size: ${err.message.slice(0, 80)}`,
          }
        : { passed: true, detail: 'unpriced: refused (UnpricedModelError)' };
    return {
      passed: false,
      detail: `unexpected throw ${String(err).slice(0, 80)}`,
    };
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

const sink = new Sink('G3');
afterAll(() => sink.write());

it('G3 cases', () => {
  const reg = realRegistry();
  const sites = scanDefaults();
  const dates = asOfDates();
  const imageIds = new Set(reg.image.map(m => m.id));

  for (const site of sites) {
    const where = `${site.file}:${site.line}`;
    if (imageIds.has(site.id)) {
      const m = reg.image.find(x => x.id === site.id)!;
      sink.verdict(
        'G3.C3',
        imageUsable(m),
        `${where} image default ${site.id}: pricing=${m.pricing ? 'yes' : 'none'} deprecated=${Boolean(m.deprecated)}`,
        where
      );
      continue;
    }
    const m = resolveText(reg, site.id);
    sink.verdict(
      'G3.C2',
      Boolean(m),
      m
        ? `${where} ${site.id} -> ${m.id}`
        : `${where} ${site.id} is not in the model registry`,
      where
    );
    for (const day of dates) {
      const ok = judgeDeprecated(reg, site, day);
      sink.verdict(
        'G3.C1',
        ok,
        ok === null
          ? `${where} ${site.id} unregistered; deprecation as of ${day} cannot be judged`
          : `${where} ${site.id} -> ${m!.id} as of ${day}: ${ok ? 'current' : `deprecated (${m!.deprecatedDate?.toISOString().slice(0, 10) ?? 'flag'}), replacement ${m!.replacementModel ?? 'none'}`}`,
        where
      );
    }
  }

  const sizes = [256, 512, 768, 1024, 1536, 2048, 4096];
  for (const m of reg.image)
    for (const w of sizes)
      for (const h of sizes) {
        const v = judgeImageEstimate(
          m,
          { width: w, height: h },
          estimateImageCostUsd
        );
        sink.verdict('G3.C4', v.passed, `${m.id} ${w}x${h}: ${v.detail}`);
      }

  const prefs = [undefined, ...reg.image.map(m => m.id), 'unknown-model'];
  for (const preferred of prefs)
    for (const needsReferences of [false, true])
      for (const needsLora of [false, true]) {
        let got: ImageModel | null = null;
        let err = '';
        try {
          got = selectImageModel({ needsReferences, needsLora, preferred });
        } catch (e) {
          err = String(e).slice(0, 80);
        }
        sink.verdict(
          'G3.C5',
          got ? imageUsable(got) : true,
          `preferred=${preferred ?? '-'} refs=${needsReferences} lora=${needsLora} -> ${got ? `${got.id} pricing=${got.pricing ? 'yes' : 'none'} deprecated=${Boolean(got.deprecated)}` : `refused (${err})`}`
        );
      }

  for (const m of reg.text)
    for (const day of dates) {
      if (!deprecatedAsOf(m, day)) {
        sink.verdict('G3.C6', true, `${m.id} current as of ${day}`);
        continue;
      }
      const r = m.replacementModel
        ? resolveText(reg, m.replacementModel)
        : null;
      sink.verdict(
        'G3.C6',
        Boolean(r && !deprecatedAsOf(r, day)),
        `${m.id} deprecated as of ${day}; replacement ${m.replacementModel ?? 'none'} ${r ? (deprecatedAsOf(r, day) ? 'also deprecated' : 'current') : 'unregistered'}`
      );
    }
});

it('G3 planted controls', () => {
  const reg = realRegistry();
  const day = SWEEP.asOf;

  // C01: a deprecated default inserted into the source (claude-3-opus has a
  // recorded deprecation date).
  {
    const id = 'G3-C01';
    const planted: Site = {
      file: 'lib/planted/default.ts',
      line: 1,
      id: disarmed(id) ? 'claude-sonnet-5' : 'claude-3-opus',
    };
    const ok = judgeDeprecated(reg, planted, day);
    sink.control(
      id,
      'G3.C1',
      ok === false,
      `default ${planted.id} as of ${day}: ${ok}`
    );
  }

  // C02: the registry retires a model that live defaults still name
  // (claude-sonnet-4-6 given a past deprecation date).
  {
    const id = 'G3-C02';
    const mutated: Registry = {
      ...reg,
      text: reg.text.map(m =>
        m.id === 'claude-sonnet-4-6' && !disarmed(id)
          ? { ...m, isDeprecated: true, deprecatedDate: new Date('2026-01-01') }
          : m
      ),
    };
    const sites = scanDefaults().filter(s => s.id === 'claude-sonnet-4-6');
    const red = sites.filter(s => judgeDeprecated(mutated, s, day) === false);
    sink.control(
      id,
      'G3.C1',
      sites.length > 0 && red.length > 0,
      `${red.length}/${sites.length} claude-sonnet-4-6 defaults flagged`
    );
  }

  // C03: an estimator that prices an unpriced model at 0 instead of refusing.
  {
    const id = 'G3-C03';
    const lenient: typeof estimateImageCostUsd = (m, dims) =>
      !m.pricing && !disarmed(id) ? 0 : estimateImageCostUsd(m, dims);
    const unpriced = reg.image.filter(m => !m.pricing);
    const red = unpriced.filter(
      m => !judgeImageEstimate(m, { width: 1024, height: 1024 }, lenient).passed
    );
    sink.control(
      id,
      'G3.C4',
      unpriced.length > 0 && red.length === unpriced.length,
      `${red.length}/${unpriced.length} unpriced models flagged`
    );
  }

  // C04: an unregistered model id planted as a default.
  {
    const id = 'G3-C04';
    const planted: Site = {
      file: 'lib/planted/unregistered.ts',
      line: 1,
      id: disarmed(id) ? 'claude-opus-5' : 'gpt-9-imaginary',
    };
    sink.control(
      id,
      'G3.C2',
      !resolveText(reg, planted.id),
      `default ${planted.id} registered=${Boolean(resolveText(reg, planted.id))}`
    );
  }
});
