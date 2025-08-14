/**
 * Feature Flags System for Safe Rollout
 * Implements kill switches and canary deployment controls
 */

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number;
  allowedUsers?: string[];
  killSwitch?: boolean;
  description: string;
}

// Feature flag configuration with kill switches for risky areas
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Payment System Kill Switch
  PAYMENTS_ENABLED: {
    key: 'payments_enabled',
    enabled: false, // Start disabled, enable after validation
    killSwitch: true,
    description: 'Master kill switch for payment processing'
  },
  
  // Onboarding Flow Control
  NEW_ONBOARDING_FLOW: {
    key: 'new_onboarding_flow',
    enabled: true,
    rolloutPercentage: 5, // Start with 5% canary
    killSwitch: true,
    description: 'New user onboarding experience'
  },
  
  // AI Content Generation
  AI_CONTENT_GENERATION: {
    key: 'ai_content_generation',
    enabled: true,
    rolloutPercentage: 25, // 25% rollout
    description: 'AI-powered content generation features'
  },
  
  // Social Media Integration
  SOCIAL_POSTING: {
    key: 'social_posting',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Direct social media posting'
  },
  
  // Analytics Dashboard
  ADVANCED_ANALYTICS: {
    key: 'advanced_analytics',
    enabled: true,
    rolloutPercentage: 50,
    description: 'Enhanced analytics features'
  },
  
  // Email Notifications
  EMAIL_NOTIFICATIONS: {
    key: 'email_notifications',
    enabled: true,
    killSwitch: true,
    description: 'Email notification system'
  },
  
  // Rate Limiting
  STRICT_RATE_LIMITING: {
    key: 'strict_rate_limiting',
    enabled: true,
    description: 'Enhanced rate limiting for APIs'
  },
  
  // Maintenance Mode
  MAINTENANCE_MODE: {
    key: 'maintenance_mode',
    enabled: false,
    killSwitch: true,
    description: 'System-wide maintenance mode'
  }
};

/**
 * Check if a feature is enabled for a user
 */
export function isFeatureEnabled(
  flagKey: string,
  userId?: string
): boolean {
  const flag = FEATURE_FLAGS[flagKey];
  
  if (!flag || !flag.enabled) {
    return false;
  }
  
  // Check kill switch
  if (flag.killSwitch && process.env.KILL_ALL_FEATURES === 'true') {
    return false;
  }
  
  // Check specific kill switch
  if (process.env[`KILL_${flagKey}`] === 'true') {
    return false;
  }
  
  // Check allowed users
  if (flag.allowedUsers && userId) {
    if (!flag.allowedUsers.includes(userId)) {
      return false;
    }
  }
  
  // Check rollout percentage
  if (flag.rolloutPercentage && flag.rolloutPercentage < 100) {
    if (!userId) return false;
    
    // Deterministic rollout based on user ID
    const hash = userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    const userPercentage = Math.abs(hash) % 100;
    return userPercentage < flag.rolloutPercentage;
  }
  
  return true;
}

/**
 * Get feature flag configuration for runtime updates
 */
export async function getFeatureFlags(): Promise<Record<string, FeatureFlag>> {
  // In production, this could fetch from a feature flag service
  // For now, return static configuration with env overrides
  
  const flags = { ...FEATURE_FLAGS };
  
  // Apply environment variable overrides
  Object.keys(flags).forEach(key => {
    const envKey = `FF_${key}`;
    if (process.env[envKey]) {
      flags[key].enabled = process.env[envKey] === 'true';
    }
  });
  
  return flags;
}

/**
 * Canary deployment percentage controller
 */
export function getCanaryPercentage(): number {
  return parseInt(process.env.CANARY_PERCENTAGE || '0', 10);
}

/**
 * Check if current instance is in canary deployment
 */
export function isCanaryInstance(): boolean {
  return process.env.DEPLOYMENT_TYPE === 'canary';
}

/**
 * Emergency kill switch for all features
 */
export function activateKillSwitch(feature?: string): void {
  if (feature) {
    process.env[`KILL_${feature}`] = 'true';
    console.error(`🚨 Kill switch activated for: ${feature}`);
  } else {
    process.env.KILL_ALL_FEATURES = 'true';
    console.error('🚨 EMERGENCY: All feature kill switches activated');
  }
}