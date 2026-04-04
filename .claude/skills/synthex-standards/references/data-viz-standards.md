# Data Visualisation Standards — Synthex Charts & Graphs

## Anti-Patterns (NEVER produce these)

- Chart.js / Recharts default colour palette (sequential blues, reds, greens)
- White or light chart backgrounds (Synthex renders charts over dark surfaces)
- Grid lines heavier than 1px or opacity > 0.1
- Legends inside the chart area obscuring data
- No axis labels or missing units
- Tooltips showing raw unformatted numbers (1234567 instead of 1,234,567)
- Pie charts for more than 4 categories (use bar chart instead)
- Hardcoded pixel widths — always responsive
- Chart.js default blue #4472ca or default red #ff6384

## Synthex Chart Palette

| Role           | Colour       | Hex       | Area Fill                   |
| -------------- | ------------ | --------- | --------------------------- |
| Primary series | Brand orange | `#f97316` | `rgba(249, 115, 22, 0.15)`  |
| Comparison     | Emerald      | `#10b981` | `rgba(16, 185, 129, 0.15)`  |
| Third series   | Sky blue     | `#38bdf8` | `rgba(56, 189, 248, 0.15)`  |
| Fourth         | Purple       | `#a78bfa` | `rgba(167, 139, 250, 0.15)` |
| Fifth          | Pink         | `#f472b6` | `rgba(244, 114, 182, 0.15)` |

## Chart Anatomy Standards

```typescript
// Background — always transparent
background: 'transparent'

// Grid lines — horizontal only, very subtle
grid: {
  color: 'rgba(255, 255, 255, 0.06)',
  borderDash: [4, 4],
  drawBorder: false,
}

// Axes
ticks: {
  color: '#64748b',
  font: { size: 11, family: 'Space Grotesk' },
}

// Tooltips
tooltip: {
  backgroundColor: '#1e293b',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
  titleColor: '#f8fafc',
  bodyColor: '#94a3b8',
  padding: 12,
}

// Number formatting in tooltips and axes
value.toLocaleString('en-AU')           // general numbers
`$${value.toLocaleString('en-AU')}`     // currency (AUD)
`${value.toFixed(1)}%`                  // percentages
```

## Responsive Sizing

```typescript
// Always fill container, never fixed pixel width
width: '100%';
height: 'auto';
minHeight: 200; // px — floor for small containers
aspectRatio: 16 / 9; // default for full-width charts
aspectRatio: 4 / 3; // for smaller panels
```

## Annotations

```typescript
// Labels, callouts
color: '#94a3b8'
font: { size: 12, family: 'Space Grotesk' }

// Threshold / target lines
borderColor: 'rgba(249, 115, 22, 0.5)'  // orange at 50% opacity
borderDash: [6, 3]
```
