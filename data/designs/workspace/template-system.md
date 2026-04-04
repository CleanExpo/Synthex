# Template System Framework

## 1. Pre-Built Marketing Templates

### Template Categories
```javascript
const templateLibrary = {
  socialMedia: {
    instagram: {
      post: ['product', 'quote', 'carousel', 'announcement'],
      story: ['poll', 'countdown', 'swipe-up', 'behind-scenes'],
      reel: ['tutorial', 'showcase', 'transformation']
    },
    facebook: {
      post: ['link-share', 'event', 'photo-collage'],
      ad: ['carousel', 'video', 'collection']
    },
    linkedin: {
      post: ['thought-leadership', 'company-update', 'job-posting'],
      article: ['case-study', 'industry-insights']
    }
  },
  
  email: {
    newsletter: ['weekly-digest', 'monthly-roundup', 'announcement'],
    promotional: ['sale', 'product-launch', 'limited-offer'],
    transactional: ['welcome', 'order-confirmation', 'password-reset']
  },
  
  landing: {
    pages: ['hero-cta', 'feature-list', 'testimonial', 'pricing'],
    forms: ['lead-capture', 'webinar-registration', 'contact']
  },
  
  presentations: {
    pitch: ['investor', 'sales', 'partnership'],
    report: ['quarterly', 'annual', 'campaign-results']
  }
};
```

### Template Structure
```javascript
class MarketingTemplate {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.category = config.category;
    this.thumbnail = config.thumbnail;
    this.components = config.components;
    this.variables = config.variables;
    this.constraints = config.constraints;
  }

  render() {
    return `
      <div class="template" data-template-id="${this.id}">
        <div class="template-preview">
          <img src="${this.thumbnail}" alt="${this.name}">
          <div class="template-overlay">
            <button class="use-template">Use Template</button>
            <button class="preview-template">Preview</button>
          </div>
        </div>
        <div class="template-info">
          <h3>${this.name}</h3>
          <p>${this.category}</p>
          <div class="template-tags">
            ${this.tags.map(tag => `<span>${tag}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  instantiate(customData) {
    const instance = {
      templateId: this.id,
      id: this.generateInstanceId(),
      components: this.cloneComponents(),
      data: this.mergeData(customData),
      created: Date.now()
    };
    
    this.applyVariables(instance, customData);
    this.enforceConstraints(instance);
    
    return instance;
  }
}
```

## 2. Customizable Component Library

### Component Architecture
```javascript
const componentLibrary = {
  basic: {
    text: {
      type: 'text',
      properties: ['content', 'font', 'size', 'color', 'alignment'],
      defaults: {
        font: 'Inter',
        size: 16,
        color: '#000000',
        alignment: 'left'
      }
    },
    
    image: {
      type: 'image',
      properties: ['src', 'alt', 'width', 'height', 'objectFit'],
      defaults: {
        objectFit: 'cover',
        width: '100%',
        height: 'auto'
      }
    },
    
    button: {
      type: 'button',
      properties: ['text', 'action', 'style', 'size'],
      defaults: {
        style: 'primary',
        size: 'medium',
        action: 'link'
      }
    }
  },
  
  marketing: {
    persona: {
      type: 'persona-card',
      properties: ['avatar', 'name', 'role', 'demographics', 'painPoints'],
      layout: 'vertical',
      editable: true
    },
    
    hook: {
      type: 'hook-display',
      properties: ['text', 'style', 'persona', 'metrics'],
      variants: ['humorous', 'serious', 'business', 'playful', 'meaningful']
    },
    
    testimonial: {
      type: 'testimonial',
      properties: ['quote', 'author', 'company', 'avatar', 'rating'],
      styles: ['card', 'inline', 'featured']
    },
    
    cta: {
      type: 'call-to-action',
      properties: ['headline', 'subtext', 'button', 'urgency'],
      templates: ['hero', 'inline', 'popup', 'sticky']
    }
  },
  
  layout: {
    grid: {
      type: 'grid',
      properties: ['columns', 'gap', 'responsive'],
      children: []
    },
    
    section: {
      type: 'section',
      properties: ['background', 'padding', 'width'],
      children: []
    },
    
    carousel: {
      type: 'carousel',
      properties: ['autoplay', 'duration', 'navigation'],
      children: []
    }
  }
};
```

### Component Editor Interface
```javascript
class ComponentEditor {
  constructor(component) {
    this.component = component;
    this.properties = this.getEditableProperties();
  }

  render() {
    return `
      <div class="component-editor">
        <h3>Edit ${this.component.type}</h3>
        <div class="editor-tabs">
          <button class="tab active" data-tab="content">Content</button>
          <button class="tab" data-tab="style">Style</button>
          <button class="tab" data-tab="actions">Actions</button>
        </div>
        
        <div class="tab-content active" id="content">
          ${this.renderContentEditor()}
        </div>
        
        <div class="tab-content" id="style">
          ${this.renderStyleEditor()}
        </div>
        
        <div class="tab-content" id="actions">
          ${this.renderActionsEditor()}
        </div>
        
        <div class="editor-footer">
          <button class="apply">Apply Changes</button>
          <button class="reset">Reset</button>
          <button class="cancel">Cancel</button>
        </div>
      </div>
    `;
  }

  renderContentEditor() {
    return this.properties.content.map(prop => `
      <div class="property-group">
        <label>${prop.label}</label>
        ${this.renderControl(prop)}
      </div>
    `).join('');
  }

  renderControl(property) {
    switch(property.type) {
      case 'text':
        return `<input type="text" value="${property.value}">`;
      case 'textarea':
        return `<textarea>${property.value}</textarea>`;
      case 'select':
        return `
          <select>
            ${property.options.map(opt => 
              `<option value="${opt.value}">${opt.label}</option>`
            ).join('')}
          </select>
        `;
      case 'color':
        return `<input type="color" value="${property.value}">`;
      case 'range':
        return `
          <input type="range" 
                 min="${property.min}" 
                 max="${property.max}" 
                 value="${property.value}">
        `;
      default:
        return '';
    }
  }
}
```

## 3. Brand Kit Integration

### Brand Configuration
```javascript
class BrandKit {
  constructor(brandData) {
    this.colors = brandData.colors;
    this.typography = brandData.typography;
    this.logos = brandData.logos;
    this.imagery = brandData.imagery;
    this.voice = brandData.voice;
  }

  applyToTemplate(template) {
    // Replace template colors with brand colors
    template.components.forEach(component => {
      if (component.style.color) {
        component.style.color = this.mapColor(component.style.color);
      }
      if (component.style.backgroundColor) {
        component.style.backgroundColor = this.mapColor(component.style.backgroundColor);
      }
    });
    
    // Apply brand typography
    template.components.forEach(component => {
      if (component.type === 'text') {
        component.style.fontFamily = this.typography.primary;
        if (component.isHeading) {
          component.style.fontFamily = this.typography.heading;
        }
      }
    });
    
    // Insert brand logos
    template.components.forEach(component => {
      if (component.type === 'logo-placeholder') {
        component.src = this.logos.primary;
      }
    });
    
    return template;
  }

  renderBrandPanel() {
    return `
      <div class="brand-kit-panel">
        <h3>Brand Kit</h3>
        
        <div class="brand-section">
          <h4>Colors</h4>
          <div class="color-palette">
            ${Object.entries(this.colors).map(([name, value]) => `
              <div class="color-swatch" 
                   style="background: ${value}" 
                   data-color="${value}"
                   title="${name}">
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="brand-section">
          <h4>Typography</h4>
          <div class="font-list">
            ${Object.entries(this.typography).map(([usage, font]) => `
              <div class="font-item">
                <span style="font-family: ${font}">${font}</span>
                <small>${usage}</small>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="brand-section">
          <h4>Logos</h4>
          <div class="logo-grid">
            ${Object.entries(this.logos).map(([variant, src]) => `
              <img src="${src}" 
                   alt="${variant} logo" 
                   class="brand-logo"
                   draggable="true">
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
}
```

### Brand Consistency Checker
```javascript
const brandConsistency = {
  check(design) {
    const issues = [];
    
    // Check color compliance
    design.components.forEach(comp => {
      if (comp.style.color && !this.isB randColor(comp.style.color)) {
        issues.push({
          type: 'color',
          component: comp.id,
          message: `Non-brand color used: ${comp.style.color}`
        });
      }
    });
    
    // Check typography compliance
    design.components.forEach(comp => {
      if (comp.style.fontFamily && !this.isBrandFont(comp.style.fontFamily)) {
        issues.push({
          type: 'typography',
          component: comp.id,
          message: `Non-brand font used: ${comp.style.fontFamily}`
        });
      }
    });
    
    // Check logo usage
    const logos = design.components.filter(c => c.type === 'image' && c.isLogo);
    logos.forEach(logo => {
      if (!this.isCorrectLogoUsage(logo)) {
        issues.push({
          type: 'logo',
          component: logo.id,
          message: 'Incorrect logo usage or sizing'
        });
      }
    });
    
    return issues;
  }
};
```

## 4. Export & Sharing Options

### Export Configuration
```javascript
const exportOptions = {
  formats: {
    image: {
      png: {
        quality: 100,
        transparency: true,
        scale: [1, 2, 3] // 1x, 2x, 3x
      },
      jpg: {
        quality: 90,
        progressive: true
      },
      svg: {
        embedFonts: true,
        convertTextToPath: false
      },
      pdf: {
        format: 'A4',
        orientation: 'auto',
        margins: 10
      }
    },
    
    code: {
      html: {
        inline: false,
        minify: true,
        responsive: true
      },
      react: {
        components: true,
        typescript: true
      },
      vue: {
        sfc: true, // Single File Component
        composition: true
      }
    },
    
    data: {
      json: {
        pretty: true,
        includeMetadata: true
      },
      csv: {
        headers: true,
        delimiter: ','
      }
    }
  },
  
  batch: {
    enabled: true,
    formats: ['png', 'jpg', 'pdf'],
    sizes: ['desktop', 'tablet', 'mobile'],
    naming: '{name}-{size}-{format}'
  }
};
```

### Sharing Interface
```javascript
class SharingManager {
  constructor() {
    this.shareOptions = {
      link: true,
      embed: true,
      download: true,
      social: true
    };
  }

  generateShareLink(design) {
    const shareData = {
      id: design.id,
      token: this.generateToken(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      permissions: 'view'
    };
    
    return `https://app.automarketing.com/share/${shareData.token}`;
  }

  generateEmbedCode(design, options) {
    return `
      <iframe 
        src="https://app.automarketing.com/embed/${design.id}"
        width="${options.width || '100%'}"
        height="${options.height || '600'}"
        frameborder="0"
        allowfullscreen>
      </iframe>
    `;
  }

  renderShareDialog() {
    return `
      <div class="share-dialog">
        <h3>Share & Export</h3>
        
        <div class="share-tabs">
          <button class="tab active" data-tab="link">Share Link</button>
          <button class="tab" data-tab="embed">Embed</button>
          <button class="tab" data-tab="download">Download</button>
          <button class="tab" data-tab="social">Social</button>
        </div>
        
        <div class="tab-content active" id="link">
          <input type="text" value="${this.shareLink}" readonly>
          <button class="copy-link">Copy Link</button>
          <div class="share-settings">
            <label>
              <input type="checkbox" checked> Allow comments
            </label>
            <label>
              <input type="checkbox"> Allow downloads
            </label>
            <label>
              Expires in: 
              <select>
                <option>Never</option>
                <option>1 day</option>
                <option selected>7 days</option>
                <option>30 days</option>
              </select>
            </label>
          </div>
        </div>
        
        <div class="tab-content" id="download">
          <div class="export-options">
            <h4>Format</h4>
            <select id="export-format">
              <option value="png">PNG Image</option>
              <option value="jpg">JPG Image</option>
              <option value="svg">SVG Vector</option>
              <option value="pdf">PDF Document</option>
              <option value="html">HTML Code</option>
            </select>
            
            <h4>Size</h4>
            <select id="export-size">
              <option value="original">Original</option>
              <option value="2x">2x (Retina)</option>
              <option value="custom">Custom...</option>
            </select>
            
            <button class="download-btn">Download</button>
          </div>
        </div>
      </div>
    `;
  }
}
```

## 5. Template Variables & Smart Fields

### Variable System
```javascript
class TemplateVariables {
  constructor() {
    this.variables = new Map();
    this.computed = new Map();
  }

  define(name, config) {
    this.variables.set(name, {
      name: name,
      type: config.type,
      default: config.default,
      validation: config.validation,
      description: config.description,
      required: config.required || false
    });
  }

  defineComputed(name, formula) {
    this.computed.set(name, {
      name: name,
      formula: formula,
      dependencies: this.extractDependencies(formula)
    });
  }

  evaluate(template, data) {
    // Replace variables with values
    this.variables.forEach((variable, name) => {
      const value = data[name] || variable.default;
      
      if (variable.required && !value) {
        throw new Error(`Required variable ${name} is missing`);
      }
      
      if (variable.validation && !variable.validation(value)) {
        throw new Error(`Invalid value for ${name}`);
      }
      
      template = this.replaceVariable(template, name, value);
    });
    
    // Evaluate computed fields
    this.computed.forEach((computed, name) => {
      const value = this.evaluateFormula(computed.formula, data);
      template = this.replaceVariable(template, name, value);
    });
    
    return template;
  }
}
```

### Smart Field Examples
```javascript
const smartFields = {
  date: {
    today: () => new Date().toLocaleDateString(),
    tomorrow: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      return date.toLocaleDateString();
    },
    nextWeek: () => {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date.toLocaleDateString();
    }
  },
  
  user: {
    name: () => currentUser.name,
    company: () => currentUser.company,
    email: () => currentUser.email
  },
  
  dynamic: {
    countdown: (targetDate) => {
      const days = Math.ceil((targetDate - Date.now()) / (1000 * 60 * 60 * 24));
      return `${days} days left`;
    },
    
    personalization: (persona) => {
      return {
        greeting: this.getGreeting(persona),
        painPoint: this.getPainPoint(persona),
        solution: this.getSolution(persona)
      };
    }
  }
};
```

## 6. Template Versioning

### Version Control for Templates
```javascript
class TemplateVersionControl {
  constructor(template) {
    this.template = template;
    this.versions = [];
    this.currentVersion = null;
  }

  saveVersion(name, author) {
    const version = {
      id: this.generateId(),
      name: name || `v${this.versions.length + 1}`,
      template: this.cloneTemplate(),
      author: author,
      timestamp: Date.now(),
      changes: this.detectChanges()
    };
    
    this.versions.push(version);
    this.currentVersion = version.id;
    
    return version;
  }

  publishTemplate() {
    const published = {
      ...this.template,
      status: 'published',
      publishedAt: Date.now(),
      version: this.currentVersion,
      public: true
    };
    
    this.saveToLibrary(published);
    this.notifySubscribers(published);
    
    return published;
  }
}
```

## 7. Template Analytics

### Usage Tracking
```javascript
const templateAnalytics = {
  track(event, template, data) {
    const tracking = {
      event: event,
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      userId: currentUser.id,
      timestamp: Date.now(),
      data: data
    };
    
    this.send(tracking);
    this.updateMetrics(template, event);
  },
  
  metrics: {
    views: 0,
    uses: 0,
    exports: 0,
    shares: 0,
    rating: 0,
    feedback: []
  },
  
  getPopularTemplates() {
    return this.templates
      .sort((a, b) => b.metrics.uses - a.metrics.uses)
      .slice(0, 10);
  }
};
```

## Implementation Checklist

### Core Features
- [ ] Template library structure
- [ ] Component system
- [ ] Brand kit integration
- [ ] Export functionality
- [ ] Sharing system

### Advanced Features
- [ ] Variable system
- [ ] Smart fields
- [ ] Version control
- [ ] Analytics tracking
- [ ] Custom templates

### User Experience
- [ ] Template preview
- [ ] Quick customization
- [ ] Drag-drop support
- [ ] Responsive preview
- [ ] Batch operations

### Integration
- [ ] Cloud storage
- [ ] Third-party platforms
- [ ] API access
- [ ] Webhook support
- [ ] Plugin system