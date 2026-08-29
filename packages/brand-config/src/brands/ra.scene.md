---
version: alpha
name: RestoreAssist Scene
description: Optional 3D / WebGL identity for RestoreAssist. Restraint-first — 3D used only for evidence visualisation (moisture-map field, NIR signal field). Never decorative.
renderer: react-three-fiber
camera:
  default:
    type: perspective
    fov: 35
    position: [0, 0.5, 4]
    target: [0, 0, 0]
  evidence:
    type: orthographic
    zoom: 1.4
    position: [0, 2, 2]
lights:
  default:
    ambient:
      intensity: 0.4
      color: '{ra.design.md:colors.neutral-50}'
    key:
      type: directional
      intensity: 1.2
      position: [3, 5, 4]
      color: '#FFFFFF'
    rim:
      type: directional
      intensity: 0.6
      position: [-3, 2, -2]
      color: '{ra.design.md:colors.primary}'
materials:
  evidence-surface:
    type: physical
    color: '{ra.design.md:colors.neutral-100}'
    roughness: 0.6
    metalness: 0.1
    transmission: 0.0
  signal-particle:
    type: basic
    color: '{ra.design.md:colors.accent}'
    transparent: true
    opacity: 0.85
  identifier-glass:
    type: physical
    color: '{ra.design.md:colors.secondary}'
    roughness: 0.05
    metalness: 0.0
    transmission: 0.92
    thickness: 0.4
scenes:
  hero-moisture-map:
    description: 'Subtle horizontal field of low-relief geometry that reads as moisture distribution. Camera holds; signal particles drift along signature axis (x).'
    camera: default
    background: '{ra.design.md:colors.primary}'
    elements:
      - type: instanced-mesh
        geometry: plane
        material: evidence-surface
        count: 64
        layout: grid
      - type: particle-field
        material: signal-particle
        count: 200
        motion:
          axis: x
          speed: 0.04
  evidence-card:
    description: 'Single NIR identifier rendered as transmissive glass card with the code embossed.'
    camera: evidence
    background: '{ra.design.md:colors.neutral-50}'
    elements:
      - type: rounded-box
        material: identifier-glass
        size: [1.4, 0.4, 0.08]
post:
  default:
    bloom:
      intensity: 0.15
      threshold: 0.85
      radius: 0.4
    vignette:
      darkness: 0.2
performance:
  targetFps: 60
  maxDrawCalls: 80
  maxPolygons: 60000
  raycaster: false
  prefersReducedMotion: pause-particles
---

## Overview

3D is a constrained tool for RestoreAssist. Two scene presets (`hero-moisture-map` and `evidence-card`) cover every legitimate use. Anything else gets pushed back to flat composition. The point of restraint is that when 3D _does_ appear, it carries weight — it's a piece of evidence, not decoration.

## Camera presets

- `default` — perspective, slightly above eye level. Natural for hero panels.
- `evidence` — orthographic, top-down-ish. Suggests inspection-instrument (microscope, NIR scanner).

## Lighting

Three-point rig. Key light from above-right (sun-equivalent for field work). Rim light is tinted with the accent, light tan `{ra.design.md:colors.accent}` (`#D4A574`) — the value the dark variant lifts to primary, so the rim reads on the `#050505` backstop where navy would disappear. Ambient is the warm neutral `{ra.design.md:colors.neutral-50}` (`#F5F5F4`), so shadows stay clinical without going cold.

> Corrected 29/08/2026. This paragraph previously specified a `#E55A2B` candy-orange rim and a cold `#F5F7F8` ambient —
> both from the superseded RA-1985 palette that `ra.ts:1-9` explicitly overrides. The token references elsewhere in
> this file were already correct; only this prose was stale, so an agent reading the prose rather than the tokens
> would have built a candy-orange RestoreAssist scene. Never reintroduce a raw hex here without a token beside it.

## Materials

- `evidence-surface` — physical material, low metalness, mid roughness. Reads as plaster/drywall (the substrates RA inspects).
- `signal-particle` — flat colour, transparent. Reads as NIR data point — never lit.
- `identifier-glass` — high transmission, very low roughness. Reads as inspection-instrument readout.

## Scenes

**hero-moisture-map** — used in the opening of NIR-explainer videos and at the top of long-form web pages. Particles drift on the brand's signature axis (`x`), reinforcing the sweep identity in 3D space.

**evidence-card** — used to display a single NIR identifier as a transmissive glass artifact. The code text is embossed into the geometry, not floated as a label.

## Post-processing

Subtle bloom (intensity 0.15) catches accent-coloured highlights. Vignette darkens edges 20% to keep focus on centre — appropriate for evidence presentation.

## Performance

Target 60fps. Hard ceiling at 80 draw calls and 60k polygons. Raycaster disabled by default (no interaction needed in motion-graphic use). Reduced-motion pauses particles only — the geometry stays so the scene still reads.

## Do's and Don'ts

**Do:** use 3D for evidence and signal visualisation. Tint rim light with brand primary. Respect performance budget.
**Don't:** never use 3D as decoration. Never load textures over 1024px. Never use shaders without a measurable performance budget.
