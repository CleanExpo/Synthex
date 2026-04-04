/**
 * Feature Flags Management System
 * Controls gradual rollout of new features
 */

class FeatureFlags {
  constructor() {
    this.flags = this.loadFlags();
    this.userSegments = this.loadUserSegments();
    this.rolloutPercentage = 0;
  }

  // Load flags from configuration
  loadFlags() {
    return {
      // UI Features
      glassmorphicUI: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'New glassmorphic design system'
      },
      
      // Component Features
      chartsComponent: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: ['glassmorphicUI'],
        description: 'Advanced chart visualizations'
      },
      
      calendarComponent: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: ['glassmorphicUI'],
        description: 'Enhanced calendar with scheduling'
      },
      
      fileUploadComponent: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: ['glassmorphicUI'],
        description: 'Drag-and-drop file upload'
      },
      
      notificationsComponent: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: ['glassmorphicUI'],
        description: 'Real-time notification system'
      },
      
      // Platform Optimizers
      instagramOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'Instagram content optimization'
      },
      
      facebookOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'Facebook content optimization'
      },
      
      twitterOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'Twitter/X content optimization'
      },
      
      linkedinOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'LinkedIn content optimization'
      },
      
      tiktokOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'TikTok content optimization'
      },
      
      pinterestOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'Pinterest content optimization'
      },
      
      youtubeOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'YouTube content optimization'
      },
      
      redditOptimizer: {
        enabled: false,
        rolloutPercentage: 0,
        dependencies: [],
        description: 'Reddit content optimization'
      },
      
      // System Features
      performanceMonitoring: {
        enabled: true,
        rolloutPercentage: 100,
        dependencies: [],
        description: 'Real-time performance monitoring'
      },
      
      errorTracking: {
        enabled: true,
        rolloutPercentage: 100,
        dependencies: [],
        description: 'Enhanced error tracking and reporting'
      }
    };
  }

  // Load user segments for targeted rollout
  loadUserSegments() {
    return {
      beta: {
        users: [],
        percentage: 100,
        features: ['all']
      },
      earlyAdopters: {
        users: [],
        percentage: 50,
        features: ['glassmorphicUI', 'platformOptimizers']
      },
      standard: {
        users: [],
        percentage: 10,
        features: []
      }
    };
  }

  // Check if feature is enabled for user
  isEnabled(featureName, userId = null) {
    const feature = this.flags[featureName];
    
    if (!feature) {
      console.warn(`Feature ${featureName} not found`);
      return false;
    }

    // Check dependencies first
    if (!this.checkDependencies(featureName)) {
      return false;
    }

    // Check if globally enabled
    if (feature.enabled && feature.rolloutPercentage === 100) {
      return true;
    }

    // Check user segment
    if (userId && this.isInSegment(userId, featureName)) {
      return true;
    }

    // Check rollout percentage
    if (userId && this.isInRollout(userId, feature.rolloutPercentage)) {
      return true;
    }

    return false;
  }

  // Check feature dependencies
  checkDependencies(featureName) {
    const feature = this.flags[featureName];
    if (!feature.dependencies || feature.dependencies.length === 0) {
      return true;
    }

    return feature.dependencies.every(dep => 
      this.flags[dep] && this.flags[dep].enabled
    );
  }

  // Check if user is in specific segment
  isInSegment(userId, featureName) {
    for (const [segmentName, segment] of Object.entries(this.userSegments)) {
      if (segment.users.includes(userId)) {
        if (segment.features.includes('all') || 
            segment.features.includes(featureName)) {
          return true;
        }
      }
    }
    return false;
  }

  // Check if user is in rollout percentage
  isInRollout(userId, percentage) {
    if (percentage === 0) return false;
    if (percentage === 100) return true;
    
    // Use consistent hash for user
    const hash = this.hashUserId(userId);
    return (hash % 100) < percentage;
  }

  // Generate consistent hash for user ID
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Update rollout percentage for a feature
  updateRollout(featureName, percentage) {
    if (this.flags[featureName]) {
      this.flags[featureName].rolloutPercentage = percentage;
      this.flags[featureName].enabled = percentage > 0;
      this.saveFlags();
      console.log(`Updated ${featureName} rollout to ${percentage}%`);
    }
  }

  // Enable feature for specific user segment
  enableForSegment(featureName, segmentName) {
    if (this.userSegments[segmentName]) {
      if (!this.userSegments[segmentName].features.includes(featureName)) {
        this.userSegments[segmentName].features.push(featureName);
        this.saveSegments();
        console.log(`Enabled ${featureName} for ${segmentName} segment`);
      }
    }
  }

  // Add user to segment
  addUserToSegment(userId, segmentName) {
    if (this.userSegments[segmentName]) {
      if (!this.userSegments[segmentName].users.includes(userId)) {
        this.userSegments[segmentName].users.push(userId);
        this.saveSegments();
        console.log(`Added user ${userId} to ${segmentName} segment`);
      }
    }
  }

  // Get all enabled features for user
  getEnabledFeatures(userId = null) {
    const enabled = [];
    for (const [name, feature] of Object.entries(this.flags)) {
      if (this.isEnabled(name, userId)) {
        enabled.push(name);
      }
    }
    return enabled;
  }

  // Get feature configuration
  getFeatureConfig(featureName) {
    return this.flags[featureName] || null;
  }

  // Save flags to storage
  saveFlags() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('featureFlags', JSON.stringify(this.flags));
    }
  }

  // Save segments to storage
  saveSegments() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('userSegments', JSON.stringify(this.userSegments));
    }
  }

  // Create rollout plan
  createRolloutPlan(featureName) {
    return {
      feature: featureName,
      stages: [
        { percentage: 1, duration: '1 hour', description: 'Canary deployment' },
        { percentage: 5, duration: '2 hours', description: 'Early validation' },
        { percentage: 10, duration: '4 hours', description: 'Initial rollout' },
        { percentage: 25, duration: '8 hours', description: 'Expanded testing' },
        { percentage: 50, duration: '12 hours', description: 'Half rollout' },
        { percentage: 75, duration: '12 hours', description: 'Majority rollout' },
        { percentage: 100, duration: 'permanent', description: 'Full rollout' }
      ],
      rollback: {
        trigger: 'Error rate > 5% or performance degradation > 50%',
        action: 'Set percentage to 0 and notify team'
      }
    };
  }

  // Execute gradual rollout
  async executeRollout(featureName, options = {}) {
    const plan = this.createRolloutPlan(featureName);
    
    for (const stage of plan.stages) {
      console.log(`Rolling out ${featureName} to ${stage.percentage}%`);
      
      this.updateRollout(featureName, stage.percentage);
      
      // Monitor metrics
      const metrics = await this.monitorMetrics(featureName, stage.duration);
      
      if (metrics.shouldRollback) {
        console.error(`Rollback triggered for ${featureName}`);
        this.updateRollout(featureName, 0);
        return false;
      }
      
      // Wait before next stage
      if (stage.percentage < 100) {
        await this.wait(this.parseDuration(stage.duration));
      }
    }
    
    console.log(`${featureName} fully rolled out successfully`);
    return true;
  }

  // Monitor feature metrics
  async monitorMetrics(featureName, duration) {
    // This would connect to your monitoring service
    // For demo, returning mock data
    return {
      errorRate: Math.random() * 0.03,
      performance: Math.random() * 100 + 200,
      userFeedback: Math.random() * 0.9 + 0.1,
      shouldRollback: Math.random() < 0.05 // 5% chance of rollback for demo
    };
  }

  // Parse duration string to milliseconds
  parseDuration(duration) {
    const match = duration.match(/(\d+)\s*(hour|minute|second)s?/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch(unit) {
      case 'hour': return value * 60 * 60 * 1000;
      case 'minute': return value * 60 * 1000;
      case 'second': return value * 1000;
      default: return 0;
    }
  }

  // Wait for specified milliseconds
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// React Hook for feature flags
function useFeatureFlag(featureName) {
  const [isEnabled, setIsEnabled] = React.useState(false);
  
  React.useEffect(() => {
    const flags = new FeatureFlags();
    const userId = getUserId(); // Implement this based on your auth system
    setIsEnabled(flags.isEnabled(featureName, userId));
  }, [featureName]);
  
  return isEnabled;
}

// HOC for feature-flagged components
function withFeatureFlag(featureName) {
  return function(Component) {
    return function FeatureFlaggedComponent(props) {
      const isEnabled = useFeatureFlag(featureName);
      
      if (!isEnabled) {
        return null; // Or return fallback component
      }
      
      return <Component {...props} />;
    };
  };
}

// Export for use in application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FeatureFlags, useFeatureFlag, withFeatureFlag };
} else {
  window.FeatureFlags = FeatureFlags;
}