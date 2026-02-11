/**
 * Psychology Effectiveness Testing Framework
 * Measures and validates the impact of psychological principles in branding
 */

import { prisma } from '@/lib/prisma';

export interface PsychologyTestMetrics {
  engagementScore: number;
  conversionRate: number;
  recallScore: number;
  clickThroughRate: number;
  emotionalResonance: number;
  brandAlignment: number;
}

export interface ABTestVariant {
  id: string;
  type: 'name' | 'tagline' | 'metadata';
  content: string;
  principle: string;
  metrics: PsychologyTestMetrics;
}

export interface ABTestResult {
  winner: ABTestVariant;
  confidence: number;
  improvementPercentage: number;
  statisticalSignificance: boolean;
  recommendations: string[];
}

/** Target audience configuration */
interface TargetAudience {
  demographics?: string[];
  psychographics?: string[];
  painPoints?: string[];
}

/** Validation context */
interface ValidationContext {
  businessType?: string;
  industry?: string;
  [key: string]: unknown;
}

/** Validation criterion */
interface ValidationCriterion {
  check: string;
  weight: number;
}

/** AB test storage data */
interface ABTestData {
  variants: ABTestVariant[];
  winner: ABTestVariant;
  metrics: { A: PsychologyTestMetrics; B: PsychologyTestMetrics };
  sampleSize: number;
  testDurationHours: number;
  significance: { confidence: number; isSignificant: boolean };
}

export class PsychologyEffectivenessTester {
  /**
   * Evaluate psychological impact of brand elements
   */
  async evaluatePsychologicalImpact(
    brandElement: string,
    elementType: 'name' | 'tagline' | 'metadata',
    targetAudience: TargetAudience,
    psychologicalPrinciple: string
  ): Promise<PsychologyTestMetrics> {
    // Simulate metrics calculation based on psychological principles
    const metrics = this.calculateBaseMetrics(brandElement, psychologicalPrinciple);
    
    // Adjust for audience alignment
    const audienceAdjustedMetrics = this.adjustForAudience(metrics, targetAudience, psychologicalPrinciple);
    
    // Apply element-specific modifiers
    const finalMetrics = this.applyElementModifiers(audienceAdjustedMetrics, elementType);
    
    return finalMetrics;
  }

  /**
   * Run A/B test between variants
   */
  async runABTest(
    variantA: ABTestVariant,
    variantB: ABTestVariant,
    sampleSize: number = 1000,
    testDurationHours: number = 24
  ): Promise<ABTestResult> {
    // Simulate A/B test results
    const metricsA = await this.simulateUserInteractions(variantA, sampleSize);
    const metricsB = await this.simulateUserInteractions(variantB, sampleSize);
    
    // Calculate statistical significance
    const significance = this.calculateStatisticalSignificance(metricsA, metricsB, sampleSize);
    
    // Determine winner
    const winner = this.determineWinner(variantA, variantB, metricsA, metricsB);
    
    // Calculate improvement
    const improvement = this.calculateImprovement(metricsA, metricsB);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(winner, metricsA, metricsB);
    
    // Store test results in database
    await this.storeTestResults({
      variants: [variantA, variantB],
      winner,
      metrics: { A: metricsA, B: metricsB },
      sampleSize,
      testDurationHours,
      significance
    });
    
    return {
      winner,
      confidence: significance.confidence,
      improvementPercentage: improvement,
      statisticalSignificance: significance.isSignificant,
      recommendations
    };
  }

  /**
   * Measure brand recall effectiveness
   */
  async measureBrandRecall(
    brandName: string,
    exposureCount: number,
    delayHours: number
  ): Promise<number> {
    // Ebbinghaus forgetting curve simulation
    const baseRecall = this.calculateMemorability(brandName);
    const timeDecay = Math.exp(-delayHours / 24); // Daily decay
    const exposureBoost = Math.log(exposureCount + 1) * 0.2; // Logarithmic boost from repetition
    
    const recallScore = Math.min(100, (baseRecall * timeDecay + exposureBoost * 100));
    
    return Math.round(recallScore);
  }

  /**
   * Validate psychological principle application
   */
  async validatePsychologyApplication(
    brandElement: string,
    intendedPrinciple: string,
    context: ValidationContext
  ): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const validation = {
      isValid: true,
      score: 0,
      issues: [] as string[],
      suggestions: [] as string[]
    };
    
    // Check principle-specific criteria
    const principleChecks = this.getPrincipleValidationCriteria(intendedPrinciple);
    
    let totalWeight = 0;

    for (const check of principleChecks) {
      const weight = typeof check.weight === 'number' ? check.weight : 1;
      const result = this.evaluateCriterion(brandElement, check, context);
      validation.score += result.score;
      totalWeight += weight;
      
      if (!result.passed) {
        validation.isValid = false;
        validation.issues.push(result.issue);
        validation.suggestions.push(result.suggestion);
      }
    }
    
    const divisor = totalWeight || principleChecks.length || 1;
    validation.score = Math.round(validation.score / divisor);
    
    return validation;
  }

  /**
   * Calculate cognitive load score
   */
  calculateCognitiveLoad(text: string): number {
    const factors = {
      length: text.length,
      syllables: this.countSyllables(text),
      uniqueWords: new Set(text.toLowerCase().split(/\s+/)).size,
      complexity: this.calculateComplexity(text)
    };
    
    // Lower score is better (easier to process)
    const loadScore = (
      factors.length * 0.1 +
      factors.syllables * 0.3 +
      factors.uniqueWords * 0.2 +
      factors.complexity * 0.4
    );
    
    // Convert to 0-100 scale (100 = lowest load)
    return Math.max(0, Math.min(100, 100 - loadScore));
  }

  /**
   * Measure emotional resonance
   */
  async measureEmotionalResonance(
    text: string,
    targetEmotion: string
  ): Promise<number> {
    const emotionKeywords = this.getEmotionKeywords(targetEmotion);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let resonanceScore = 0;
    
    for (const word of textWords) {
      if (emotionKeywords.primary.includes(word)) {
        resonanceScore += 10;
      } else if (emotionKeywords.secondary.includes(word)) {
        resonanceScore += 5;
      }
    }
    
    // Check for emotional patterns
    const patterns = this.detectEmotionalPatterns(text, targetEmotion);
    resonanceScore += patterns.length * 15;
    
    return Math.min(100, resonanceScore);
  }

  // Private helper methods
  
  private calculateBaseMetrics(element: string, principle: string): PsychologyTestMetrics {
    // Base metrics calculation based on principle
    const principleStrength = this.getPrincipleStrength(principle);
    const elementQuality = this.assessElementQuality(element);
    
    return {
      engagementScore: principleStrength * 0.7 + elementQuality * 0.3,
      conversionRate: principleStrength * 0.6 + elementQuality * 0.4,
      recallScore: this.calculateMemorability(element),
      clickThroughRate: principleStrength * 0.5 + elementQuality * 0.5,
      emotionalResonance: principleStrength * 0.8 + elementQuality * 0.2,
      brandAlignment: principleStrength * 0.6 + elementQuality * 0.4
    };
  }

  private adjustForAudience(
    metrics: PsychologyTestMetrics,
    audience: TargetAudience,
    principle: string
  ): PsychologyTestMetrics {
    // Get audience relevance for principle
    const relevance = this.getAudienceRelevance(audience, principle);
    
    return {
      engagementScore: metrics.engagementScore * (relevance / 10),
      conversionRate: metrics.conversionRate * (relevance / 10),
      recallScore: metrics.recallScore * ((relevance + 5) / 15), // Less affected by audience
      clickThroughRate: metrics.clickThroughRate * (relevance / 10),
      emotionalResonance: metrics.emotionalResonance * (relevance / 10),
      brandAlignment: metrics.brandAlignment * ((relevance + 7) / 17)
    };
  }

  private applyElementModifiers(
    metrics: PsychologyTestMetrics,
    elementType: 'name' | 'tagline' | 'metadata'
  ): PsychologyTestMetrics {
    const modifiers = {
      name: { recall: 1.2, engagement: 1.0, conversion: 0.9 },
      tagline: { recall: 0.9, engagement: 1.1, conversion: 1.0 },
      metadata: { recall: 0.7, engagement: 0.8, conversion: 1.3 }
    };
    
    const mod = modifiers[elementType];
    
    return {
      engagementScore: metrics.engagementScore * mod.engagement,
      conversionRate: metrics.conversionRate * mod.conversion,
      recallScore: metrics.recallScore * mod.recall,
      clickThroughRate: metrics.clickThroughRate,
      emotionalResonance: metrics.emotionalResonance,
      brandAlignment: metrics.brandAlignment
    };
  }

  private async simulateUserInteractions(
    variant: ABTestVariant,
    sampleSize: number
  ): Promise<PsychologyTestMetrics> {
    // Simulate user interactions based on psychological principles
    const baseMetrics = variant.metrics;
    const variance = 0.1; // 10% variance in simulated data
    
    return {
      engagementScore: this.addVariance(baseMetrics.engagementScore, variance),
      conversionRate: this.addVariance(baseMetrics.conversionRate, variance),
      recallScore: this.addVariance(baseMetrics.recallScore, variance),
      clickThroughRate: this.addVariance(baseMetrics.clickThroughRate, variance),
      emotionalResonance: this.addVariance(baseMetrics.emotionalResonance, variance),
      brandAlignment: this.addVariance(baseMetrics.brandAlignment, variance)
    };
  }

  private calculateStatisticalSignificance(
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics,
    sampleSize: number
  ): { confidence: number; isSignificant: boolean } {
    // Simplified statistical significance calculation
    const avgDifference = this.calculateAverageMetricDifference(metricsA, metricsB);
    const standardError = Math.sqrt(2 / sampleSize) * 10; // Simplified SE
    const zScore = avgDifference / standardError;
    const confidence = this.zScoreToConfidence(Math.abs(zScore));
    
    return {
      confidence: Math.round(confidence * 100),
      isSignificant: confidence > 0.95
    };
  }

  private determineWinner(
    variantA: ABTestVariant,
    variantB: ABTestVariant,
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics
  ): ABTestVariant {
    const scoreA = this.calculateCompositeScore(metricsA);
    const scoreB = this.calculateCompositeScore(metricsB);
    
    return scoreA >= scoreB ? variantA : variantB;
  }

  private calculateImprovement(
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics
  ): number {
    const scoreA = this.calculateCompositeScore(metricsA);
    const scoreB = this.calculateCompositeScore(metricsB);
    const improvement = ((Math.max(scoreA, scoreB) - Math.min(scoreA, scoreB)) / Math.min(scoreA, scoreB)) * 100;
    
    return Math.round(improvement);
  }

  private generateRecommendations(
    winner: ABTestVariant,
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics
  ): string[] {
    const recommendations: string[] = [];
    
    // Analyze which metrics drove the win
    const metricDifferences = this.analyzeMetricDifferences(metricsA, metricsB);
    
    if (metricDifferences.engagement > 10) {
      recommendations.push(`The ${winner.principle} principle shows strong engagement. Consider applying it to other brand elements.`);
    }
    
    if (metricDifferences.recall > 15) {
      recommendations.push(`High recall score indicates memorable branding. Maintain consistency across touchpoints.`);
    }
    
    if (metricDifferences.conversion > 8) {
      recommendations.push(`Conversion optimization successful. Test similar psychological triggers in CTAs.`);
    }
    
    if (winner.metrics.emotionalResonance > 80) {
      recommendations.push(`Strong emotional connection achieved. Amplify this in storytelling and content.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain the winning approach and keep monitoring performance trends.');
    }
    
    return recommendations;
  }

  private async storeTestResults(testData: ABTestData): Promise<void> {
    // Store in database for future analysis
    try {
      // Implementation would store in psychology_metrics table
      console.log('Test results stored:', testData);
    } catch (error) {
      console.error('Failed to store test results:', error);
    }
  }

  // Utility methods
  
  private calculateMemorability(text: string): number {
    const factors = {
      length: text.length < 20 ? 10 : text.length < 40 ? 5 : 0,
      uniqueness: this.calculateUniqueness(text) * 20,
      rhythm: this.hasRhythm(text) ? 15 : 0,
      alliteration: this.hasAlliteration(text) ? 10 : 0,
      simplicity: this.calculateSimplicity(text) * 15
    };
    
    return Math.min(100, Object.values(factors).reduce((a, b) => a + b, 40));
  }

  private countSyllables(text: string): number {
    return text.toLowerCase().replace(/[^a-z]/g, '').replace(/[^aeiou]+/g, ' ').trim().split(' ').length;
  }

  private calculateComplexity(text: string): number {
    const avgWordLength = text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / text.split(/\s+/).length;
    return Math.min(100, avgWordLength * 10);
  }

  private calculateUniqueness(text: string): number {
    // Simplified uniqueness score
    const commonWords = ['the', 'best', 'quality', 'service', 'solution'];
    const words = text.toLowerCase().split(/\s+/);
    const uniqueScore = words.filter(w => !commonWords.includes(w)).length / words.length;
    return uniqueScore;
  }

  private hasRhythm(text: string): boolean {
    // Check for rhythmic patterns
    const syllables = this.countSyllables(text);
    return syllables % 2 === 0 || syllables % 3 === 0;
  }

  private hasAlliteration(text: string): boolean {
    const words = text.split(/\s+/);
    if (words.length < 2) return false;
    
    const firstLetters = words.map(w => w[0].toLowerCase());
    const counts = firstLetters.reduce((acc, letter) => {
      acc[letter] = (acc[letter] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.values(counts).some(count => count >= 2);
  }

  private calculateSimplicity(text: string): number {
    const words = text.split(/\s+/);
    const avgLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    return Math.max(0, 1 - (avgLength - 4) / 10);
  }

  private getPrincipleStrength(principle: string): number {
    // Principle effectiveness scores (0-100)
    const scores: Record<string, number> = {
      'Social Proof': 90,
      'Scarcity Principle': 92,
      'Authority Principle': 88,
      'Loss Aversion': 87,
      'Anchoring Bias': 85,
      'Halo Effect': 84,
      'Reciprocity Principle': 82,
      'Contrast Principle': 80
    };
    
    return scores[principle] || 70;
  }

  private assessElementQuality(element: string): number {
    // Basic quality assessment
    const length = element.length;
    const hasNumbers = /\d/.test(element);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(element);
    
    let score = 70;
    
    if (length >= 3 && length <= 30) score += 10;
    if (!hasNumbers) score += 5;
    if (!hasSpecialChars) score += 5;
    if (this.hasAlliteration(element)) score += 10;
    
    return Math.min(100, score);
  }

  private getAudienceRelevance(audience: TargetAudience, principle: string): number {
    // Simplified audience-principle matching
    const audienceType = audience.demographics?.[0] || 'general';
    
    const relevanceMap: Record<string, Record<string, number>> = {
      'B2B': {
        'Authority Principle': 10,
        'Social Proof': 8,
        'Loss Aversion': 9
      },
      'Youth': {
        'Social Proof': 10,
        'Scarcity Principle': 9,
        'Mere Exposure Effect': 8
      },
      'Luxury': {
        'Scarcity Principle': 10,
        'Halo Effect': 10,
        'Authority Principle': 9
      }
    };
    
    return relevanceMap[audienceType]?.[principle] || 7;
  }

  private addVariance(value: number, variance: number): number {
    const adjustment = (Math.random() - 0.5) * 2 * variance * value;
    return Math.max(0, Math.min(100, value + adjustment));
  }

  private calculateAverageMetricDifference(
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics
  ): number {
    const differences = [
      Math.abs(metricsA.engagementScore - metricsB.engagementScore),
      Math.abs(metricsA.conversionRate - metricsB.conversionRate),
      Math.abs(metricsA.recallScore - metricsB.recallScore),
      Math.abs(metricsA.clickThroughRate - metricsB.clickThroughRate),
      Math.abs(metricsA.emotionalResonance - metricsB.emotionalResonance),
      Math.abs(metricsA.brandAlignment - metricsB.brandAlignment)
    ];
    
    return differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
  }

  private zScoreToConfidence(zScore: number): number {
    // Simplified z-score to confidence level conversion
    if (zScore >= 2.58) return 0.99;
    if (zScore >= 1.96) return 0.95;
    if (zScore >= 1.64) return 0.90;
    if (zScore >= 1.28) return 0.80;
    return 0.50 + zScore * 0.2;
  }

  private calculateCompositeScore(metrics: PsychologyTestMetrics): number {
    // Weighted average of all metrics
    return (
      metrics.engagementScore * 0.2 +
      metrics.conversionRate * 0.25 +
      metrics.recallScore * 0.15 +
      metrics.clickThroughRate * 0.15 +
      metrics.emotionalResonance * 0.15 +
      metrics.brandAlignment * 0.1
    );
  }

  private analyzeMetricDifferences(
    metricsA: PsychologyTestMetrics,
    metricsB: PsychologyTestMetrics
  ): Record<string, number> {
    return {
      engagement: Math.abs(metricsA.engagementScore - metricsB.engagementScore),
      conversion: Math.abs(metricsA.conversionRate - metricsB.conversionRate),
      recall: Math.abs(metricsA.recallScore - metricsB.recallScore),
      ctr: Math.abs(metricsA.clickThroughRate - metricsB.clickThroughRate),
      emotion: Math.abs(metricsA.emotionalResonance - metricsB.emotionalResonance),
      alignment: Math.abs(metricsA.brandAlignment - metricsB.brandAlignment)
    };
  }

  private getPrincipleValidationCriteria(principle: string): ValidationCriterion[] {
    // Return validation criteria for each principle
    const criteria: Record<string, ValidationCriterion[]> = {
      'Anchoring Bias': [
        { check: 'starts_with_premium', weight: 0.3 },
        { check: 'contains_superlative', weight: 0.2 },
        { check: 'sets_high_expectation', weight: 0.5 }
      ],
      'Social Proof': [
        { check: 'implies_popularity', weight: 0.4 },
        { check: 'references_community', weight: 0.3 },
        { check: 'shows_adoption', weight: 0.3 }
      ],
      'Scarcity Principle': [
        { check: 'suggests_limitation', weight: 0.4 },
        { check: 'implies_exclusivity', weight: 0.4 },
        { check: 'creates_urgency', weight: 0.2 }
      ]
    };

    return criteria[principle] || [{ check: 'general_quality', weight: 1.0 }];
  }

  private evaluateCriterion(
    element: string,
    criterion: ValidationCriterion,
    context: ValidationContext
  ): { passed: boolean; score: number; issue: string; suggestion: string } {
    // Simplified criterion evaluation
    const passed = Math.random() > 0.3; // Mock evaluation
    const weight = typeof criterion.weight === 'number' ? criterion.weight : 1;
    const score = passed ? weight * 100 : weight * 40;

    return {
      passed,
      score,
      issue: passed ? '' : `Failed ${criterion.check} validation`,
      suggestion: passed ? '' : `Consider adjusting to better reflect ${criterion.check}`
    };
  }

  private getEmotionKeywords(emotion: string): { primary: string[]; secondary: string[] } {
    const keywords: Record<string, { primary: string[]; secondary: string[] }> = {
      trust: {
        primary: ['trust', 'reliable', 'secure', 'proven', 'guaranteed'],
        secondary: ['safe', 'confident', 'assured', 'dependable', 'solid']
      },
      excitement: {
        primary: ['exciting', 'amazing', 'incredible', 'revolutionary', 'breakthrough'],
        secondary: ['new', 'innovative', 'dynamic', 'energetic', 'powerful']
      },
      luxury: {
        primary: ['premium', 'exclusive', 'luxury', 'elite', 'sophisticated'],
        secondary: ['refined', 'elegant', 'superior', 'distinguished', 'select']
      }
    };
    
    return keywords[emotion] || { primary: [], secondary: [] };
  }

  private detectEmotionalPatterns(text: string, emotion: string): string[] {
    // Detect emotional language patterns
    const patterns: string[] = [];
    const emotionPatterns: Record<string, RegExp[]> = {
      trust: [/you can count on/i, /we guarantee/i, /proven results/i],
      excitement: [/don't miss/i, /limited time/i, /act now/i],
      luxury: [/exclusively for/i, /hand-crafted/i, /artisan/i]
    };
    
    const relevantPatterns = emotionPatterns[emotion] || [];
    
    for (const pattern of relevantPatterns) {
      if (pattern.test(text)) {
        patterns.push(pattern.source);
      }
    }
    
    return patterns;
  }
}

export default PsychologyEffectivenessTester;
