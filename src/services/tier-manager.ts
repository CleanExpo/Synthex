/**
 * Tier Management Service
 * Manages user tier limits and feature access
 * Currently all tiers are FREE during beta period
 */

export interface TierLimits {
  platforms: number | 'unlimited';
  postsPerMonth: number | 'unlimited';
  aiGenerations: number | 'unlimited';
  teamMembers: number | 'unlimited';
  analyticsRetentionDays: number | 'unlimited';
  videoGenerations: number | 'unlimited';
  storageGB: number | 'unlimited';
  features: {
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    videoGeneration: boolean;
    voiceCommands: boolean;
    competitorAnalysis: boolean;
  };
}

export class TierManager {
  private static tiers: Record<string, TierLimits> = {
    starter: {
      platforms: 3,
      postsPerMonth: 100,
      aiGenerations: 50,
      teamMembers: 1,
      analyticsRetentionDays: 30,
      videoGenerations: 0,
      storageGB: 1,
      features: {
        advancedAnalytics: false,
        prioritySupport: false,
        customBranding: false,
        apiAccess: false,
        videoGeneration: false,
        voiceCommands: true,
        competitorAnalysis: false,
      }
    },
    professional: {
      platforms: 8,
      postsPerMonth: 500,
      aiGenerations: 250,
      teamMembers: 3,
      analyticsRetentionDays: 90,
      videoGenerations: 20,
      storageGB: 10,
      features: {
        advancedAnalytics: true,
        prioritySupport: false,
        customBranding: true,
        apiAccess: true,
        videoGeneration: true,
        voiceCommands: true,
        competitorAnalysis: true,
      }
    },
    business: {
      platforms: 'unlimited',
      postsPerMonth: 2000,
      aiGenerations: 1000,
      teamMembers: 10,
      analyticsRetentionDays: 365,
      videoGenerations: 100,
      storageGB: 100,
      features: {
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        videoGeneration: true,
        voiceCommands: true,
        competitorAnalysis: true,
      }
    },
    enterprise: {
      platforms: 'unlimited',
      postsPerMonth: 'unlimited',
      aiGenerations: 'unlimited',
      teamMembers: 'unlimited',
      analyticsRetentionDays: 'unlimited',
      videoGenerations: 'unlimited',
      storageGB: 'unlimited',
      features: {
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        videoGeneration: true,
        voiceCommands: true,
        competitorAnalysis: true,
      }
    }
  };

  /**
   * Get tier limits for a specific tier
   */
  static getTierLimits(tier: string): TierLimits {
    return this.tiers[tier] || this.tiers.starter;
  }

  /**
   * Check if a user can perform an action based on their tier
   */
  static canPerformAction(
    userTier: string,
    action: string,
    currentUsage?: number
  ): { allowed: boolean; message?: string; limit?: number | string } {
    const limits = this.getTierLimits(userTier);
    
    switch (action) {
      case 'addPlatform':
        if (limits.platforms === 'unlimited') {
          return { allowed: true };
        }
        return {
          allowed: currentUsage ? currentUsage < limits.platforms : true,
          message: `Your ${userTier} plan allows up to ${limits.platforms} platforms`,
          limit: limits.platforms
        };
        
      case 'createPost':
        if (limits.postsPerMonth === 'unlimited') {
          return { allowed: true };
        }
        return {
          allowed: currentUsage ? currentUsage < limits.postsPerMonth : true,
          message: `Your ${userTier} plan allows up to ${limits.postsPerMonth} posts per month`,
          limit: limits.postsPerMonth
        };
        
      case 'generateAI':
        if (limits.aiGenerations === 'unlimited') {
          return { allowed: true };
        }
        return {
          allowed: currentUsage ? currentUsage < limits.aiGenerations : true,
          message: `Your ${userTier} plan allows up to ${limits.aiGenerations} AI generations per month`,
          limit: limits.aiGenerations
        };
        
      case 'addTeamMember':
        if (limits.teamMembers === 'unlimited') {
          return { allowed: true };
        }
        return {
          allowed: currentUsage ? currentUsage < limits.teamMembers : true,
          message: `Your ${userTier} plan allows up to ${limits.teamMembers} team members`,
          limit: limits.teamMembers
        };
        
      case 'generateVideo':
        if (!limits.features.videoGeneration) {
          return {
            allowed: false,
            message: `Video generation is not available in the ${userTier} plan. Upgrade to Professional or higher.`
          };
        }
        if (limits.videoGenerations === 'unlimited') {
          return { allowed: true };
        }
        return {
          allowed: currentUsage ? currentUsage < limits.videoGenerations : true,
          message: `Your ${userTier} plan allows up to ${limits.videoGenerations} video generations per month`,
          limit: limits.videoGenerations
        };
        
      default:
        return { allowed: true };
    }
  }

  /**
   * Get feature availability for a tier
   */
  static hasFeature(userTier: string, feature: keyof TierLimits['features']): boolean {
    const limits = this.getTierLimits(userTier);
    return limits.features[feature] || false;
  }

  /**
   * Get upgrade suggestions based on usage
   */
  static getUpgradeSuggestion(
    currentTier: string,
    usage: {
      platforms?: number;
      postsPerMonth?: number;
      aiGenerations?: number;
      teamMembers?: number;
    }
  ): { shouldUpgrade: boolean; suggestedTier?: string; reasons: string[]; benefits: string[] } {
    const limits = this.getTierLimits(currentTier);
    const reasons: string[] = [];
    let shouldUpgrade = false;

    // Check if user is hitting limits
    if (usage.platforms && limits.platforms !== 'unlimited' && usage.platforms >= limits.platforms * 0.8) {
      reasons.push('You\'re approaching your platform limit');
      shouldUpgrade = true;
    }

    if (usage.postsPerMonth && limits.postsPerMonth !== 'unlimited' && usage.postsPerMonth >= limits.postsPerMonth * 0.8) {
      reasons.push('You\'re approaching your monthly post limit');
      shouldUpgrade = true;
    }

    if (usage.aiGenerations && limits.aiGenerations !== 'unlimited' && usage.aiGenerations >= limits.aiGenerations * 0.8) {
      reasons.push('You\'re approaching your AI generation limit');
      shouldUpgrade = true;
    }

    if (usage.teamMembers && limits.teamMembers !== 'unlimited' && usage.teamMembers >= limits.teamMembers) {
      reasons.push('You need more team member slots');
      shouldUpgrade = true;
    }

    // Suggest next tier
    let suggestedTier: string | undefined;
    if (shouldUpgrade) {
      if (currentTier === 'starter') {
        suggestedTier = 'professional';
      } else if (currentTier === 'professional') {
        suggestedTier = 'business';
      } else if (currentTier === 'business') {
        suggestedTier = 'enterprise';
      }
    }

    return { shouldUpgrade, suggestedTier, reasons, benefits: [] };
  }

  /**
   * Format tier name for display
   */
  static formatTierName(tier: string): string {
    const names: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      business: 'Business',
      enterprise: 'Enterprise'
    };
    return names[tier] || 'Starter';
  }

  /**
   * Get tier badge color
   */
  static getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      starter: '#94a3b8',
      professional: '#3b82f6',
      business: '#06b6d4',
      enterprise: '#f59e0b'
    };
    return colors[tier] || '#94a3b8';
  }
}

export default TierManager;