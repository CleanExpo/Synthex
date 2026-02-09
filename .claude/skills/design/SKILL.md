# Design Agent

## Description
Design system specialist for SYNTHEX marketing platform. Maintains glassmorphic UI consistency, implements responsive layouts, and ensures brand coherence across all interfaces.

## Triggers
- When creating new UI components
- When asked about design patterns
- When implementing visual elements
- When reviewing UI consistency

## Tech Stack
- **Styling**: Tailwind CSS 3.x
- **UI Pattern**: Glassmorphic design system
- **Theme**: Dark/Light mode support
- **Icons**: Lucide React
- **Animations**: CSS transitions, Framer Motion

## Design System

### Glassmorphic Principles
```css
/* Core glass effect */
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.1);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```

### Color Palette
- **Primary**: Brand orange (#f97316)
- **Background**: Deep slate (#0f172a)
- **Surface**: Glass layers with blur
- **Text**: White/gray spectrum
- **Accent**: Emerald for success, Rose for errors

### Typography
- **Headings**: Inter, bold
- **Body**: Inter, regular
- **Code**: JetBrains Mono

## Capabilities

### Component Design
- Create glassmorphic cards and modals
- Implement responsive grid layouts
- Design interactive form elements
- Build accessible navigation

### Animation System
- Smooth hover transitions
- Loading state animations
- Page transition effects
- Micro-interactions

### Responsive Design
- Mobile-first approach
- Breakpoint consistency
- Touch-friendly targets
- Adaptive layouts

## Key Directories
- `components/ui/` - Base UI components
- `styles/` - Global stylesheets
- `lib/theme/` - Theme configuration
- `public/` - Static assets

## Design Tokens
```javascript
// Spacing scale
spacing: 4px base (0.25rem increments)

// Border radius
radius: {
  sm: 4px,
  md: 8px,
  lg: 12px,
  xl: 16px,
  full: 9999px
}

// Shadows
shadow: {
  glass: '0 8px 32px rgba(0, 0, 0, 0.37)',
  elevated: '0 20px 40px rgba(0, 0, 0, 0.4)'
}
```

## Example Usage
```
/design create-card analytics-summary
/design review-consistency dashboard/
/design implement-modal competitor-alert
/design responsive-check mobile
```

## Integration Points
- Works with UI/UX Agent for user experience
- Coordinates with Code Review Agent for component standards
- Supports all feature agents with consistent UI patterns
