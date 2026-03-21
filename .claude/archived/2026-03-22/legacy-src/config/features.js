/**
 * Feature Flags Configuration
 * Central configuration for all feature flags
 */

export const features = {
  // UI Features
  glassmorphicUI: process.env.REACT_APP_GLASSMORPHIC || false,
  
  // Component Features
  platformOptimizers: process.env.REACT_APP_OPTIMIZERS || false,
  newAnalytics: process.env.REACT_APP_ANALYTICS || false,
  enhancedCalendar: process.env.REACT_APP_CALENDAR || false,
  advancedCharts: process.env.REACT_APP_CHARTS || false,
  dragDropUpload: process.env.REACT_APP_FILE_UPLOAD || false,
  realTimeNotifications: process.env.REACT_APP_NOTIFICATIONS || false,
  
  // Platform Specific Optimizers
  instagramOptimizer: process.env.REACT_APP_INSTAGRAM || false,
  facebookOptimizer: process.env.REACT_APP_FACEBOOK || false,
  twitterOptimizer: process.env.REACT_APP_TWITTER || false,
  linkedinOptimizer: process.env.REACT_APP_LINKEDIN || false,
  tiktokOptimizer: process.env.REACT_APP_TIKTOK || false,
  pinterestOptimizer: process.env.REACT_APP_PINTEREST || false,
  youtubeOptimizer: process.env.REACT_APP_YOUTUBE || false,
  redditOptimizer: process.env.REACT_APP_REDDIT || false,
  
  // System Features
  performanceMonitoring: process.env.REACT_APP_MONITORING !== 'false',
  errorTracking: process.env.REACT_APP_ERROR_TRACKING !== 'false',
  debugMode: process.env.NODE_ENV === 'development'
};

// Feature dependencies
export const featureDependencies = {
  advancedCharts: ['glassmorphicUI'],
  enhancedCalendar: ['glassmorphicUI'],
  dragDropUpload: ['glassmorphicUI'],
  realTimeNotifications: ['glassmorphicUI']
};

// Check if a feature is enabled
export function isFeatureEnabled(featureName) {
  // Check if feature exists
  if (!(featureName in features)) {
    console.warn(`Feature '${featureName}' not found in configuration`);
    return false;
  }
  
  // Check dependencies
  if (featureDependencies[featureName]) {
    const deps = featureDependencies[featureName];
    const depsEnabled = deps.every(dep => features[dep]);
    if (!depsEnabled) {
      return false;
    }
  }
  
  return features[featureName] === true || features[featureName] === 'true';
}

// Get all enabled features
export function getEnabledFeatures() {
  return Object.keys(features).filter(feature => isFeatureEnabled(feature));
}

// Check multiple features at once
export function areFeaturesEnabled(...featureNames) {
  return featureNames.every(feature => isFeatureEnabled(feature));
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.synthexFeatures = {
    features,
    isFeatureEnabled,
    getEnabledFeatures,
    areFeaturesEnabled
  };
}