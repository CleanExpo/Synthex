# Synthex 3D Icon System

## Approach

Custom SVG icons with isometric 3D depth treatment. Each icon has 3 layers:

1. **Base face** — primary colour (gradient fill)
2. **Depth shadow** — darker offset shape giving 3D depth
3. **Highlight** — semi-transparent white top-left facet

## Grid

- ViewBox: `0 0 48 48`
- Display sizes: 24px, 32px, 48px (scale via width/height)
- Inner art area: 8px margin each side (art within 32×32 centred in 48×48)

## Colour palette

- Feature/accent icons: gradient `#f97316` → `#ea580c` (Synthex orange)
- Navigation/neutral icons: gradient `#334155` → `#1e293b` (Synthex slate)
- Depth shadow: `rgba(0,0,0,0.35)` offset 1–2px down-right
- Highlight: `rgba(255,255,255,0.18)` top-left corner facet
- Platform icons: native brand colours with depth treatment

## Component: Icon3D

Usage:

```tsx
<Icon3D name="home" category="navigation" size={24} />
<Icon3D name="sparkles" category="features" size={32} />
```

## File structure

```
public/icons/3d/
├── navigation/   home, menu, settings, chevron-down
├── features/     sparkles, bar-chart, network, rocket, target, brain
├── platforms/    twitter, instagram, linkedin, tiktok, facebook, youtube
├── actions/      plus, copy, edit, trash, arrow-right
└── status/       check, check-circle, alert-triangle, alert-circle, loader
```
