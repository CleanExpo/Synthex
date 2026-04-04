# Hero Image Brief — Synthex AI Marketing Assistant

## Asset Details

- **Output format:** PNG with transparency or dark background
- **Dimensions:** 2400×1600px (3:2 ratio), retina-ready
- **Placement:** Landing page hero section, right side of viewport

## Visual Concept

A sleek 3D-rendered AI marketing assistant — not a humanoid robot, but an abstract,
intelligent form. Think floating geometric crystalline structure with visible data streams.

## Art Direction

**Background:** Deep space-dark — `#0f172a` (Synthex slate). No pure black.

**Hero element:** A central floating 3D crystalline core:

- Primary shape: icosahedron or truncated sphere with faceted glass surfaces
- Core glow: radial warm orange `#f97316` emanating from the centre
- Surface: semi-transparent glass panels with subtle iridescence
- Depth: Multiple layers creating parallax effect

**Floating UI elements (arranged around the core):**

- 3 glassmorphic dashboard cards floating at different z-depths
- Each card showing micro data: sparkline charts, percentages, status dots
- Cards use `rgba(255,255,255,0.08)` fill, `rgba(255,255,255,0.15)` border
- Subtle motion blur on card edges suggesting movement

**Lighting:**

- Primary: warm orange point light from inside the core
- Secondary: cool blue rim light from upper-left
- Ambient: very dark, almost nothing

**Colour palette:**

- Background: `#0f172a`
- Primary accent: `#f97316` (orange)
- Secondary accent: `#60a5fa` (blue)
- Surface: `rgba(255,255,255,0.08)`
- Text on cards: `rgba(255,255,255,0.7)`

**Style references:**

- NOT: humanoid robots, generic AI stock images, hard sci-fi
- YES: Framer.com hero, Linear.app product shots, Vercel dark mode aesthetic

## What to Avoid

- Cheesy robot arms or faces
- Bright white backgrounds
- Clipart-style illustrations
- Generic "neural network" grid patterns
- Text elements (handled by the page)

## Delivery Checklist

- [ ] 2400×1600 PNG (primary)
- [ ] 1200×800 PNG (retina fallback for <Image> component)
- [ ] SVG composition (if achievable without rasterisation)
- Drop shadow handled by CSS (`drop-shadow(0 25px 50px rgba(249,115,22,0.25))`)
