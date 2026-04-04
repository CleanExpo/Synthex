# UI Mockup Specifications

## Workspace Desktop Interface
**File:** `workspace-desktop.png`
**Dimensions:** 1920x1080px
**Format:** PNG with transparency

### Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  Top Toolbar (60px)                                      │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐  │
│  │Logo│File│Edit│View│Tools│Agents│Share│Help│User │  │
│  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘  │
├──────────────────────────────────────────────────────────┤
│ Left Sidebar (280px) │ Canvas Area │ Right Panel (320px) │
│ ┌──────────────────┐ │             │ ┌────────────────┐ │
│ │ Assets Library    │ │  Infinite   │ │ Properties     │ │
│ ├──────────────────┤ │  Workspace  │ ├────────────────┤ │
│ │ • Personas       │ │             │ │ Style          │ │
│ │ • Hooks          │ │  Grid View  │ │ • Colors       │ │
│ │ • Storyboards    │ │             │ │ • Typography   │ │
│ │ • Templates      │ │  [Content]  │ │ • Spacing      │ │
│ ├──────────────────┤ │             │ ├────────────────┤ │
│ │ AI Agents        │ │             │ │ Data           │ │
│ ├──────────────────┤ │             │ │ • Metrics      │ │
│ │ Layers           │ │             │ │ • Analytics    │ │
│ └──────────────────┘ │             │ └────────────────┘ │
├──────────────────────┴─────────────┴────────────────────┤
│ Bottom Status Bar (30px)                                 │
│ Zoom: 100% | Grid: On | Users: 3 | Saved               │
└──────────────────────────────────────────────────────────┘
```

### Visual Elements
- **Background:** #F5F5F7 (Light mode) / #1D1D1F (Dark mode)
- **Sidebar:** White with subtle shadow
- **Canvas:** Dotted grid pattern (20px spacing)
- **Cards:** Rounded corners (8px), subtle shadows
- **Selection:** Blue outline with resize handles

### Interactive States
- Hover effects on all clickable elements
- Drag preview with 50% opacity
- Selection highlights with blue accent
- Active tool indication in toolbar

---

## Workspace Mobile Interface
**File:** `workspace-mobile.png`
**Dimensions:** 375x812px (iPhone 11 Pro)
**Format:** PNG

### Layout Structure
```
┌─────────────────┐
│ Status Bar      │
├─────────────────┤
│ Navigation Bar  │
│ ┌───┬───┬───┐  │
│ │≡│Title│+│  │
│ └───┴───┴───┘  │
├─────────────────┤
│                 │
│   Canvas Area   │
│                 │
│   [Simplified   │
│    Content]     │
│                 │
├─────────────────┤
│ Floating Action │
│     Button      │
├─────────────────┤
│  Bottom Tab Bar │
│ ┌─┬─┬─┬─┬─┐   │
│ │H│C│+│A│P│   │
│ └─┴─┴─┴─┴─┘   │
└─────────────────┘
```

### Mobile Adaptations
- Collapsible sidebars accessed via hamburger menu
- Touch-optimized controls (44px minimum)
- Pinch-to-zoom gesture support
- Simplified toolbar with essential tools only
- Bottom sheet for properties panel

---

## Sidebar Components Design
**File:** `sidebar-components.png`
**Dimensions:** 280x800px
**Format:** PNG with sections

### Component Sections

#### Assets Library Panel
```
┌──────────────────┐
│ 🔍 Search...     │
├──────────────────┤
│ ▼ Personas (3)   │
│   • Sarah J.     │
│   • Mike T.      │
│   • Emma L.      │
├──────────────────┤
│ ▼ Hooks (25)     │
│   📝 Humorous    │
│   📝 Serious     │
│   📝 Business    │
├──────────────────┤
│ ▼ Storyboards    │
│   🎬 Office      │
│   🎬 Home        │
│   🎬 Adventure   │
└──────────────────┘
```

#### AI Agents Panel
```
┌──────────────────┐
│ AI Agents        │
├──────────────────┤
│ ┌──────────────┐ │
│ │ 🔬 Research  │ │
│ │ Status: Ready│ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │ ✍️ Content   │ │
│ │ Status: Ready│ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │ 🎨 Design    │ │
│ │ Status: Active│ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │ 📊 Analytics │ │
│ │ Status: Ready│ │
│ └──────────────┘ │
└──────────────────┘
```

---

## Collaboration Features UI
**File:** `collaboration-features.png`
**Dimensions:** 800x600px
**Format:** PNG showing overlay elements

### Real-time Collaboration Elements

#### Active Users Display
```
┌─────────────────────────┐
│ Active Users (3)        │
│ ┌───┐ ┌───┐ ┌───┐     │
│ │JD │ │ST │ │+1│      │
│ └───┘ └───┘ └───┘     │
└─────────────────────────┘
```

#### Commenting System
```
┌─────────────────┐
│ 💬 Comment      │
├─────────────────┤
│ @John: Great    │
│ hook idea!      │
│                 │
│ @Sarah: Let's   │
│ test this...    │
├─────────────────┤
│ Add comment...  │
└─────────────────┘
```

#### Live Cursors
- Colored cursor for each user
- Name label follows cursor
- Smooth interpolation between positions
- Selection boxes show user colors

---

## Asset Library Browser
**File:** `asset-library.png`
**Dimensions:** 1200x800px
**Format:** PNG

### Grid View Layout
```
┌────────────────────────────────────┐
│ Asset Library                      │
├────────────────────────────────────┤
│ [Filters] [Sort] [View] [Search]   │
├────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │     │ │     │ │     │ │     │  │
│ │ IMG │ │ IMG │ │ IMG │ │ IMG │  │
│ │     │ │     │ │     │ │     │  │
│ └─────┘ └─────┘ └─────┘ └─────┘  │
│ Persona  Hook    Story   Template │
│                                    │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │     │ │     │ │     │ │     │  │
│ │ IMG │ │ IMG │ │ IMG │ │ IMG │  │
│ │     │ │     │ │     │ │     │  │
│ └─────┘ └─────┘ └─────┘ └─────┘  │
│ Email   Social   Banner  Landing  │
└────────────────────────────────────┘
```

### Asset Card Design
- Thumbnail preview (160x120px)
- Title and description
- Tags for categorization
- Usage count indicator
- Quick actions (Edit, Duplicate, Delete)

---

## Component Interactions

### Drag and Drop Behavior
1. **Drag Start:** Element lifts with shadow
2. **Drag Over:** Drop zones highlight
3. **Drop:** Smooth animation to position
4. **Cancel:** Return to origin with animation

### Selection States
- **Single Select:** Blue outline, 2px
- **Multi-Select:** Blue outline with count badge
- **Hover:** Subtle scale (1.02) and shadow
- **Active:** Deeper shadow and scale (0.98)

### Animation Timing
- **Micro-interactions:** 150ms ease
- **Panel transitions:** 300ms ease-out
- **Drag operations:** Real-time (60fps)
- **Loading states:** Skeleton screens

---

## Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys for grid navigation
- Space/Enter for activation
- Escape for cancel operations

### Screen Reader Support
- ARIA labels on all controls
- Role attributes for components
- Live regions for updates
- Descriptive alt text

### Visual Accessibility
- High contrast mode support
- Focus indicators (3px outline)
- Minimum text size (14px)
- Color-blind safe palette

---

## Export Specifications

### File Formats
- **Development:** SVG for icons, PNG for mockups
- **Documentation:** PDF with annotations
- **Prototypes:** HTML/CSS interactive demos
- **Assets:** Organized Figma/Sketch files

### Naming Convention
```
{component}-{variant}-{state}-{size}.{format}
Example: sidebar-collapsed-dark-desktop.png
```

### Directory Structure
```
mockups/
├── desktop/
│   ├── workspace-desktop.png
│   ├── workspace-desktop-dark.png
│   └── workspace-desktop-annotations.pdf
├── mobile/
│   ├── workspace-mobile.png
│   └── workspace-mobile-gestures.png
├── components/
│   ├── sidebar-components.png
│   ├── toolbar-states.png
│   └── card-variations.png
└── collaboration/
    ├── collaboration-features.png
    ├── commenting-system.png
    └── real-time-cursors.png
```