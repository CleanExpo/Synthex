# SYNTHEX Design System
**Complete Style Guide for Professional Business Applications**

## 🎨 Color System

### Primary Colors
```css
:root {
    /* Primary Brand Colors */
    --primary-color: #2563eb;           /* Blue 600 - Main brand color */
    --primary-hover: #1d4ed8;           /* Blue 700 - Hover states */
    --secondary-color: #6366f1;         /* Indigo 500 - Secondary accent */
    
    /* Success & Status Colors */
    --accent-color: #059669;            /* Emerald 600 - Success actions */
    --success-color: #10b981;           /* Emerald 500 - Success states */
    --warning-color: #f59e0b;           /* Amber 500 - Warning states */
    --error-color: #ef4444;             /* Red 500 - Error states */
}
```

### Background Colors (Dark Theme)
```css
:root {
    /* Modern Slate Background Palette */
    --bg-primary: #0f172a;              /* Slate 900 - Main background */
    --bg-secondary: #1e293b;            /* Slate 800 - Secondary surfaces */
    --bg-tertiary: #334155;             /* Slate 700 - Elevated surfaces */
    --bg-card: rgba(30, 41, 59, 0.6);   /* Slate 800 with transparency */
    --bg-card-hover: rgba(30, 41, 59, 0.8); /* Hover state for cards */
}
```

### Text Colors
```css
:root {
    /* Professional Text Hierarchy */
    --text-primary: #f8fafc;            /* Slate 50 - Primary text */
    --text-secondary: #cbd5e1;          /* Slate 300 - Secondary text */
    --text-muted: #94a3b8;              /* Slate 400 - Muted/helper text */
    --border-color: rgba(148, 163, 184, 0.2); /* Slate 400 with transparency */
}
```

### Shadows & Effects
```css
:root {
    /* Subtle Professional Shadows */
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

## 📝 Typography

### Font Stack
```css
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
}
```

### Font Import
```html
<!-- Add to <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

### Typography Scale
```css
/* Professional Typography Hierarchy */
.hero h1 {
    font-size: clamp(2.5rem, 5vw, 4rem); /* Responsive hero title */
    font-weight: 800;
    line-height: 1.2;
}

h2 { 
    font-size: 2.5rem; 
    font-weight: 700; 
}

h3 { 
    font-size: 1.5rem; 
    font-weight: 600; 
}

.body-large { 
    font-size: 1.25rem; 
    font-weight: 400; 
}

.body { 
    font-size: 1rem; 
    font-weight: 400; 
}

.body-small { 
    font-size: 0.9rem; 
    font-weight: 500; 
}

.caption { 
    font-size: 0.85rem; 
    font-weight: 500; 
}
```

### Gradient Text Effect
```css
.gradient-text {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

## 🔲 Layout & Spacing

### CSS Reset
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    overflow-x: hidden;
}
```

### Spacing System
```css
/* Consistent Spacing Scale */
:root {
    --space-xs: 0.25rem;    /* 4px */
    --space-sm: 0.5rem;     /* 8px */
    --space-md: 1rem;       /* 16px */
    --space-lg: 1.5rem;     /* 24px */
    --space-xl: 2rem;       /* 32px */
    --space-2xl: 3rem;      /* 48px */
    --space-3xl: 4rem;      /* 64px */
}
```

### Border Radius
```css
:root {
    --radius-sm: 8px;       /* Small elements */
    --radius-md: 12px;      /* Standard buttons/inputs */
    --radius-lg: 16px;      /* Cards */
    --radius-xl: 20px;      /* Modals */
    --radius-2xl: 50px;     /* Pills/badges */
}
```

## 🎯 Components

### Professional Button System
```css
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    overflow: hidden;
}

.btn-primary {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(37, 99, 235, 0.6);
}

.btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    backdrop-filter: blur(10px);
}

.btn-secondary:hover {
    background: var(--bg-card-hover);
    transform: translateY(-1px);
}
```

### Glassmorphism Cards
```css
.card {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 2rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
    transform: scaleX(0);
    transition: transform 0.3s ease;
}

.card:hover::before {
    transform: scaleX(1);
}

.card:hover {
    transform: translateY(-5px);
    background: var(--bg-card-hover);
    box-shadow: var(--shadow-hover);
}
```

### Professional Forms
```css
.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
}

.form-group input {
    width: 100%;
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.3s ease;
}

.form-group input:focus {
    outline: none;
    border-color: rgba(37, 99, 235, 0.6);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### Header with Glassmorphism
```css
.header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    padding: 1rem 2rem;
    backdrop-filter: blur(20px);
    background: rgba(15, 23, 42, 0.8);
    border-bottom: 1px solid var(--border-color);
    transition: all 0.3s ease;
}

.header.scrolled {
    padding: 0.5rem 2rem;
    background: rgba(15, 23, 42, 0.95);
}
```

### Modal System
```css
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}

.modal.active {
    opacity: 1;
    visibility: visible;
}

.modal-content {
    background: var(--bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(20px);
    transition: transform 0.3s ease;
}

.modal.active .modal-content {
    transform: translateY(0);
}
```

## 🎭 Animations & Transitions

### Standard Transitions
```css
:root {
    --transition-fast: 150ms ease;
    --transition-base: 300ms ease;
    --transition-slow: 500ms ease;
}
```

### Loading Spinner
```css
.loading {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

### Gradient Background Animation
```css
.bg-animation {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}
```

## 📱 Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
@media (max-width: 768px) {
    .header {
        padding: 1rem;
    }
    
    .hero {
        padding: 6rem 1rem 3rem;
    }
    
    .modal-content {
        margin: 1rem;
        padding: 1.5rem;
    }
}

@media (max-width: 480px) {
    .hero h1 {
        font-size: 2rem;
    }
    
    .btn {
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
    }
}
```

## 🔗 Icon System

### Microsoft Fluent System Icons
Use inline SVG for maximum control and performance:

```html
<!-- Example: User icon -->
<svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a3 3 0 110 6 3 3 0 010-6zm-5.43 10.528A7.001 7.001 0 0112 17a7.001 7.001 0 015.43-1.472A8.966 8.966 0 0112 20a8.966 8.966 0 01-5.43-4.472z"/>
</svg>
```

### Icon Sizing Classes
```css
.w-4 { width: 1rem; height: 1rem; }      /* 16px */
.w-5 { width: 1.25rem; height: 1.25rem; } /* 20px */
.w-6 { width: 1.5rem; height: 1.5rem; }   /* 24px */
.w-8 { width: 2rem; height: 2rem; }       /* 32px */
```

## 🎨 Custom Scrollbar
```css
::-webkit-scrollbar {
    width: 4px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
}
```

## 📋 Status Indicators & Alerts
```css
.alert {
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
}

.alert.success {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #10b981;
}

.alert.error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.alert.warning {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #f59e0b;
}
```

## 🚀 Usage Instructions

### 1. HTML Setup
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your App</title>
    
    <!-- Inter Font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <!-- Your CSS with design system variables -->
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Your content -->
</body>
</html>
```

### 2. CSS Implementation
```css
/* Copy all the CSS variables and component styles above into your stylesheet */

/* Example usage in your components */
.your-component {
    background: var(--bg-card);
    color: var(--text-primary);
    padding: var(--space-lg);
    border-radius: var(--radius-lg);
    transition: var(--transition-base);
}
```

### 3. JavaScript for Interactive Elements
```javascript
// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Modal functionality
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}
```

---

## ✨ Key Features

- **Professional Blue & Slate Color Palette**: Modern, trustworthy, enterprise-ready
- **Glassmorphism Design**: Backdrop blur effects with transparency
- **Inter Font**: Modern, highly legible typeface
- **Microsoft Fluent Icons**: Enterprise-grade iconography system
- **Dark Theme First**: Optimized for reduced eye strain
- **Responsive Design**: Mobile-first approach
- **Smooth Animations**: Subtle, professional micro-interactions
- **Accessible**: WCAG compliant color contrasts
- **Modular**: Use individual components or the complete system

Copy this entire system into your projects for consistent, professional UI that matches SYNTHEX's landing page aesthetics!