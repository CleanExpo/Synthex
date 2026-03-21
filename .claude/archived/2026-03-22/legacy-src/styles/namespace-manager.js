/**
 * CSS Namespace Manager
 * Manages CSS namespacing to prevent conflicts between legacy and new styles
 */

import { isFeatureEnabled } from '../config/features.js';

class NamespaceManager {
  constructor() {
    this.namespace = isFeatureEnabled('glassmorphicUI') ? 'v2-' : '';
    this.dataAttribute = isFeatureEnabled('glassmorphicUI') ? 'data-version="2"' : '';
    this.cssFiles = new Map();
    this.loadedStyles = new Set();
  }
  
  // Add namespace to class names
  addNamespace(className) {
    if (!className) return '';
    
    // Handle multiple classes
    if (className.includes(' ')) {
      return className.split(' ')
        .map(cls => this.namespace + cls)
        .join(' ');
    }
    
    return this.namespace + className;
  }
  
  // Remove namespace from class names
  removeNamespace(className) {
    if (!className || !this.namespace) return className;
    
    return className.replace(new RegExp(this.namespace, 'g'), '');
  }
  
  // Create namespaced CSS selector
  createSelector(selector) {
    if (!this.namespace) return selector;
    
    // Add namespace to class selectors
    return selector.replace(/\.([\w-]+)/g, `.${this.namespace}$1`);
  }
  
  // Apply namespace to element
  applyToElement(element) {
    if (!element || !this.dataAttribute) return;
    
    element.setAttribute('data-version', '2');
    
    // Update existing classes
    const classes = element.className.split(' ').filter(Boolean);
    element.className = classes.map(cls => {
      if (!cls.startsWith(this.namespace)) {
        return this.namespace + cls;
      }
      return cls;
    }).join(' ');
  }
  
  // Register CSS files for progressive loading
  registerStyles(feature, cssFiles) {
    this.cssFiles.set(feature, cssFiles);
  }
  
  // Load styles progressively
  async loadStyles(feature) {
    if (!isFeatureEnabled(feature)) {
      console.log(`Feature '${feature}' is disabled, skipping styles`);
      return;
    }
    
    const files = this.cssFiles.get(feature);
    if (!files) {
      console.warn(`No CSS files registered for feature '${feature}'`);
      return;
    }
    
    const promises = files.map(file => this.loadStyleFile(file, feature));
    await Promise.all(promises);
  }
  
  // Load individual style file
  async loadStyleFile(file, feature) {
    const styleId = `${feature}-${file}`;
    
    // Check if already loaded
    if (this.loadedStyles.has(styleId)) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/css/${file}`;
      link.id = styleId;
      link.setAttribute('data-feature', feature);
      
      link.onload = () => {
        this.loadedStyles.add(styleId);
        console.log(`Loaded styles: ${file}`);
        resolve();
      };
      
      link.onerror = () => {
        console.error(`Failed to load styles: ${file}`);
        reject(new Error(`Failed to load ${file}`));
      };
      
      document.head.appendChild(link);
    });
  }
  
  // Unload styles for a feature
  unloadStyles(feature) {
    const links = document.querySelectorAll(`link[data-feature="${feature}"]`);
    links.forEach(link => {
      link.remove();
      const styleId = link.id;
      this.loadedStyles.delete(styleId);
    });
    console.log(`Unloaded styles for feature: ${feature}`);
  }
  
  // Create isolated style scope
  createIsolatedScope(styles, scopeId) {
    const scopedStyles = styles.replace(/([^{]+){/g, (match, selector) => {
      // Add scope to each selector
      const trimmed = selector.trim();
      if (trimmed.startsWith('@') || trimmed.startsWith(':root')) {
        return match;
      }
      return `[data-scope="${scopeId}"] ${trimmed} {`;
    });
    
    const styleElement = document.createElement('style');
    styleElement.textContent = scopedStyles;
    styleElement.setAttribute('data-scope-id', scopeId);
    document.head.appendChild(styleElement);
    
    return scopeId;
  }
  
  // Remove isolated scope
  removeIsolatedScope(scopeId) {
    const styleElement = document.querySelector(`style[data-scope-id="${scopeId}"]`);
    if (styleElement) {
      styleElement.remove();
    }
  }
}

// Create singleton instance
const namespaceManager = new NamespaceManager();

// Register component styles
namespaceManager.registerStyles('glassmorphicUI', [
  'components/charts.css',
  'components/calendar.css',
  'components/notifications.css',
  'components/file-upload.css',
  'components/scheduling.css',
  'components/analytics-dashboard.css'
]);

namespaceManager.registerStyles('platformOptimizers', [
  'tiktok-optimizer.css'
]);

// Auto-load styles based on enabled features
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', async () => {
    if (isFeatureEnabled('glassmorphicUI')) {
      await namespaceManager.loadStyles('glassmorphicUI');
    }
    
    if (isFeatureEnabled('platformOptimizers')) {
      await namespaceManager.loadStyles('platformOptimizers');
    }
  });
}

// Export for use
export default namespaceManager;
export { NamespaceManager };

// Browser export
if (typeof window !== 'undefined') {
  window.synthexNamespace = namespaceManager;
}