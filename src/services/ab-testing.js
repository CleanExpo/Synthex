/**
 * A/B Testing Framework
 * Comprehensive content optimization through experimentation
 */

import { db } from '../lib/supabase.js';
import { redisService } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { advancedAnalytics } from '../analytics/advanced-analytics.js';

// A/B Testing configuration
const AB_CONFIG = {
  // Experiment settings
  experiments: {
    maxConcurrent: 10,
    minSampleSize: 100,
    confidenceLevel: 0.95,
    defaultDuration: 14 * 24 * 60 * 60 * 1000, // 14 days
    autoStopThreshold: 0.99 // Stop when confidence reaches 99%
  },
  
  // Traffic allocation
  traffic: {
    defaultSplit: [50, 50], // Control vs variant
    maxVariants: 5,
    stickyAssignment: true, // Keep users in same variant
    cookieName: 'ab_assignment',
    cookieDuration: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  
  // Metrics tracking
  metrics: {
    primary: ['engagement_rate', 'click_through_rate', 'conversion_rate'],
    secondary: ['time_on_page', 'bounce_rate', 'shares'],
    customEvents: true
  },
  
  // Statistical settings
  statistics: {
    method: 'bayesian', // 'bayesian' or 'frequentist'
    priorAlpha: 1,
    priorBeta: 1,
    minDetectableEffect: 0.05
  }
};

class ABTestingFramework {
  constructor() {
    this.activeExperiments = new Map();
    this.userAssignments = new Map();
    this.experimentResults = new Map();
    this.init();
  }

  async init() {
    logger.info('Initializing A/B Testing framework', { category: 'ab_testing' });
    
    // Load active experiments from database
    await this.loadActiveExperiments();
    
    // Start result calculation job
    this.startResultCalculation();
    
    // Initialize cleanup job
    this.startCleanupJob();
    
    logger.info('A/B Testing framework initialized', { 
      category: 'ab_testing',
      activeExperiments: this.activeExperiments.size
    });
  }

  // Create a new A/B test experiment
  async createExperiment(experimentData) {
    const experiment = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: experimentData.name,
      description: experimentData.description,
      hypothesis: experimentData.hypothesis,
      type: experimentData.type || 'content',
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: experimentData.createdBy,
      
      // Variants configuration
      variants: this.validateVariants(experimentData.variants),
      control: experimentData.control || experimentData.variants[0],
      
      // Traffic allocation
      trafficAllocation: experimentData.trafficAllocation || 
        this.calculateEvenSplit(experimentData.variants.length),
      targetAudience: experimentData.targetAudience || {},
      
      // Metrics
      primaryMetric: experimentData.primaryMetric,
      secondaryMetrics: experimentData.secondaryMetrics || [],
      successCriteria: experimentData.successCriteria,
      
      // Duration
      startDate: experimentData.startDate,
      endDate: experimentData.endDate || 
        new Date(Date.now() + AB_CONFIG.experiments.defaultDuration).toISOString(),
      
      // Settings
      minSampleSize: experimentData.minSampleSize || AB_CONFIG.experiments.minSampleSize,
      confidenceLevel: experimentData.confidenceLevel || AB_CONFIG.experiments.confidenceLevel,
      autoStop: experimentData.autoStop !== false,
      
      // Results placeholder
      results: {
        control: { visitors: 0, conversions: 0 },
        variants: {}
      }
    };

    try {
      // Validate experiment
      await this.validateExperiment(experiment);
      
      // Store in database
      const { error } = await db.supabase
        .from('ab_experiments')
        .insert({
          experiment_id: experiment.id,
          name: experiment.name,
          config: experiment,
          status: experiment.status,
          created_at: experiment.createdAt,
          created_by: experiment.createdBy
        });

      if (error) throw error;
      
      // Add to active experiments
      this.activeExperiments.set(experiment.id, experiment);
      
      logger.info('A/B test experiment created', {
        category: 'ab_testing',
        experimentId: experiment.id,
        name: experiment.name
      });
      
      return {
        success: true,
        experiment
      };
      
    } catch (error) {
      logger.error('Failed to create A/B test experiment', error, {
        category: 'ab_testing',
        experimentName: experiment.name
      });
      throw error;
    }
  }

  // Start an experiment
  async startExperiment(experimentId) {
    try {
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }
      
      if (experiment.status === 'running') {
        throw new Error('Experiment is already running');
      }
      
      // Update status
      experiment.status = 'running';
      experiment.startedAt = new Date().toISOString();
      
      // Update in database
      await db.supabase
        .from('ab_experiments')
        .update({
          status: 'running',
          started_at: experiment.startedAt,
          config: experiment
        })
        .eq('experiment_id', experimentId);
      
      logger.info('A/B test experiment started', {
        category: 'ab_testing',
        experimentId,
        name: experiment.name
      });
      
      return { success: true, experiment };
      
    } catch (error) {
      logger.error('Failed to start experiment', error, {
        category: 'ab_testing',
        experimentId
      });
      throw error;
    }
  }

  // Assign user to variant
  async assignUserToVariant(userId, experimentId, context = {}) {
    try {
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment || experiment.status !== 'running') {
        return null;
      }
      
      // Check if user meets target audience criteria
      if (!this.meetsTargetCriteria(context, experiment.targetAudience)) {
        return null;
      }
      
      // Check for existing assignment (sticky assignment)
      const existingAssignment = await this.getUserAssignment(userId, experimentId);
      if (existingAssignment) {
        return existingAssignment;
      }
      
      // Assign to variant based on traffic allocation
      const variant = this.selectVariant(experiment);
      
      // Store assignment
      const assignment = {
        userId,
        experimentId,
        variant,
        assignedAt: new Date().toISOString(),
        context
      };
      
      await this.storeUserAssignment(assignment);
      
      // Track assignment event
      await advancedAnalytics.trackEvent({
        type: 'ab_test_assignment',
        userId,
        experimentId,
        variant,
        metadata: context
      });
      
      return variant;
      
    } catch (error) {
      logger.error('Failed to assign user to variant', error, {
        category: 'ab_testing',
        userId,
        experimentId
      });
      return null;
    }
  }

  // Track conversion event
  async trackConversion(userId, experimentId, conversionData = {}) {
    try {
      const assignment = await this.getUserAssignment(userId, experimentId);
      if (!assignment) {
        return { success: false, error: 'User not assigned to experiment' };
      }
      
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }
      
      // Track conversion
      const conversion = {
        userId,
        experimentId,
        variant: assignment.variant,
        conversionType: conversionData.type || 'default',
        value: conversionData.value || 1,
        metadata: conversionData.metadata || {},
        timestamp: new Date().toISOString()
      };
      
      // Store conversion
      await db.supabase
        .from('ab_conversions')
        .insert({
          user_id: userId,
          experiment_id: experimentId,
          variant: assignment.variant,
          conversion_type: conversion.conversionType,
          value: conversion.value,
          metadata: conversion.metadata,
          created_at: conversion.timestamp
        });
      
      // Update experiment results in real-time
      await this.updateExperimentResults(experimentId, assignment.variant, 'conversion');
      
      // Track analytics event
      await advancedAnalytics.trackEvent({
        type: 'ab_test_conversion',
        userId,
        experimentId,
        variant: assignment.variant,
        conversionType: conversion.conversionType,
        value: conversion.value,
        metadata: conversion.metadata
      });
      
      // Check if experiment should auto-stop
      if (experiment.autoStop) {
        await this.checkAutoStop(experimentId);
      }
      
      return { success: true, conversion };
      
    } catch (error) {
      logger.error('Failed to track conversion', error, {
        category: 'ab_testing',
        userId,
        experimentId
      });
      return { success: false, error: error.message };
    }
  }

  // Get experiment results
  async getExperimentResults(experimentId) {
    try {
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }
      
      // Fetch all conversions
      const { data: conversions, error: convError } = await db.supabase
        .from('ab_conversions')
        .select('*')
        .eq('experiment_id', experimentId);
      
      if (convError) throw convError;
      
      // Fetch all assignments
      const { data: assignments, error: assignError } = await db.supabase
        .from('ab_assignments')
        .select('*')
        .eq('experiment_id', experimentId);
      
      if (assignError) throw assignError;
      
      // Calculate results for each variant
      const results = {
        experimentId,
        name: experiment.name,
        status: experiment.status,
        startDate: experiment.startedAt,
        currentDate: new Date().toISOString(),
        sampleSize: assignments.length,
        variants: {}
      };
      
      // Process control and each variant
      const allVariants = ['control', ...experiment.variants.map(v => v.id)];
      
      for (const variant of allVariants) {
        const variantAssignments = assignments.filter(a => a.variant === variant);
        const variantConversions = conversions.filter(c => c.variant === variant);
        
        results.variants[variant] = {
          visitors: variantAssignments.length,
          conversions: variantConversions.length,
          conversionRate: variantAssignments.length > 0 ? 
            variantConversions.length / variantAssignments.length : 0,
          confidence: 0,
          uplift: 0,
          significance: false
        };
      }
      
      // Calculate statistical significance
      if (results.variants.control && results.variants.control.visitors > 0) {
        const controlRate = results.variants.control.conversionRate;
        
        for (const [variantId, variantData] of Object.entries(results.variants)) {
          if (variantId === 'control') continue;
          
          // Calculate uplift
          variantData.uplift = controlRate > 0 ? 
            ((variantData.conversionRate - controlRate) / controlRate) * 100 : 0;
          
          // Calculate statistical significance
          const significance = this.calculateSignificance(
            results.variants.control,
            variantData,
            experiment.confidenceLevel
          );
          
          variantData.confidence = significance.confidence;
          variantData.significance = significance.isSignificant;
          variantData.pValue = significance.pValue;
        }
      }
      
      // Add winner determination
      results.winner = this.determineWinner(results.variants, experiment);
      
      // Add recommendations
      results.recommendations = this.generateRecommendations(results, experiment);
      
      return results;
      
    } catch (error) {
      logger.error('Failed to get experiment results', error, {
        category: 'ab_testing',
        experimentId
      });
      throw error;
    }
  }

  // Calculate statistical significance
  calculateSignificance(control, variant, confidenceLevel) {
    if (AB_CONFIG.statistics.method === 'bayesian') {
      return this.bayesianSignificance(control, variant, confidenceLevel);
    } else {
      return this.frequentistSignificance(control, variant, confidenceLevel);
    }
  }

  // Bayesian A/B testing
  bayesianSignificance(control, variant, confidenceLevel) {
    const { priorAlpha, priorBeta } = AB_CONFIG.statistics;
    
    // Update posteriors
    const controlAlpha = priorAlpha + control.conversions;
    const controlBeta = priorBeta + control.visitors - control.conversions;
    
    const variantAlpha = priorAlpha + variant.conversions;
    const variantBeta = priorBeta + variant.visitors - variant.conversions;
    
    // Monte Carlo simulation for probability of variant being better
    const simulations = 10000;
    let variantWins = 0;
    
    for (let i = 0; i < simulations; i++) {
      const controlSample = this.sampleBeta(controlAlpha, controlBeta);
      const variantSample = this.sampleBeta(variantAlpha, variantBeta);
      
      if (variantSample > controlSample) {
        variantWins++;
      }
    }
    
    const confidence = variantWins / simulations;
    
    return {
      confidence,
      isSignificant: confidence >= confidenceLevel,
      pValue: 1 - confidence,
      method: 'bayesian'
    };
  }

  // Frequentist significance testing (Chi-square test)
  frequentistSignificance(control, variant, confidenceLevel) {
    const n1 = control.visitors;
    const n2 = variant.visitors;
    const x1 = control.conversions;
    const x2 = variant.conversions;
    
    if (n1 === 0 || n2 === 0) {
      return { confidence: 0, isSignificant: false, pValue: 1, method: 'frequentist' };
    }
    
    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const pPooled = (x1 + x2) / (n1 + n2);
    
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));
    
    if (se === 0) {
      return { confidence: 0, isSignificant: false, pValue: 1, method: 'frequentist' };
    }
    
    const z = (p2 - p1) / se;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    return {
      confidence: 1 - pValue,
      isSignificant: pValue < (1 - confidenceLevel),
      pValue,
      method: 'frequentist'
    };
  }

  // Stop an experiment
  async stopExperiment(experimentId, reason = 'manual') {
    try {
      const experiment = this.activeExperiments.get(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }
      
      // Get final results
      const finalResults = await this.getExperimentResults(experimentId);
      
      // Update experiment status
      experiment.status = 'completed';
      experiment.completedAt = new Date().toISOString();
      experiment.completionReason = reason;
      experiment.finalResults = finalResults;
      
      // Update in database
      await db.supabase
        .from('ab_experiments')
        .update({
          status: 'completed',
          completed_at: experiment.completedAt,
          completion_reason: reason,
          final_results: finalResults,
          config: experiment
        })
        .eq('experiment_id', experimentId);
      
      // Remove from active experiments
      this.activeExperiments.delete(experimentId);
      
      // Generate report
      const report = await this.generateExperimentReport(experiment, finalResults);
      
      logger.info('A/B test experiment stopped', {
        category: 'ab_testing',
        experimentId,
        name: experiment.name,
        reason,
        winner: finalResults.winner
      });
      
      return {
        success: true,
        experiment,
        results: finalResults,
        report
      };
      
    } catch (error) {
      logger.error('Failed to stop experiment', error, {
        category: 'ab_testing',
        experimentId
      });
      throw error;
    }
  }

  // Multi-variate testing support
  async createMultiVariateTest(testData) {
    const factors = testData.factors; // e.g., [{name: 'headline', options: ['A', 'B']}, {name: 'cta', options: ['Buy', 'Shop']}]
    
    // Generate all combinations
    const variants = this.generateVariantCombinations(factors);
    
    // Create experiment with all variants
    const experiment = await this.createExperiment({
      ...testData,
      type: 'multivariate',
      variants: variants.map((combo, index) => ({
        id: `variant_${index}`,
        name: `Combination ${index + 1}`,
        factors: combo
      }))
    });
    
    return experiment;
  }

  // Content optimization experiments
  async createContentOptimizationTest(content, optimizations) {
    const variants = optimizations.map((opt, index) => ({
      id: `optimization_${index}`,
      name: opt.name,
      content: opt.apply(content),
      optimization: opt.type
    }));
    
    return await this.createExperiment({
      name: `Content Optimization: ${content.title || 'Untitled'}`,
      type: 'content_optimization',
      control: { id: 'original', content },
      variants,
      primaryMetric: 'engagement_rate',
      secondaryMetrics: ['click_through_rate', 'shares']
    });
  }

  // Utility methods
  validateVariants(variants) {
    if (!variants || variants.length === 0) {
      throw new Error('At least one variant is required');
    }
    
    if (variants.length > AB_CONFIG.traffic.maxVariants) {
      throw new Error(`Maximum ${AB_CONFIG.traffic.maxVariants} variants allowed`);
    }
    
    return variants.map((variant, index) => ({
      id: variant.id || `variant_${index}`,
      name: variant.name || `Variant ${index + 1}`,
      ...variant
    }));
  }

  calculateEvenSplit(variantCount) {
    const total = variantCount + 1; // Include control
    const allocation = 100 / total;
    return Array(total).fill(allocation);
  }

  async validateExperiment(experiment) {
    // Check for conflicting experiments
    for (const [id, activeExp] of this.activeExperiments) {
      if (activeExp.status === 'running' && 
          activeExp.type === experiment.type &&
          this.hasAudienceOverlap(activeExp.targetAudience, experiment.targetAudience)) {
        throw new Error(`Conflicting experiment already running: ${activeExp.name}`);
      }
    }
    
    // Validate metrics
    if (!experiment.primaryMetric) {
      throw new Error('Primary metric is required');
    }
    
    return true;
  }

  meetsTargetCriteria(context, targetAudience) {
    if (!targetAudience || Object.keys(targetAudience).length === 0) {
      return true;
    }
    
    for (const [key, value] of Object.entries(targetAudience)) {
      if (context[key] !== value) {
        return false;
      }
    }
    
    return true;
  }

  selectVariant(experiment) {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    // Check control allocation
    cumulative += experiment.trafficAllocation[0];
    if (random < cumulative) {
      return 'control';
    }
    
    // Check variant allocations
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.trafficAllocation[i + 1];
      if (random < cumulative) {
        return experiment.variants[i].id;
      }
    }
    
    return 'control'; // Fallback
  }

  async getUserAssignment(userId, experimentId) {
    // Check memory cache
    const cacheKey = `${userId}:${experimentId}`;
    if (this.userAssignments.has(cacheKey)) {
      return this.userAssignments.get(cacheKey);
    }
    
    // Check database
    const { data, error } = await db.supabase
      .from('ab_assignments')
      .select('variant')
      .eq('user_id', userId)
      .eq('experiment_id', experimentId)
      .single();
    
    if (data) {
      this.userAssignments.set(cacheKey, data.variant);
      return data.variant;
    }
    
    return null;
  }

  async storeUserAssignment(assignment) {
    const cacheKey = `${assignment.userId}:${assignment.experimentId}`;
    this.userAssignments.set(cacheKey, assignment.variant);
    
    await db.supabase
      .from('ab_assignments')
      .insert({
        user_id: assignment.userId,
        experiment_id: assignment.experimentId,
        variant: assignment.variant,
        assigned_at: assignment.assignedAt,
        context: assignment.context
      });
  }

  async loadActiveExperiments() {
    try {
      const { data, error } = await db.supabase
        .from('ab_experiments')
        .select('*')
        .in('status', ['draft', 'running']);
      
      if (error) throw error;
      
      data?.forEach(exp => {
        this.activeExperiments.set(exp.experiment_id, exp.config);
      });
      
    } catch (error) {
      logger.error('Failed to load active experiments', error, {
        category: 'ab_testing'
      });
    }
  }

  startResultCalculation() {
    setInterval(async () => {
      for (const [experimentId, experiment] of this.activeExperiments) {
        if (experiment.status === 'running') {
          await this.updateExperimentResults(experimentId);
        }
      }
    }, 60000); // Every minute
  }

  startCleanupJob() {
    setInterval(async () => {
      for (const [experimentId, experiment] of this.activeExperiments) {
        if (experiment.endDate && new Date(experiment.endDate) < new Date()) {
          await this.stopExperiment(experimentId, 'scheduled_end');
        }
      }
    }, 3600000); // Every hour
  }

  async updateExperimentResults(experimentId, variant = null, eventType = null) {
    // This would update cached results in real-time
    // Implementation depends on specific metrics being tracked
  }

  async checkAutoStop(experimentId) {
    const results = await this.getExperimentResults(experimentId);
    
    // Check if any variant has reached significance threshold
    for (const [variantId, variantData] of Object.entries(results.variants)) {
      if (variantId !== 'control' && 
          variantData.confidence >= AB_CONFIG.experiments.autoStopThreshold) {
        await this.stopExperiment(experimentId, 'auto_stop_significance');
        break;
      }
    }
  }

  determineWinner(variants, experiment) {
    let winner = null;
    let maxLift = 0;
    
    for (const [variantId, variantData] of Object.entries(variants)) {
      if (variantId !== 'control' && 
          variantData.significance && 
          variantData.uplift > maxLift) {
        winner = variantId;
        maxLift = variantData.uplift;
      }
    }
    
    return winner;
  }

  generateRecommendations(results, experiment) {
    const recommendations = [];
    
    if (results.winner) {
      recommendations.push({
        type: 'winner',
        message: `Variant ${results.winner} is the winner with ${results.variants[results.winner].uplift.toFixed(2)}% uplift`,
        action: 'Consider implementing this variant permanently'
      });
    } else if (results.sampleSize < experiment.minSampleSize) {
      recommendations.push({
        type: 'sample_size',
        message: `Need ${experiment.minSampleSize - results.sampleSize} more visitors to reach minimum sample size`,
        action: 'Continue running the experiment'
      });
    } else {
      recommendations.push({
        type: 'no_winner',
        message: 'No significant winner detected yet',
        action: 'Consider extending the experiment duration or increasing traffic'
      });
    }
    
    return recommendations;
  }

  async generateExperimentReport(experiment, results) {
    return {
      summary: {
        name: experiment.name,
        duration: this.calculateDuration(experiment.startedAt, experiment.completedAt),
        totalVisitors: results.sampleSize,
        winner: results.winner,
        uplift: results.winner ? results.variants[results.winner].uplift : 0
      },
      hypothesis: {
        statement: experiment.hypothesis,
        validated: !!results.winner
      },
      learnings: this.extractLearnings(experiment, results),
      nextSteps: this.suggestNextSteps(experiment, results)
    };
  }

  // Helper methods
  hasAudienceOverlap(audience1, audience2) {
    // Check if two audiences have overlap
    return JSON.stringify(audience1) === JSON.stringify(audience2);
  }

  generateVariantCombinations(factors) {
    // Generate all possible combinations for multivariate testing
    const combinations = [];
    const generate = (index, current) => {
      if (index === factors.length) {
        combinations.push([...current]);
        return;
      }
      
      for (const option of factors[index].options) {
        current.push({ factor: factors[index].name, value: option });
        generate(index + 1, current);
        current.pop();
      }
    };
    
    generate(0, []);
    return combinations;
  }

  sampleBeta(alpha, beta) {
    // Sample from beta distribution using gamma distribution
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  sampleGamma(shape) {
    // Marsaglia and Tsang method
    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      const x = this.randomNormal();
      const v = Math.pow(1 + c * x, 3);
      
      if (v > 0) {
        const u = Math.random();
        if (u < 1 - 0.0331 * Math.pow(x, 4)) {
          return d * v;
        }
        
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
  }

  randomNormal() {
    // Box-Muller transform
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  normalCDF(z) {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    
    const t = 1 / (1 + p * z);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    
    return 0.5 * (1 + sign * y);
  }

  calculateDuration(start, end) {
    const duration = new Date(end) - new Date(start);
    const days = Math.floor(duration / (24 * 60 * 60 * 1000));
    return `${days} days`;
  }

  extractLearnings(experiment, results) {
    // Extract key learnings from the experiment
    return [];
  }

  suggestNextSteps(experiment, results) {
    // Suggest next steps based on results
    return [];
  }
}

// Create singleton instance
export const abTesting = new ABTestingFramework();

// Export convenience methods
export const {
  createExperiment,
  startExperiment,
  stopExperiment,
  assignUserToVariant,
  trackConversion,
  getExperimentResults,
  createMultiVariateTest,
  createContentOptimizationTest
} = abTesting;

export default abTesting;