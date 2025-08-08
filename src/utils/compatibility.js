/**
 * Compatibility Layer
 * Ensures smooth transition between legacy and new features
 */

import { isFeatureEnabled } from '../config/features.js';

// Component compatibility wrapper
export function withCompatibility(NewComponent, LegacyComponent) {
  return function CompatibleComponent(props) {
    const useNewVersion = isFeatureEnabled(props.featureFlag || 'glassmorphicUI');
    
    if (useNewVersion && NewComponent) {
      return NewComponent(props);
    }
    
    return LegacyComponent ? LegacyComponent(props) : null;
  };
}

// Style compatibility helper
export function getCompatibleStyles(featureName = 'glassmorphicUI') {
  const isNew = isFeatureEnabled(featureName);
  
  return {
    prefix: isNew ? 'v2-' : '',
    theme: isNew ? 'glassmorphic' : 'legacy',
    cssNamespace: isNew ? '[data-version="2"]' : '',
    useNewStyles: isNew
  };
}

// API compatibility layer
export class CompatibleAPI {
  constructor(featureName) {
    this.useNewAPI = isFeatureEnabled(featureName);
    this.apiVersion = this.useNewAPI ? 'v2' : 'v1';
  }
  
  async request(endpoint, options = {}) {
    const url = this.useNewAPI 
      ? `/api/v2${endpoint}`
      : `/api${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-Version': this.apiVersion,
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error (${this.apiVersion}):`, error);
      
      // Fallback to legacy API if new API fails
      if (this.useNewAPI) {
        console.log('Falling back to legacy API...');
        this.useNewAPI = false;
        this.apiVersion = 'v1';
        return this.request(endpoint, options);
      }
      
      throw error;
    }
  }
}

// Progressive enhancement wrapper
export function progressiveEnhancement(baseFunction, enhancedFunction, featureName) {
  return function(...args) {
    if (isFeatureEnabled(featureName)) {
      try {
        return enhancedFunction.apply(this, args);
      } catch (error) {
        console.error(`Enhanced feature failed, falling back:`, error);
        return baseFunction.apply(this, args);
      }
    }
    
    return baseFunction.apply(this, args);
  };
}

// Safe feature loader
export async function loadFeature(featureName, loader) {
  if (!isFeatureEnabled(featureName)) {
    return null;
  }
  
  try {
    const module = await loader();
    console.log(`Feature '${featureName}' loaded successfully`);
    return module;
  } catch (error) {
    console.error(`Failed to load feature '${featureName}':`, error);
    return null;
  }
}

// Browser compatibility check
export function checkBrowserCompatibility() {
  const requiredFeatures = [
    'Promise' in window,
    'fetch' in window,
    'localStorage' in window,
    'IntersectionObserver' in window,
    'CSS' in window && 'supports' in window.CSS
  ];
  
  const missingFeatures = [];
  
  if (!('Promise' in window)) missingFeatures.push('Promises');
  if (!('fetch' in window)) missingFeatures.push('Fetch API');
  if (!('localStorage' in window)) missingFeatures.push('Local Storage');
  if (!('IntersectionObserver' in window)) missingFeatures.push('Intersection Observer');
  if (!('CSS' in window && 'supports' in window.CSS)) missingFeatures.push('CSS.supports');
  
  if (missingFeatures.length > 0) {
    console.warn('Missing browser features:', missingFeatures);
    return {
      compatible: false,
      missing: missingFeatures
    };
  }
  
  return {
    compatible: true,
    missing: []
  };
}

// Version migration helper
export function migrateUserSettings(oldSettings) {
  const newSettings = { ...oldSettings };
  
  // Migrate theme settings
  if (oldSettings.theme === 'dark' && isFeatureEnabled('glassmorphicUI')) {
    newSettings.theme = 'glassmorphic-dark';
  } else if (oldSettings.theme === 'light' && isFeatureEnabled('glassmorphicUI')) {
    newSettings.theme = 'glassmorphic-light';
  }
  
  // Migrate feature preferences
  if (!newSettings.features) {
    newSettings.features = {};
  }
  
  // Add new default settings
  newSettings.features = {
    ...newSettings.features,
    animations: true,
    autoSave: true,
    realTimeSync: isFeatureEnabled('realTimeNotifications')
  };
  
  return newSettings;
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.synthexCompatibility = {
    withCompatibility,
    getCompatibleStyles,
    CompatibleAPI,
    progressiveEnhancement,
    loadFeature,
    checkBrowserCompatibility,
    migrateUserSettings
  };
}