/**
 * Progressive Style Loader Component
 * Dynamically loads CSS based on enabled features
 */

import { isFeatureEnabled } from '../config/features.js';

class StyleLoader {
  constructor() {
    this.loadedStyles = new Set();
    this.styleQueue = [];
    this.isLoading = false;
  }
  
  // Initialize style loading
  async init() {
    // Load critical styles first
    await this.loadCriticalStyles();
    
    // Then load feature-specific styles
    await this.loadFeatureStyles();
    
    // Set up lazy loading for viewport-based styles
    this.setupLazyLoading();
  }
  
  // Load critical styles that are always needed
  async loadCriticalStyles() {
    const criticalStyles = [
      '/css/synthex-unified.css',
      '/css/production.css'
    ];
    
    if (isFeatureEnabled('glassmorphicUI')) {
      criticalStyles.push('/css/synthex-design-system.css');
    }
    
    await this.loadStylesheets(criticalStyles, 'critical');
  }
  
  // Load feature-specific styles
  async loadFeatureStyles() {
    const featureStyles = [];
    
    // Glassmorphic UI components
    if (isFeatureEnabled('glassmorphicUI')) {
      featureStyles.push(
        '/css/micro-interactions.css',
        '/css/loading-states.css'
      );
    }
    
    // Component-specific styles
    if (isFeatureEnabled('advancedCharts')) {
      featureStyles.push('/css/components/charts.css');
    }
    
    if (isFeatureEnabled('enhancedCalendar')) {
      featureStyles.push('/css/components/calendar.css');
    }
    
    if (isFeatureEnabled('realTimeNotifications')) {
      featureStyles.push('/css/components/notifications.css');
    }
    
    if (isFeatureEnabled('dragDropUpload')) {
      featureStyles.push('/css/components/file-upload.css');
    }
    
    // Platform optimizer styles
    if (isFeatureEnabled('tiktokOptimizer')) {
      featureStyles.push('/css/tiktok-optimizer.css');
    }
    
    await this.loadStylesheets(featureStyles, 'feature');
  }
  
  // Load stylesheets with priority
  async loadStylesheets(urls, priority = 'normal') {
    const promises = urls.map(url => this.loadStylesheet(url, priority));
    await Promise.all(promises);
  }
  
  // Load individual stylesheet
  loadStylesheet(url, priority = 'normal') {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (this.loadedStyles.has(url)) {
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-priority', priority);
      
      // Add loading state
      link.setAttribute('data-loading', 'true');
      
      link.onload = () => {
        link.removeAttribute('data-loading');
        this.loadedStyles.add(url);
        console.log(`Loaded stylesheet: ${url}`);
        resolve();
      };
      
      link.onerror = () => {
        link.removeAttribute('data-loading');
        console.error(`Failed to load stylesheet: ${url}`);
        reject(new Error(`Failed to load ${url}`));
      };
      
      // Insert based on priority
      if (priority === 'critical') {
        // Insert critical styles first
        const firstNonCritical = document.querySelector('link[data-priority]:not([data-priority="critical"])');
        if (firstNonCritical) {
          document.head.insertBefore(link, firstNonCritical);
        } else {
          document.head.appendChild(link);
        }
      } else {
        document.head.appendChild(link);
      }
    });
  }
  
  // Set up lazy loading for viewport-based styles
  setupLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, loading all styles');
      return;
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const styleUrl = element.getAttribute('data-lazy-style');
          
          if (styleUrl && !this.loadedStyles.has(styleUrl)) {
            this.loadStylesheet(styleUrl, 'lazy');
            observer.unobserve(element);
          }
        }
      });
    }, {
      rootMargin: '50px'
    });
    
    // Observe elements with lazy styles
    document.querySelectorAll('[data-lazy-style]').forEach(element => {
      observer.observe(element);
    });
  }
  
  // Preload styles for better performance
  preloadStyle(url) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = url;
    document.head.appendChild(link);
  }
  
  // Remove stylesheet
  removeStylesheet(url) {
    const link = document.querySelector(`link[href="${url}"]`);
    if (link) {
      link.remove();
      this.loadedStyles.delete(url);
      console.log(`Removed stylesheet: ${url}`);
    }
  }
  
  // Clean up unused styles
  cleanup() {
    const unusedSelectors = this.findUnusedSelectors();
    if (unusedSelectors.length > 0) {
      console.log(`Found ${unusedSelectors.length} unused selectors`);
      // Could implement removal of unused styles here
    }
  }
  
  // Find unused CSS selectors (simplified version)
  findUnusedSelectors() {
    const unused = [];
    const styleSheets = document.styleSheets;
    
    for (let sheet of styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        
        for (let rule of rules) {
          if (rule.selectorText) {
            try {
              const elements = document.querySelectorAll(rule.selectorText);
              if (elements.length === 0) {
                unused.push(rule.selectorText);
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }
    
    return unused;
  }
}

// Create singleton instance
const styleLoader = new StyleLoader();

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => styleLoader.init());
  } else {
    styleLoader.init();
  }
}

// Export for use
export default styleLoader;
export { StyleLoader };

// Browser export
if (typeof window !== 'undefined') {
  window.synthexStyleLoader = styleLoader;
}