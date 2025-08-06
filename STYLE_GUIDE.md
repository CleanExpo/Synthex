# Synthex Style Guide

## Design System Overview
This document captures the approved visual design system for Synthex - Auto Marketing Platform.

## Core Design Principles
- **Modern Glassmorphism**: Semi-transparent surfaces with backdrop blur
- **Professional Microsoft Fluent Icons**: Clean, enterprise-grade iconography
- **Smooth Animations**: Subtle transitions and hover effects
- **Dark Theme First**: Optimized for reduced eye strain

## Color Palette

### Primary Colors
```css
--primary: #2563eb;        /* Blue */
--primary-hover: #1e40af;  /* Darker blue for hover states */
```

### Background Colors
```css
--bg-primary: #0f172a;     /* Main background (slate-900) */
--bg-secondary: #1e293b;   /* Secondary surfaces (slate-800) */
--bg-card: rgba(255, 255, 255, 0.03); /* Card backgrounds */
```

### Text Colors
```css
--text-primary: #ffffff;   /* Primary text */
--text-secondary: #a0a0a0; /* Secondary text */
--text-muted: #6b7280;     /* Muted text */
```

### Accent Colors
```css
--accent-blue: #3b82f6;
--accent-green: #10b981;
--accent-purple: #8b5cf6;
--accent-pink: #ec4899;
```

## Typography
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Sizes
- Headings: 2.5rem (h1), 2rem (h2), 1.5rem (h3)
- Body: 1rem
- Small: 0.875rem

## Component Styles

### Cards
```css
.card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}
```

### Buttons
```css
.btn-primary {
  background: linear-gradient(135deg, #6366f1, #5558e3);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}
```

### Input Fields
```css
.input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  transition: all 0.3s ease;
}

.input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: #6366f1;
  outline: none;
}
```

## Layout Patterns

### Navigation
- Fixed top navigation with glassmorphism effect
- Logo on the left, navigation items centered, user menu on the right
- Mobile-responsive hamburger menu

### Grid System
- 12-column grid for desktop
- 1-column stack for mobile
- 24px gap between elements

### Spacing
- Base unit: 8px
- Common spacings: 8px, 16px, 24px, 32px, 48px

## Animation Guidelines

### Transitions
```css
transition: all 0.3s ease;
```

### Hover Effects
- Subtle scale: `transform: scale(1.02)`
- Lift effect: `transform: translateY(-2px)`
- Glow effect: `box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3)`

## Icon Usage
Using Microsoft Fluent System Icons:
- Navigation: Home, BarChart, Users, Settings
- Actions: Plus, Edit, Trash, Share
- Status: CheckCircle, XCircle, AlertCircle

## Responsive Breakpoints
```css
--mobile: 640px;
--tablet: 768px;
--desktop: 1024px;
--wide: 1280px;
```

## Special Effects

### Gradient Overlays
```css
background: linear-gradient(
  135deg,
  rgba(99, 102, 241, 0.1),
  rgba(139, 92, 246, 0.1)
);
```

### Blur Effects
```css
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
```

### Glow Effects
```css
box-shadow: 
  0 0 20px rgba(99, 102, 241, 0.5),
  0 0 40px rgba(99, 102, 241, 0.3);
```

## Do's and Don'ts

### Do's
- ✅ Use consistent spacing based on 8px grid
- ✅ Apply subtle animations for better UX
- ✅ Maintain high contrast for accessibility
- ✅ Use glassmorphism effects sparingly
- ✅ Keep the interface clean and uncluttered

### Don'ts
- ❌ Don't use bright, saturated colors
- ❌ Don't overuse animations
- ❌ Don't mix icon styles
- ❌ Don't use pure black (#000000)
- ❌ Don't forget hover states

## Implementation Notes
- All colors use CSS custom properties for easy theming
- Animations are GPU-accelerated for performance
- Components are built with accessibility in mind
- Dark theme is the default and primary focus