/**
 * A/B Testing Framework
 * Manage experiments and track performance
 */

import { createClient } from '@supabase/supabase-js';

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;
  variants: Variant[];
  targetAudience?: TargetAudience;
  metrics: ExperimentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface Variant {
  id: string;
  name: string;
  description?: string;
  weight: number; // Traffic allocation percentage
  content?: any; // Variant-specific content
  isControl: boolean;
  metrics?: VariantMetrics;
}

export interface TargetAudience {
  segments?: string[];
  platforms?: string[];
  countries?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  customRules?: Record<string, unknown>;
}

export interface ExperimentMetrics {
  totalParticipants: number;
  conversions: number;
  conversionRate: number;
  engagement: number;
  confidence: number;
  winner?: string;
}

export interface VariantMetrics {
  participants: number;
  conversions: number;
  conversionRate: number;
  engagement: number;
  averageTimeSpent?: number;
  bounceRate?: number;
}

class ABTestingService {
  private supabase: any;
  private experiments: Map<string, Experiment> = new Map();
  private userAssignments: Map<string, Map<string, string>> = new Map(); // userId -> experimentId -> variantId

  constructor() {
    if (typeof window !== 'undefined' || typeof process !== 'undefined') {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
  }

  /**
   * Create a new experiment
   */
  async createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>): Promise<Experiment> {
    const newExperiment: Experiment = {
      ...experiment,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metrics: {
        totalParticipants: 0,
        conversions: 0,
        conversionRate: 0,
        engagement: 0,
        confidence: 0
      }
    };

    // Validate variant weights sum to 100
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100%');
    }

    // Save to database
    const { error } = await this.supabase
      .from('experiments')
      .insert(newExperiment);

    if (error) throw error;

    this.experiments.set(newExperiment.id, newExperiment);
    return newExperiment;
  }

  /**
   * Get variant for user
   */
  async getVariant(experimentId: string, userId: string): Promise<Variant | null> {
    // Check if user already assigned
    let userExperiments = this.userAssignments.get(userId);
    if (userExperiments?.has(experimentId)) {
      const variantId = userExperiments.get(experimentId)!;
      const experiment = await this.getExperiment(experimentId);
      return experiment?.variants.find(v => v.id === variantId) || null;
    }

    // Get experiment
    const experiment = await this.getExperiment(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check target audience
    if (experiment.targetAudience && !await this.isUserEligible(userId, experiment.targetAudience)) {
      return null;
    }

    // Assign variant based on weights
    const variant = this.assignVariant(experiment.variants, userId);
    
    // Save assignment
    await this.saveAssignment(userId, experimentId, variant.id);
    
    // Track participant
    await this.trackEvent(experimentId, variant.id, 'participant', userId);

    return variant;
  }

  /**
   * Assign variant based on weights and deterministic hash
   */
  private assignVariant(variants: Variant[], userId: string): Variant {
    // Create deterministic hash from userId
    const hash = this.hashCode(userId);
    const bucket = Math.abs(hash) % 100;
    
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant;
      }
    }
    
    return variants[variants.length - 1]; // Fallback to last variant
  }

  /**
   * Simple hash function for deterministic assignment
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Save user assignment
   */
  private async saveAssignment(userId: string, experimentId: string, variantId: string): Promise<void> {
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(experimentId, variantId);

    // Save to database
    await this.supabase
      .from('experiment_assignments')
      .insert({
        user_id: userId,
        experiment_id: experimentId,
        variant_id: variantId,
        assigned_at: new Date().toISOString()
      });
  }

  /**
   * Track experiment event
   */
  async trackEvent(
    experimentId: string,
    variantId: string,
    eventType: 'participant' | 'conversion' | 'engagement' | 'custom',
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Save event to database
    await this.supabase
      .from('experiment_events')
      .insert({
        experiment_id: experimentId,
        variant_id: variantId,
        user_id: userId,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString()
      });

    // Update metrics
    await this.updateMetrics(experimentId, variantId, eventType);
  }

  /**
   * Update experiment metrics
   */
  private async updateMetrics(experimentId: string, variantId: string, eventType: string): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) return;

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) return;

    // Initialize variant metrics if not exists
    if (!variant.metrics) {
      variant.metrics = {
        participants: 0,
        conversions: 0,
        conversionRate: 0,
        engagement: 0
      };
    }

    // Update metrics based on event type
    switch (eventType) {
      case 'participant':
        variant.metrics.participants++;
        experiment.metrics.totalParticipants++;
        break;
      case 'conversion':
        variant.metrics.conversions++;
        experiment.metrics.conversions++;
        break;
      case 'engagement':
        variant.metrics.engagement++;
        experiment.metrics.engagement++;
        break;
    }

    // Calculate conversion rates
    if (variant.metrics.participants > 0) {
      variant.metrics.conversionRate = (variant.metrics.conversions / variant.metrics.participants) * 100;
    }
    if (experiment.metrics.totalParticipants > 0) {
      experiment.metrics.conversionRate = (experiment.metrics.conversions / experiment.metrics.totalParticipants) * 100;
    }

    // Calculate statistical significance
    experiment.metrics.confidence = this.calculateConfidence(experiment);

    // Determine winner if confidence is high enough
    if (experiment.metrics.confidence >= 95) {
      const winner = this.determineWinner(experiment);
      if (winner) {
        experiment.metrics.winner = winner.id;
      }
    }

    // Save updated metrics
    await this.supabase
      .from('experiments')
      .update({ metrics: experiment.metrics, updated_at: new Date().toISOString() })
      .eq('id', experimentId);
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(experiment: Experiment): number {
    // Simplified confidence calculation
    // In production, use proper statistical tests (chi-square, t-test, etc.)
    const control = experiment.variants.find(v => v.isControl);
    const variant = experiment.variants.find(v => !v.isControl);
    
    if (!control?.metrics || !variant?.metrics) return 0;
    
    const minSampleSize = 100;
    if (control.metrics.participants < minSampleSize || variant.metrics.participants < minSampleSize) {
      return 0;
    }

    // Calculate z-score
    const p1 = control.metrics.conversionRate / 100;
    const p2 = variant.metrics.conversionRate / 100;
    const n1 = control.metrics.participants;
    const n2 = variant.metrics.participants;
    
    const pooledP = (control.metrics.conversions + variant.metrics.conversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    
    if (se === 0) return 0;
    
    const z = Math.abs((p1 - p2) / se);
    
    // Convert z-score to confidence level
    // Simplified conversion (use statistical library in production)
    if (z >= 2.58) return 99;
    if (z >= 1.96) return 95;
    if (z >= 1.64) return 90;
    return Math.min(89, z * 45);
  }

  /**
   * Determine experiment winner
   */
  private determineWinner(experiment: Experiment): Variant | null {
    let bestVariant: Variant | null = null;
    let bestRate = -1;

    for (const variant of experiment.variants) {
      if (variant.metrics && variant.metrics.conversionRate > bestRate) {
        bestRate = variant.metrics.conversionRate;
        bestVariant = variant;
      }
    }

    return bestVariant;
  }

  /**
   * Check if user is eligible for experiment
   */
  private async isUserEligible(userId: string, targetAudience: TargetAudience): Promise<boolean> {
    // Get user profile
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return false;

    // Check audience criteria
    if (targetAudience.minFollowers && profile.followers < targetAudience.minFollowers) {
      return false;
    }
    if (targetAudience.maxFollowers && profile.followers > targetAudience.maxFollowers) {
      return false;
    }
    // Add more criteria checks as needed

    return true;
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<Experiment | null> {
    if (this.experiments.has(experimentId)) {
      return this.experiments.get(experimentId)!;
    }

    const { data, error } = await this.supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single();

    if (error || !data) return null;

    this.experiments.set(experimentId, data);
    return data;
  }

  /**
   * Get all experiments
   */
  async getExperiments(status?: string): Promise<Experiment[]> {
    const query = this.supabase.from('experiments').select('*');
    
    if (status) {
      query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch experiments:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update experiment status
   */
  async updateExperimentStatus(experimentId: string, status: Experiment['status']): Promise<boolean> {
    const { error } = await this.supabase
      .from('experiments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', experimentId);

    if (!error) {
      const experiment = this.experiments.get(experimentId);
      if (experiment) {
        experiment.status = status;
        experiment.updatedAt = new Date();
      }
    }

    return !error;
  }

  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<any> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) return null;

    return {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        duration: experiment.endDate 
          ? Math.floor((experiment.endDate.getTime() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      metrics: experiment.metrics,
      variants: experiment.variants.map(v => ({
        id: v.id,
        name: v.name,
        isControl: v.isControl,
        weight: v.weight,
        metrics: v.metrics
      })),
      recommendation: experiment.metrics.confidence >= 95 
        ? `Variant "${experiment.variants.find(v => v.id === experiment.metrics.winner)?.name}" is the winner with ${experiment.metrics.confidence}% confidence`
        : `Need more data. Current confidence: ${experiment.metrics.confidence}%`
    };
  }
}

// Create singleton instance
export const abTestingService = new ABTestingService();