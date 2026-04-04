# Drag-and-Drop System Architecture

## 1. Asset Library Structure

### Library Organization
```javascript
const assetLibrary = {
  categories: {
    personas: {
      icon: '👤',
      items: [],
      draggable: true,
      duplicatable: true
    },
    hooks: {
      icon: '🎣',
      items: [],
      draggable: true,
      variants: ['humorous', 'serious', 'business', 'playful', 'meaningful']
    },
    storyboards: {
      icon: '🎬',
      items: [],
      draggable: true,
      expandable: true
    },
    templates: {
      icon: '📄',
      items: [],
      draggable: true,
      customizable: true
    },
    components: {
      icon: '🧩',
      items: [],
      draggable: true,
      nestable: true
    }
  }
};
```

### Asset Card Component
```html
<div class="asset-card" draggable="true" data-type="persona" data-id="123">
  <div class="asset-preview">
    <img src="thumbnail.jpg" alt="Asset preview">
    <div class="asset-badge">Persona</div>
  </div>
  <div class="asset-info">
    <h4>Sarah Johnson</h4>
    <p>Marketing Manager, 32</p>
    <div class="asset-tags">
      <span>B2B</span>
      <span>Tech-savvy</span>
    </div>
  </div>
  <div class="asset-actions">
    <button>Edit</button>
    <button>Duplicate</button>
  </div>
</div>
```

## 2. Drag Implementation

### Drag Events & Data Transfer
```javascript
class DragManager {
  constructor() {
    this.dragData = null;
    this.dragElement = null;
    this.ghostElement = null;
  }

  startDrag(event, element, data) {
    this.dragData = {
      type: element.dataset.type,
      id: element.dataset.id,
      source: 'library',
      metadata: data,
      position: { x: event.clientX, y: event.clientY }
    };

    // Create ghost image
    this.ghostElement = this.createGhost(element);
    
    // Set drag image
    event.dataTransfer.setDragImage(this.ghostElement, 50, 50);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(this.dragData));
    
    // Visual feedback
    element.classList.add('dragging');
    this.showDropZones();
  }

  createGhost(element) {
    const ghost = element.cloneNode(true);
    ghost.style.opacity = '0.7';
    ghost.style.transform = 'scale(0.9)';
    ghost.style.position = 'absolute';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    document.body.appendChild(ghost);
    return ghost;
  }
}
```

### Drag Visual Feedback
```css
.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  cursor: grabbing;
}

.drag-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 10000;
  opacity: 0.7;
  transform: rotate(2deg);
  filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3));
}

.drag-preview {
  border: 2px dashed #0066CC;
  background: rgba(0, 102, 204, 0.1);
  border-radius: 8px;
}
```

## 3. Drop Zones Configuration

### Drop Zone Types
```javascript
const dropZones = {
  canvas: {
    accepts: ['all'],
    validation: (dragData) => true,
    preview: true,
    snap: true,
    guidelines: true
  },
  sidebar: {
    accepts: ['persona', 'hook', 'component'],
    validation: (dragData) => dragData.source === 'canvas',
    reorder: true,
    folder: true
  },
  trash: {
    accepts: ['all'],
    validation: (dragData) => dragData.source === 'canvas',
    confirmation: true,
    animation: 'burn'
  },
  template: {
    accepts: ['component', 'text', 'image'],
    validation: (dragData) => !dragData.locked,
    slots: true,
    constraints: true
  }
};
```

### Drop Zone Visual States
```
Normal State          Hover State          Valid Drop          Invalid Drop
┌─────────────┐      ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │      │ ░░░░░░░░░░░ │     │ +++++++++++ │     │ ××××××××××× │
│  Drop Here  │  →   │ ░Drop Here░ │  →  │ +Drop Here+ │  OR │ ×No  Entry× │
│             │      │ ░░░░░░░░░░░ │     │ +++++++++++ │     │ ××××××××××× │
└─────────────┘      └─────────────┘     └─────────────┘     └─────────────┘
   (Default)          (Active hover)       (Can drop)         (Cannot drop)
```

## 4. Auto-Organization System

### Smart Layout Engine
```javascript
class AutoOrganizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gridSize = 20;
    this.padding = 16;
    this.algorithms = {
      grid: this.gridLayout,
      flow: this.flowLayout,
      radial: this.radialLayout,
      tree: this.treeLayout
    };
  }

  autoArrange(elements, algorithm = 'grid') {
    const layout = this.algorithms[algorithm];
    const positions = layout.call(this, elements);
    
    this.animateToPositions(elements, positions);
  }

  gridLayout(elements) {
    const columns = Math.ceil(Math.sqrt(elements.length));
    const cellWidth = 200 + this.padding;
    const cellHeight = 150 + this.padding;
    
    return elements.map((el, i) => ({
      id: el.id,
      x: (i % columns) * cellWidth,
      y: Math.floor(i / columns) * cellHeight
    }));
  }

  flowLayout(elements) {
    let x = 0, y = 0, rowHeight = 0;
    const maxWidth = this.canvas.width - 200;
    
    return elements.map(el => {
      if (x + el.width > maxWidth) {
        x = 0;
        y += rowHeight + this.padding;
        rowHeight = 0;
      }
      
      const position = { id: el.id, x, y };
      x += el.width + this.padding;
      rowHeight = Math.max(rowHeight, el.height);
      
      return position;
    });
  }
}
```

### Collision Detection
```javascript
class CollisionDetector {
  detectCollision(element, others) {
    const rect1 = element.getBounds();
    
    for (let other of others) {
      if (other.id === element.id) continue;
      
      const rect2 = other.getBounds();
      
      if (this.rectanglesOverlap(rect1, rect2)) {
        return {
          collides: true,
          with: other,
          overlap: this.getOverlapArea(rect1, rect2)
        };
      }
    }
    
    return { collides: false };
  }

  rectanglesOverlap(rect1, rect2) {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  }

  resolveCollision(element, collision) {
    const spacing = 16;
    const positions = [
      { x: collision.with.right + spacing, y: element.y }, // Right
      { x: collision.with.left - element.width - spacing, y: element.y }, // Left
      { x: element.x, y: collision.with.bottom + spacing }, // Below
      { x: element.x, y: collision.with.top - element.height - spacing } // Above
    ];
    
    // Find best position with least movement
    return positions.reduce((best, pos) => {
      const distance = Math.hypot(pos.x - element.x, pos.y - element.y);
      return distance < best.distance ? { ...pos, distance } : best;
    }, { distance: Infinity });
  }
}
```

## 5. Drag Constraints & Rules

### Constraint System
```javascript
const dragConstraints = {
  bounds: {
    canvas: { min: { x: 0, y: 0 }, max: { x: Infinity, y: Infinity } },
    container: 'parent',
    viewport: 'visible'
  },
  
  rules: {
    personas: {
      maxInstances: 1,
      requiredFields: ['name', 'age', 'role'],
      canDelete: false
    },
    hooks: {
      maxPerPersona: 25,
      requiredVariants: 5,
      minLength: 10,
      maxLength: 200
    },
    storyboards: {
      requiredScenes: 6,
      maxDuration: 60,
      aspectRatio: '16:9'
    }
  },
  
  validation: {
    onDrag: true,
    onDrop: true,
    showErrors: true,
    preventInvalid: true
  }
};
```

## 6. Drop Effects & Animations

### Drop Animation Sequences
```javascript
const dropAnimations = {
  fadeIn: {
    keyframes: [
      { opacity: 0, transform: 'scale(0.8)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    duration: 300,
    easing: 'ease-out'
  },
  
  bounceIn: {
    keyframes: [
      { transform: 'scale(0) rotate(180deg)' },
      { transform: 'scale(1.1) rotate(360deg)' },
      { transform: 'scale(1) rotate(360deg)' }
    ],
    duration: 500,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },
  
  slideIn: {
    keyframes: [
      { transform: 'translateY(-50px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    duration: 400,
    easing: 'ease-out'
  }
};
```

### Visual Drop Feedback
```css
@keyframes dropPulse {
  0% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(0, 102, 204, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 102, 204, 0); }
}

.drop-success {
  animation: dropPulse 0.5s ease-out;
  border-color: #34C759 !important;
}

.drop-error {
  animation: shake 0.3s ease-in-out;
  border-color: #FF3B30 !important;
}
```

## 7. Drag Handle System

### Custom Drag Handles
```html
<div class="draggable-container">
  <div class="drag-handle" data-handle="move">⋮⋮</div>
  <div class="content">
    <!-- Element content -->
  </div>
  <div class="resize-handles">
    <div data-handle="resize-nw"></div>
    <div data-handle="resize-n"></div>
    <div data-handle="resize-ne"></div>
    <div data-handle="resize-e"></div>
    <div data-handle="resize-se"></div>
    <div data-handle="resize-s"></div>
    <div data-handle="resize-sw"></div>
    <div data-handle="resize-w"></div>
  </div>
</div>
```

## 8. Nested Drag & Drop

### Container Hierarchy
```javascript
class NestedDragDrop {
  constructor() {
    this.containers = new Map();
    this.depth = 0;
    this.maxDepth = 5;
  }
  
  canNest(dragElement, dropContainer) {
    // Prevent circular nesting
    if (this.isAncestor(dragElement, dropContainer)) {
      return false;
    }
    
    // Check depth limit
    const depth = this.getDepth(dropContainer);
    if (depth >= this.maxDepth) {
      return false;
    }
    
    // Check container rules
    const rules = dropContainer.dataset.acceptChildren;
    return rules === 'all' || rules.includes(dragElement.type);
  }
  
  handleNestedDrop(dragElement, dropContainer) {
    // Remove from current parent
    if (dragElement.parent) {
      dragElement.parent.removeChild(dragElement);
    }
    
    // Add to new parent
    dropContainer.appendChild(dragElement);
    dragElement.parent = dropContainer;
    
    // Update visual hierarchy
    this.updateIndentation(dragElement);
    this.updateConnections();
  }
}
```

## 9. Drag Data Persistence

### State Management
```javascript
const dragState = {
  history: [],
  current: null,
  
  save() {
    const state = {
      timestamp: Date.now(),
      action: 'drag',
      from: this.current.source,
      to: this.current.target,
      element: this.current.element,
      position: this.current.position
    };
    
    this.history.push(state);
    this.persist();
  },
  
  persist() {
    localStorage.setItem('dragHistory', JSON.stringify(this.history));
  },
  
  restore() {
    const saved = localStorage.getItem('dragHistory');
    if (saved) {
      this.history = JSON.parse(saved);
    }
  },
  
  undo() {
    const last = this.history.pop();
    if (last) {
      this.revertAction(last);
    }
  }
};
```

## 10. Accessibility Features

### Keyboard Drag & Drop
```javascript
const keyboardDragDrop = {
  enabled: true,
  
  shortcuts: {
    select: 'Space',
    move: 'Arrow keys',
    drop: 'Enter',
    cancel: 'Escape'
  },
  
  handleKeyboard(event) {
    const selected = document.activeElement;
    
    switch(event.key) {
      case ' ':
        this.startKeyboardDrag(selected);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        this.moveWithKeyboard(selected, event.key);
        break;
      case 'Enter':
        this.dropWithKeyboard(selected);
        break;
      case 'Escape':
        this.cancelKeyboardDrag();
        break;
    }
  },
  
  announceAction(action) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = action;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 100);
  }
};
```

## Implementation Checklist

### Core Functionality
- [ ] Draggable asset library
- [ ] Drop zone detection
- [ ] Visual feedback system
- [ ] Auto-organization
- [ ] Collision detection

### Advanced Features
- [ ] Nested drag & drop
- [ ] Custom drag handles
- [ ] Constraint validation
- [ ] Smart snapping
- [ ] Bulk operations

### User Experience
- [ ] Smooth animations
- [ ] Preview on hover
- [ ] Undo/redo support
- [ ] Keyboard navigation
- [ ] Touch support

### Performance
- [ ] Efficient hit testing
- [ ] Throttled updates
- [ ] Virtual scrolling
- [ ] Memory management
- [ ] State persistence