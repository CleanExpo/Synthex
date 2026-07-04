/**
 * Tests for the SchematicExplainer composition registration (SYN-41).
 *
 * Mirrors the pure-data assertion style of brand-registry.test.ts: confirms the
 * blueprint composition is registered with valid metadata and well-formed
 * default props. The frame-render proof itself is produced out-of-band by
 * scripts/render-schematic-explainer.ts (selectComposition + renderMedia → MP4).
 */

import { COMPOSITION_REGISTRY } from '../../lib/remotion/registry';
import { SchematicExplainer } from '../../lib/remotion/compositions/SchematicExplainer';
import type { SchematicExplainerProps } from '../../lib/remotion/types';

describe('SchematicExplainer registration', () => {
  const entry = COMPOSITION_REGISTRY.find(c => c.id === 'SchematicExplainer');

  it('is present in the COMPOSITION_REGISTRY', () => {
    expect(entry).toBeDefined();
  });

  it('has valid 16:9 landscape metadata', () => {
    expect(entry?.width).toBe(1920);
    expect(entry?.height).toBe(1080);
    expect(entry?.fps).toBe(30);
    expect(entry?.durationInFrames).toBe(300);
  });

  it('exports a component that binds to the registry id', () => {
    expect(typeof SchematicExplainer).toBe('function');
    expect(SchematicExplainer.name).toBe('SchematicExplainer');
  });

  it('has well-formed blueprint default props', () => {
    const props = entry?.defaultProps as unknown as SchematicExplainerProps;
    expect(props.title).toBeTruthy();
    expect(props.accentColour).toBe('#38BDF8');
    expect(Array.isArray(props.steps)).toBe(true);
    // Composition caps the diagram at 2–4 steps.
    expect(props.steps.length).toBeGreaterThanOrEqual(2);
    expect(props.steps.length).toBeLessThanOrEqual(4);
    for (const step of props.steps) {
      expect(step.label).toBeTruthy();
    }
  });
});
