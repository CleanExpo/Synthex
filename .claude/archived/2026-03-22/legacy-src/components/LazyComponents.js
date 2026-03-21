/**
 * Lazy Loading Component Manager
 * Handles dynamic import and lazy loading of components based on feature flags
 */

import { isFeatureEnabled } from '../config/features.js';

// Lazy load component based on feature flag
function lazyLoadComponent(componentPath, featureName) {
  if (!isFeatureEnabled(featureName)) {
    // Return empty component if feature is disabled
    return () => null;
  }
  
  return new Promise((resolve) => {
    import(componentPath)
      .then(module => resolve(module.default || module))
      .catch(error => {
        console.error(`Failed to load component from ${componentPath}:`, error);
        resolve(() => null);
      });
  });
}

// Platform Optimizer Components
export const InstagramOptimizer = isFeatureEnabled('instagramOptimizer')
  ? () => lazyLoadComponent('./InstagramOptimizer.jsx', 'instagramOptimizer')
  : () => null;

export const FacebookOptimizer = isFeatureEnabled('facebookOptimizer')
  ? () => lazyLoadComponent('./FacebookOptimizer.jsx', 'facebookOptimizer')
  : () => null;

export const TwitterOptimizer = isFeatureEnabled('twitterOptimizer')
  ? () => lazyLoadComponent('./TwitterOptimizer.jsx', 'twitterOptimizer')
  : () => null;

export const LinkedInOptimizer = isFeatureEnabled('linkedinOptimizer')
  ? () => lazyLoadComponent('./LinkedInOptimizer.jsx', 'linkedinOptimizer')
  : () => null;

export const TikTokOptimizer = isFeatureEnabled('tiktokOptimizer')
  ? () => lazyLoadComponent('./TikTokOptimizer.jsx', 'tiktokOptimizer')
  : () => null;

export const PinterestOptimizer = isFeatureEnabled('pinterestOptimizer')
  ? () => lazyLoadComponent('./PinterestOptimizer.jsx', 'pinterestOptimizer')
  : () => null;

export const YouTubeOptimizer = isFeatureEnabled('youtubeOptimizer')
  ? () => lazyLoadComponent('./YouTubeOptimizer.jsx', 'youtubeOptimizer')
  : () => null;

export const RedditOptimizer = isFeatureEnabled('redditOptimizer')
  ? () => lazyLoadComponent('./RedditOptimizer.jsx', 'redditOptimizer')
  : () => null;

// UI Components
export const AdvancedCharts = isFeatureEnabled('advancedCharts')
  ? () => lazyLoadComponent('./ui/AdvancedCharts.js', 'advancedCharts')
  : () => null;

export const EnhancedCalendar = isFeatureEnabled('enhancedCalendar')
  ? () => lazyLoadComponent('./ui/EnhancedCalendar.js', 'enhancedCalendar')
  : () => null;

export const FileUpload = isFeatureEnabled('dragDropUpload')
  ? () => lazyLoadComponent('./ui/FileUpload.js', 'dragDropUpload')
  : () => null;

export const NotificationCenter = isFeatureEnabled('realTimeNotifications')
  ? () => lazyLoadComponent('./ui/NotificationCenter.js', 'realTimeNotifications')
  : () => null;

// Component loader with suspense
export class ComponentLoader {
  constructor() {
    this.loadedComponents = new Map();
    this.loadingPromises = new Map();
  }
  
  async load(componentName, loader) {
    // Check if already loaded
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName);
    }
    
    // Check if currently loading
    if (this.loadingPromises.has(componentName)) {
      return this.loadingPromises.get(componentName);
    }
    
    // Start loading
    const loadPromise = loader()
      .then(component => {
        this.loadedComponents.set(componentName, component);
        this.loadingPromises.delete(componentName);
        return component;
      })
      .catch(error => {
        console.error(`Failed to load component ${componentName}:`, error);
        this.loadingPromises.delete(componentName);
        return null;
      });
    
    this.loadingPromises.set(componentName, loadPromise);
    return loadPromise;
  }
  
  // Preload component
  preload(componentName, loader) {
    if (!this.loadedComponents.has(componentName) && !this.loadingPromises.has(componentName)) {
      this.load(componentName, loader);
    }
  }
  
  // Clear cached component
  clear(componentName) {
    this.loadedComponents.delete(componentName);
    this.loadingPromises.delete(componentName);
  }
  
  // Clear all cached components
  clearAll() {
    this.loadedComponents.clear();
    this.loadingPromises.clear();
  }
}

// Create singleton loader instance
export const componentLoader = new ComponentLoader();

// Preload critical components based on route
export function preloadRouteComponents(route) {
  switch (route) {
    case '/optimize/instagram':
      componentLoader.preload('InstagramOptimizer', InstagramOptimizer);
      break;
    case '/optimize/facebook':
      componentLoader.preload('FacebookOptimizer', FacebookOptimizer);
      break;
    case '/optimize/twitter':
      componentLoader.preload('TwitterOptimizer', TwitterOptimizer);
      break;
    case '/optimize/tiktok':
      componentLoader.preload('TikTokOptimizer', TikTokOptimizer);
      break;
    case '/analytics':
      componentLoader.preload('AdvancedCharts', AdvancedCharts);
      break;
    case '/calendar':
      componentLoader.preload('EnhancedCalendar', EnhancedCalendar);
      break;
    default:
      break;
  }
}

// Auto-preload based on user patterns
export function setupIntelligentPreloading() {
  if (!('IntersectionObserver' in window)) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const component = element.getAttribute('data-preload-component');
        
        if (component) {
          switch (component) {
            case 'InstagramOptimizer':
              componentLoader.preload('InstagramOptimizer', InstagramOptimizer);
              break;
            case 'FacebookOptimizer':
              componentLoader.preload('FacebookOptimizer', FacebookOptimizer);
              break;
            // Add more cases as needed
          }
          
          observer.unobserve(element);
        }
      }
    });
  }, {
    rootMargin: '100px'
  });
  
  // Observe navigation links for preloading
  document.querySelectorAll('[data-preload-component]').forEach(element => {
    observer.observe(element);
  });
}

// Export for browser
if (typeof window !== 'undefined') {
  window.synthexLazyComponents = {
    componentLoader,
    preloadRouteComponents,
    setupIntelligentPreloading
  };
  
  // Setup preloading on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupIntelligentPreloading);
  } else {
    setupIntelligentPreloading();
  }
}