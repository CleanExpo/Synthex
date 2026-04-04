# Design System Documentation

## 🎨 Visual Identity

### Color System

#### Primary Colors
```css
--primary-main: #0066CC;
--primary-light: #3384D9;
--primary-dark: #0052A3;
--primary-contrast: #FFFFFF;
```

#### Secondary Colors
```css
--secondary-main: #6B46C1;
--secondary-light: #8B6BD1;
--secondary-dark: #5234A1;
--secondary-contrast: #FFFFFF;
```

#### Neutral Colors
```css
--neutral-100: #FFFFFF;
--neutral-200: #F5F5F7;
--neutral-300: #E5E5E7;
--neutral-400: #D1D1D6;
--neutral-500: #86868B;
--neutral-600: #6E6E73;
--neutral-700: #48484A;
--neutral-800: #2C2C2E;
--neutral-900: #1D1D1F;
```

#### Semantic Colors
```css
--success: #34C759;
--warning: #FFB800;
--error: #FF3B30;
--info: #007AFF;
```

### Typography

#### Font Families
```css
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-secondary: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Courier New', monospace;
```

#### Font Sizes
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
```

#### Font Weights
```css
--font-light: 300;
--font-regular: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing System
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

### Border Radius
```css
--radius-sm: 0.125rem;  /* 2px */
--radius-md: 0.25rem;   /* 4px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-2xl: 1rem;     /* 16px */
--radius-full: 9999px;
```

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

---

## 🧩 Component Library

### Buttons

#### Primary Button
```html
<button class="btn btn-primary">
  Primary Action
</button>
```

```css
.btn-primary {
  background: var(--primary-main);
  color: var(--primary-contrast);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-weight: var(--font-semibold);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

#### Secondary Button
```html
<button class="btn btn-secondary">
  Secondary Action
</button>
```

#### Ghost Button
```html
<button class="btn btn-ghost">
  Ghost Action
</button>
```

### Cards

#### Basic Card
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
  </div>
  <div class="card-body">
    Content goes here
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

#### Persona Card
```html
<div class="card card-persona">
  <div class="persona-avatar">
    <img src="avatar.jpg" alt="Persona">
  </div>
  <div class="persona-details">
    <h4 class="persona-name">Sarah Johnson</h4>
    <p class="persona-role">Marketing Manager</p>
    <ul class="persona-traits">
      <li>Tech-savvy</li>
      <li>Data-driven</li>
      <li>Creative</li>
    </ul>
  </div>
</div>
```

### Forms

#### Input Field
```html
<div class="form-group">
  <label for="input" class="form-label">Label</label>
  <input type="text" id="input" class="form-input" placeholder="Enter text">
  <span class="form-helper">Helper text</span>
</div>
```

#### Select Dropdown
```html
<div class="form-group">
  <label for="select" class="form-label">Select Option</label>
  <select id="select" class="form-select">
    <option>Option 1</option>
    <option>Option 2</option>
    <option>Option 3</option>
  </select>
</div>
```

### Navigation

#### Top Navigation
```html
<nav class="nav-top">
  <div class="nav-brand">
    <img src="logo.svg" alt="Logo">
  </div>
  <ul class="nav-menu">
    <li class="nav-item active">Dashboard</li>
    <li class="nav-item">Projects</li>
    <li class="nav-item">Assets</li>
  </ul>
  <div class="nav-actions">
    <button class="btn btn-primary">New Project</button>
  </div>
</nav>
```

#### Sidebar Navigation
```html
<aside class="sidebar">
  <div class="sidebar-section">
    <h5 class="sidebar-title">Workspace</h5>
    <ul class="sidebar-menu">
      <li class="sidebar-item active">
        <i class="icon-canvas"></i>
        <span>Canvas</span>
      </li>
      <li class="sidebar-item">
        <i class="icon-assets"></i>
        <span>Assets</span>
      </li>
    </ul>
  </div>
</aside>
```

---

## 📐 Layout System

### Grid System
```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
```

### Flexbox Utilities
```css
.flex { display: flex; }
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
```

---

## 🎭 Animation & Transitions

### Transitions
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

### Animations
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## ♿ Accessibility Guidelines

### Color Contrast
- Text on background: minimum 4.5:1 ratio
- Large text on background: minimum 3:1 ratio
- Interactive elements: minimum 3:1 ratio

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--primary-main);
  outline-offset: 2px;
}
```

### ARIA Labels
```html
<button aria-label="Close dialog" class="btn-close">
  <svg aria-hidden="true">...</svg>
</button>
```

### Keyboard Navigation
- All interactive elements accessible via Tab
- Escape key closes modals/dropdowns
- Arrow keys navigate menus
- Enter/Space activate buttons

---

## 📱 Responsive Design

### Breakpoints
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### Media Queries
```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

---

## 🚀 Performance Guidelines

### Asset Optimization
- Images: WebP format with fallbacks
- Icons: SVG sprites
- Fonts: Variable fonts when possible
- CSS: Minified and purged

### Loading States
```html
<div class="skeleton">
  <div class="skeleton-line"></div>
  <div class="skeleton-line"></div>
  <div class="skeleton-line"></div>
</div>
```

---

## 📋 Implementation Checklist

- [ ] Color system implemented
- [ ] Typography scale applied
- [ ] Component library built
- [ ] Responsive breakpoints tested
- [ ] Accessibility audit passed
- [ ] Performance metrics met
- [ ] Cross-browser tested
- [ ] Documentation complete