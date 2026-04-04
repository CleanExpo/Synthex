# SYNTHEX Design System v4.0

> AI Marketing Platform - Professional Dark Theme
> Inspired by clean corporate AI aesthetics with particle effects

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Effects & Animations](#effects--animations)
7. [Usage Guidelines](#usage-guidelines)

---

## Design Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **OLED Optimized** | True black backgrounds (#000) for maximum contrast and battery efficiency |
| **Glass Morphism** | Layered translucent surfaces with blur effects |
| **Professional Tech** | Clean, corporate aesthetic with AI/futuristic touches |
| **High Contrast** | Clear visual hierarchy with proper accessibility |
| **Particle Dynamics** | Subtle dispersion effects suggesting digital transformation |

### Visual Identity

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   SYNTHEX = Professional + Futuristic + Intelligent         │
│                                                             │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐                  │
│   │ OLED    │ + │ GLASS   │ + │PARTICLE │ = Brand          │
│   │ Black   │   │ Layers  │   │ Effects │                  │
│   └─────────┘   └─────────┘   └─────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Color System

### Brand Colors

```css
/* Primary - Vibrant Violet (AI/Tech signature) */
--synthex-primary: rgb(139, 92, 246);      /* #8B5CF6 */
--synthex-primary-light: rgb(167, 139, 250); /* #A78BFA */
--synthex-primary-dark: rgb(109, 40, 217);  /* #6D28D9 */

/* Secondary - Electric Cyan (Data/Analytics) */
--synthex-secondary: rgb(6, 182, 212);      /* #06B6D4 */

/* Accent - Ruby Red (CTAs/Highlights) */
--synthex-accent: rgb(220, 38, 38);         /* #DC2626 */
```

### Color Usage

| Color | Usage | Example |
|-------|-------|---------|
| Primary Violet | CTAs, highlights, focus states | Buttons, links, active states |
| Secondary Cyan | Data visualization, secondary actions | Charts, badges, info |
| Accent Red | Urgent CTAs, warnings, promotional | "Try Free", alerts |
| White | Primary text, icons | Headlines, body text |
| Gray scale | Secondary text, borders, surfaces | Descriptions, dividers |

### Surface System (Depth)

```
┌─ Surface 0: OLED Black (#000000) ─ Deepest background
├─ Surface 1: Gray 950 (#0A0A0C) ─ Base background
├─ Surface 2: Gray 900 (#111115) ─ Elevated cards
├─ Surface 3: Gray 800 (#1F1F26) ─ Popovers/modals
└─ Surface 4: Gray 700 (#373741) ─ Hover states
```

### Glass Surfaces

```css
--glass-surface-1: rgba(255, 255, 255, 0.03);  /* Subtle */
--glass-surface-2: rgba(255, 255, 255, 0.06);  /* Default cards */
--glass-surface-3: rgba(255, 255, 255, 0.10);  /* Elevated */
--glass-surface-4: rgba(255, 255, 255, 0.14);  /* Premium */
--glass-surface-hover: rgba(255, 255, 255, 0.18); /* Hover */
```

---

## Typography

### Font Stack

```css
--font-display: 'Inter', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Type Scale

| Class | Size | Weight | Use Case |
|-------|------|--------|----------|
| `.display-xl` | 72px | 900 (Black) | Hero headlines |
| `.display-lg` | 60px | 700 (Bold) | Page titles |
| `.display-md` | 48px | 700 (Bold) | Section headers |
| `.heading-xl` | 36px | 600 | Major sections |
| `.heading-lg` | 30px | 600 | Card titles |
| `.heading-md` | 24px | 600 | Subsections |
| `.heading-sm` | 20px | 500 | Small headers |
| `.body-lg` | 18px | 400 | Lead paragraphs |
| `.body-md` | 16px | 400 | Body text |
| `.body-sm` | 14px | 400 | Secondary text |
| `.label` | 14px | 500 | Labels (uppercase) |
| `.caption` | 12px | 400 | Captions |

### Headline Examples

```html
<!-- Display headline with gradient -->
<h1 class="display-xl text-gradient-primary">
  AI Marketing
</h1>

<!-- Pill-style headline (inspired by reference) -->
<span class="pill-headline">AI MARKETING</span>
<span class="pill-headline-light">AGENCY GUIDE</span>
```

---

## Spacing & Layout

### Spacing Scale (8px base)

```css
--space-1: 4px    --space-6: 24px   --space-14: 56px
--space-2: 8px    --space-8: 32px   --space-16: 64px
--space-3: 12px   --space-10: 40px  --space-20: 80px
--space-4: 16px   --space-12: 48px  --space-24: 96px
```

### Section Padding

```css
.p-section { padding: 80px 24px; }   /* Full sections */
.p-container { padding: 32px; }       /* Containers */
.p-card { padding: 24px; }            /* Cards */
```

### Border Radius

```css
--radius-sm: 4px;     /* Subtle rounding */
--radius-md: 8px;     /* Standard elements */
--radius-lg: 12px;    /* Cards, buttons */
--radius-xl: 16px;    /* Containers */
--radius-2xl: 24px;   /* Hero elements */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Components

### Buttons

```html
<!-- Primary (Gradient with glow) -->
<button class="btn btn-primary">Get Started</button>

<!-- Secondary (Glass) -->
<button class="btn btn-secondary">Learn More</button>

<!-- Outline -->
<button class="btn btn-outline">View Demo</button>

<!-- Ghost -->
<button class="btn btn-ghost">Cancel</button>

<!-- Accent (High visibility CTA) -->
<button class="btn btn-accent">Try Free</button>

<!-- Pill variant -->
<button class="btn btn-primary btn-pill">Subscribe</button>

<!-- Sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-lg">Large</button>
<button class="btn btn-primary btn-xl">Extra Large</button>
```

### Cards

```html
<!-- Basic Card -->
<div class="card p-card">
  <h3 class="heading-md">Card Title</h3>
  <p class="body-md">Card content...</p>
</div>

<!-- Glass Card -->
<div class="card-glass p-card">
  <h3 class="heading-md">Glass Card</h3>
</div>

<!-- Premium Card (with glow) -->
<div class="card-premium p-card">
  <h3 class="heading-md">Premium Feature</h3>
</div>

<!-- Featured Card -->
<div class="card-featured">
  <h2 class="heading-xl">Featured Content</h2>
</div>
```

### Pill Badges

```html
<!-- Default -->
<span class="pill-badge">New Feature</span>

<!-- Primary -->
<span class="pill-badge pill-badge-primary">AI Powered</span>

<!-- Accent -->
<span class="pill-badge pill-badge-accent">Limited Time</span>
```

### Inputs

```html
<!-- Standard Input -->
<input type="text" class="input" placeholder="Enter email...">

<!-- Large Input -->
<input type="text" class="input input-lg" placeholder="Search...">
```

### Stat Cards

```html
<div class="stat-card">
  <span class="stat-card-label">Total Revenue</span>
  <span class="stat-card-value">$24,500</span>
  <span class="stat-card-change positive">+12.5%</span>
</div>
```

### Avatars

```html
<div class="avatar avatar-md">
  <img src="..." alt="User">
</div>

<!-- Avatar Group -->
<div class="avatar-group">
  <div class="avatar avatar-sm">...</div>
  <div class="avatar avatar-sm">...</div>
  <div class="avatar avatar-sm">...</div>
</div>
```

---

## Effects & Animations

### Particle Effects

```html
<!-- Container with particle background -->
<div class="particle-container">
  <div class="particles-static"></div>
  <!-- Content -->
</div>

<!-- Dispersion effect (like reference robot) -->
<div class="dispersion-effect">
  <!-- Element that appears to dissolve -->
</div>

<!-- Grid pattern overlay -->
<div class="relative">
  <div class="grid-overlay"></div>
  <!-- Content -->
</div>
```

### Background Gradients

```html
<!-- Radial gradient -->
<section class="bg-gradient-radial">...</section>

<!-- Spotlight from top -->
<section class="bg-gradient-spotlight">...</section>

<!-- Mesh gradient -->
<section class="bg-gradient-mesh">...</section>
```

### Text Gradients

```html
<!-- Primary gradient text -->
<h1 class="display-xl text-gradient-primary">
  AI Marketing Platform
</h1>

<!-- Animated shine effect -->
<span class="text-gradient-shine">Premium</span>
```

### Animations

```html
<!-- Fade up on scroll -->
<div class="animate-fade-up">Content</div>

<!-- Scale in -->
<div class="animate-scale-in">Content</div>

<!-- Staggered children -->
<div class="stagger">
  <div class="animate-fade-up">Item 1</div>
  <div class="animate-fade-up">Item 2</div>
  <div class="animate-fade-up">Item 3</div>
</div>

<!-- Hover effects -->
<div class="card hover-lift">Lifts on hover</div>
<div class="card hover-glow">Glows on hover</div>
```

### Shadow & Glow

```css
/* Elevation shadows */
box-shadow: var(--shadow-md);
box-shadow: var(--shadow-lg);
box-shadow: var(--shadow-xl);

/* Glow effects */
box-shadow: var(--glow-primary-sm);
box-shadow: var(--glow-primary-md);
box-shadow: var(--glow-primary-lg);
```

---

## Usage Guidelines

### Do's ✅

1. **Use OLED black for backgrounds** - Maximum contrast, true dark mode
2. **Apply glass effects sparingly** - 2-3 layers maximum per view
3. **Use gradients for emphasis** - Headlines, CTAs, feature highlights
4. **Add particle effects to hero sections** - Creates AI/tech atmosphere
5. **Maintain high contrast** - Text should be clearly readable
6. **Use pill shapes for badges/tags** - Modern, clean aesthetic
7. **Stagger animations** - Creates smooth, professional feel

### Don'ts ❌

1. **Don't overuse glow effects** - Keep them for key elements only
2. **Don't mix too many colors** - Stick to primary + secondary + accent
3. **Don't use low contrast text** - Minimum gray-400 on dark backgrounds
4. **Don't animate everything** - Reserve for meaningful interactions
5. **Don't use harsh borders** - Keep borders subtle (8-15% opacity)
6. **Don't ignore accessibility** - Respect reduced motion preferences

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ HERO SECTION                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ bg-gradient-spotlight + particle-container              │ │
│ │                                                         │ │
│ │ ┌─────────────────┐                                     │ │
│ │ │ pill-badge      │  AI-Powered Platform                │ │
│ │ └─────────────────┘                                     │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ display-xl text-gradient-primary                    │ │ │
│ │ │ Transform Your Marketing                            │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ body-lg                                             │ │ │
│ │ │ Description text in gray-300                        │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ ┌───────────────┐  ┌───────────────┐                    │ │
│ │ │ btn-primary   │  │ btn-secondary │                    │ │
│ │ │ Get Started   │  │ Watch Demo    │                    │ │
│ │ └───────────────┘  └───────────────┘                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FEATURES SECTION                                            │
│                                                             │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│ │ card-glass    │ │ card-glass    │ │ card-glass    │      │
│ │ hover-lift    │ │ hover-lift    │ │ hover-lift    │      │
│ │               │ │               │ │               │      │
│ │ Icon          │ │ Icon          │ │ Icon          │      │
│ │ heading-md    │ │ heading-md    │ │ heading-md    │      │
│ │ body-sm       │ │ body-sm       │ │ body-sm       │      │
│ └───────────────┘ └───────────────┘ └───────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Accessibility Checklist

- [ ] Contrast ratio minimum 4.5:1 for body text
- [ ] Contrast ratio minimum 3:1 for large text
- [ ] Focus states visible with keyboard navigation
- [ ] Reduced motion respected via `prefers-reduced-motion`
- [ ] Touch targets minimum 44x44px on mobile
- [ ] Skip links for keyboard navigation
- [ ] ARIA labels for interactive elements

---

## File Structure

```
styles/
├── design-system-v4.css    # Core design tokens & components
├── globals.css             # Base styles & utilities (existing)
└── print.css               # Print styles

docs/
└── DESIGN-SYSTEM.md        # This documentation
```

## Importing

```tsx
// In app/layout.tsx or _app.tsx
import '@/styles/design-system-v4.css';
import '@/app/globals.css';
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v4.0 | 2026-02-10 | Added professional dark theme, particle effects, pill components |
| v3.0 | Previous | Unified design tokens, glass morphism |
| v2.0 | Previous | Initial dark mode support |

---

*SYNTHEX Design System - Building the future of AI marketing*
