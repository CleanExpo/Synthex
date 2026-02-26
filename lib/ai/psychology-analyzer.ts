/**
 * Psychology Analyzer Service
 *
 * AI-powered content analysis for psychological persuasion principles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { callOpenRouter } from './openrouter';
import { getAIProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const AnalysisRequestSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  targetAudience: z.string().optional(),
  platform: z.string().optional(),
  contentType: z.enum(['post', 'ad', 'email', 'landing', 'tagline', 'headline']).optional(),
});

const PrincipleApplicationSchema = z.object({
  principleId: z.string(),
  strength: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  evidence: z.array(z.string()),
});

export interface PsychologyPrinciple {
  id: string;
  name: string;
  category: string;
  description: string;
  applications: string[];
  triggerWords: string[];
  effectivenessScore: number;
}

export interface AnalysisResult {
  overallScore: number;
  principlesDetected: {
    id: string;
    name: string;
    strength: number;
    confidence: number;
    evidence: string[];
  }[];
  emotionalTone: {
    primary: string;
    secondary: string[];
    intensity: number;
  };
  readability: {
    score: number;
    level: string;
    suggestions: string[];
  };
  persuasionMetrics: {
    urgency: number;
    exclusivity: number;
    socialProof: number;
    authority: number;
    emotionalAppeal: number;
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
    impact: string;
  }[];
  predictedEngagement: {
    level: 'low' | 'medium' | 'high' | 'viral';
    confidence: number;
    factors: string[];
  };
}

// Core psychology principles with trigger patterns
const PSYCHOLOGY_PRINCIPLES: PsychologyPrinciple[] = [
  {
    id: 'social-proof',
    name: 'Social Proof',
    category: 'influence',
    description: 'People follow the actions of others',
    applications: ['testimonials', 'user counts', 'reviews', 'endorsements'],
    triggerWords: ['join', 'others', 'thousands', 'millions', 'trusted', 'popular', 'rated', 'reviewed'],
    effectivenessScore: 92,
  },
  {
    id: 'scarcity',
    name: 'Scarcity',
    category: 'urgency',
    description: 'Limited availability increases perceived value',
    applications: ['limited-time', 'exclusive', 'countdown', 'stock-levels'],
    triggerWords: ['limited', 'only', 'exclusive', 'rare', 'last chance', 'ends', 'remaining', 'few left'],
    effectivenessScore: 90,
  },
  {
    id: 'authority',
    name: 'Authority',
    category: 'trust',
    description: 'Expert endorsement builds credibility',
    applications: ['expert-quotes', 'certifications', 'awards', 'credentials'],
    triggerWords: ['expert', 'certified', 'award', 'proven', 'research', 'study', 'doctor', 'professional'],
    effectivenessScore: 88,
  },
  {
    id: 'reciprocity',
    name: 'Reciprocity',
    category: 'influence',
    description: 'People feel obligated to return favors',
    applications: ['free-trials', 'gifts', 'value-first', 'content'],
    triggerWords: ['free', 'gift', 'bonus', 'complimentary', 'included', 'extra', 'receive'],
    effectivenessScore: 85,
  },
  {
    id: 'loss-aversion',
    name: 'Loss Aversion',
    category: 'urgency',
    description: 'Fear of missing out drives action',
    applications: ['fomo', 'risk-framing', 'deadline'],
    triggerWords: ['miss', 'lose', 'risk', 'don\'t', 'never', 'regret', 'without'],
    effectivenessScore: 89,
  },
  {
    id: 'commitment',
    name: 'Commitment & Consistency',
    category: 'behavior',
    description: 'Small commitments lead to larger ones',
    applications: ['micro-conversions', 'quizzes', 'trials'],
    triggerWords: ['start', 'try', 'begin', 'first step', 'simple', 'easy', 'quick'],
    effectivenessScore: 82,
  },
  {
    id: 'liking',
    name: 'Liking',
    category: 'connection',
    description: 'We prefer to say yes to people we like',
    applications: ['personality', 'relatability', 'shared-values'],
    triggerWords: ['you', 'your', 'together', 'community', 'friend', 'like you', 'understand'],
    effectivenessScore: 80,
  },
  {
    id: 'anchoring',
    name: 'Anchoring',
    category: 'pricing',
    description: 'First information serves as reference point',
    applications: ['price-comparison', 'before-after', 'savings'],
    triggerWords: ['was', 'now', 'save', 'compare', 'originally', 'value', 'worth'],
    effectivenessScore: 86,
  },
];

export class PsychologyAnalyzer {
  private principles: PsychologyPrinciple[];

  constructor() {
    this.principles = PSYCHOLOGY_PRINCIPLES;
  }

  /**
   * Analyze content for psychological persuasion principles.
   * If an AIProvider is passed, it will be used for the AI analysis step
   * (supports user API key injection). Otherwise falls back to callOpenRouter.
   */
  async analyzeContent(
    content: string,
    options: {
      targetAudience?: string;
      platform?: string;
      contentType?: string;
    } = {},
    aiProvider?: AIProvider
  ): Promise<AnalysisResult> {
    // First, do rule-based detection
    const ruleBasedResults = this.detectPrinciplesRuleBased(content);

    // Then enhance with AI analysis
    const aiAnalysis = await this.getAIAnalysis(content, options, aiProvider);

    // Merge and calculate final scores
    const mergedPrinciples = this.mergePrincipleResults(ruleBasedResults, aiAnalysis.principles);

    // Calculate overall psychology score
    const overallScore = this.calculateOverallScore(mergedPrinciples, aiAnalysis);

    // Generate actionable recommendations
    const recommendations = this.generateRecommendations(
      mergedPrinciples,
      aiAnalysis,
      options
    );

    // Predict engagement level
    const predictedEngagement = this.predictEngagement(overallScore, mergedPrinciples);

    return {
      overallScore,
      principlesDetected: mergedPrinciples,
      emotionalTone: aiAnalysis.emotionalTone,
      readability: this.analyzeReadability(content),
      persuasionMetrics: this.calculatePersuasionMetrics(mergedPrinciples),
      recommendations,
      predictedEngagement,
    };
  }

  /**
   * Rule-based principle detection using trigger words
   */
  private detectPrinciplesRuleBased(content: string): Map<string, { strength: number; evidence: string[] }> {
    const results = new Map<string, { strength: number; evidence: string[] }>();
    const lowerContent = content.toLowerCase();

    for (const principle of this.principles) {
      const evidence: string[] = [];
      let matchCount = 0;

      for (const trigger of principle.triggerWords) {
        const regex = new RegExp(`\\b${trigger}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          matchCount += matches.length;
          evidence.push(`Contains "${trigger}" (${matches.length}x)`);
        }
      }

      if (matchCount > 0) {
        const strength = Math.min(100, matchCount * 15 + 30);
        results.set(principle.id, { strength, evidence });
      }
    }

    return results;
  }

  /**
   * Get AI-powered analysis using the provided AIProvider (user key or platform key).
   * Falls back to callOpenRouter for backward compatibility.
   */
  private async getAIAnalysis(
    content: string,
    options: { targetAudience?: string; platform?: string; contentType?: string },
    aiProvider?: AIProvider
  ): Promise<{
    principles: { id: string; strength: number; confidence: number; reasoning: string }[];
    emotionalTone: { primary: string; secondary: string[]; intensity: number };
    suggestions: string[];
  }> {
    const systemPrompt = `You are an expert in marketing psychology and persuasion techniques. Analyze the given content for psychological principles and emotional resonance.

Return your analysis as valid JSON with this exact structure:
{
  "principles": [
    {"id": "principle-id", "strength": 0-100, "confidence": 0-100, "reasoning": "brief explanation"}
  ],
  "emotionalTone": {
    "primary": "main emotion",
    "secondary": ["other", "emotions"],
    "intensity": 0-100
  },
  "suggestions": ["actionable improvement 1", "actionable improvement 2"]
}

Available principle IDs: social-proof, scarcity, authority, reciprocity, loss-aversion, commitment, liking, anchoring`;

    const userPrompt = `Analyze this marketing content for psychological persuasion principles:

Content: "${content}"
${options.targetAudience ? `Target Audience: ${options.targetAudience}` : ''}
${options.platform ? `Platform: ${options.platform}` : ''}
${options.contentType ? `Content Type: ${options.contentType}` : ''}

Provide detailed analysis in JSON format.`;

    try {
      let responseText: string;

      // Use provided AIProvider if available, otherwise fall back to callOpenRouter
      const ai = aiProvider || getAIProvider();
      const response = await ai.complete({
        model: ai.models.balanced,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });
      responseText = response.choices[0]?.message?.content || '';

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if parsing fails
      return {
        principles: [],
        emotionalTone: { primary: 'neutral', secondary: [], intensity: 50 },
        suggestions: ['Consider adding more persuasive elements'],
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        principles: [],
        emotionalTone: { primary: 'neutral', secondary: [], intensity: 50 },
        suggestions: ['AI analysis unavailable - using rule-based analysis only'],
      };
    }
  }

  /**
   * Merge rule-based and AI results
   */
  private mergePrincipleResults(
    ruleBased: Map<string, { strength: number; evidence: string[] }>,
    aiResults: { id: string; strength: number; confidence: number; reasoning: string }[]
  ): AnalysisResult['principlesDetected'] {
    const merged: AnalysisResult['principlesDetected'] = [];

    // Start with rule-based results
    for (const [id, data] of ruleBased) {
      const principle = this.principles.find(p => p.id === id);
      if (principle) {
        const aiMatch = aiResults.find(r => r.id === id);
        merged.push({
          id,
          name: principle.name,
          strength: aiMatch ? Math.round((data.strength + aiMatch.strength) / 2) : data.strength,
          confidence: aiMatch ? aiMatch.confidence : 70,
          evidence: [...data.evidence, ...(aiMatch ? [aiMatch.reasoning] : [])],
        });
      }
    }

    // Add AI-only detections
    for (const aiResult of aiResults) {
      if (!ruleBased.has(aiResult.id)) {
        const principle = this.principles.find(p => p.id === aiResult.id);
        if (principle && aiResult.confidence > 60) {
          merged.push({
            id: aiResult.id,
            name: principle.name,
            strength: aiResult.strength,
            confidence: aiResult.confidence,
            evidence: [aiResult.reasoning],
          });
        }
      }
    }

    return merged.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Calculate overall psychology effectiveness score
   */
  private calculateOverallScore(
    principles: AnalysisResult['principlesDetected'],
    aiAnalysis: { emotionalTone: { intensity: number } }
  ): number {
    if (principles.length === 0) return 25;

    // Weighted average of principle strengths
    const principleScore = principles.reduce((sum, p) => sum + p.strength * (p.confidence / 100), 0) / principles.length;

    // Factor in emotional intensity
    const emotionBonus = aiAnalysis.emotionalTone.intensity * 0.1;

    // Factor in diversity of principles
    const diversityBonus = Math.min(20, principles.length * 5);

    return Math.round(Math.min(100, principleScore + emotionBonus + diversityBonus));
  }

  /**
   * Analyze content readability
   */
  private analyzeReadability(content: string): AnalysisResult['readability'] {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, words.length);

    // Simplified Flesch Reading Ease approximation
    const score = Math.round(206.835 - 1.015 * avgWordsPerSentence - 84.6 * (avgWordLength / 5));
    const normalizedScore = Math.max(0, Math.min(100, score));

    let level: string;
    const suggestions: string[] = [];

    if (normalizedScore >= 80) {
      level = 'Very Easy';
    } else if (normalizedScore >= 60) {
      level = 'Easy';
    } else if (normalizedScore >= 40) {
      level = 'Standard';
      suggestions.push('Consider using shorter sentences for better impact');
    } else {
      level = 'Difficult';
      suggestions.push('Simplify language for broader appeal');
      suggestions.push('Break long sentences into shorter ones');
    }

    if (avgWordLength > 6) {
      suggestions.push('Use simpler, shorter words where possible');
    }

    return { score: normalizedScore, level, suggestions };
  }

  /**
   * Calculate persuasion metrics from detected principles
   */
  private calculatePersuasionMetrics(
    principles: AnalysisResult['principlesDetected']
  ): AnalysisResult['persuasionMetrics'] {
    const getStrength = (ids: string[]): number => {
      const matches = principles.filter(p => ids.includes(p.id));
      if (matches.length === 0) return 0;
      return Math.round(matches.reduce((sum, m) => sum + m.strength, 0) / matches.length);
    };

    return {
      urgency: getStrength(['scarcity', 'loss-aversion']),
      exclusivity: getStrength(['scarcity', 'authority']),
      socialProof: getStrength(['social-proof', 'liking']),
      authority: getStrength(['authority']),
      emotionalAppeal: getStrength(['liking', 'loss-aversion', 'reciprocity']),
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    principles: AnalysisResult['principlesDetected'],
    aiAnalysis: { suggestions: string[] },
    options: { targetAudience?: string; platform?: string }
  ): AnalysisResult['recommendations'] {
    const recommendations: AnalysisResult['recommendations'] = [];

    // Check for missing high-impact principles
    const detectedIds = new Set(principles.map(p => p.id));
    const highImpactMissing = this.principles
      .filter(p => p.effectivenessScore >= 85 && !detectedIds.has(p.id))
      .slice(0, 2);

    for (const principle of highImpactMissing) {
      recommendations.push({
        priority: 'high',
        category: 'Add Principle',
        suggestion: `Add ${principle.name}: ${principle.applications[0]} can increase conversions`,
        impact: `+${Math.round(principle.effectivenessScore * 0.3)}% potential improvement`,
      });
    }

    // Check for weak principles that could be strengthened
    const weakPrinciples = principles.filter(p => p.strength < 50);
    for (const weak of weakPrinciples.slice(0, 2)) {
      recommendations.push({
        priority: 'medium',
        category: 'Strengthen',
        suggestion: `Strengthen ${weak.name} by adding more trigger words or examples`,
        impact: 'Clearer message, better recall',
      });
    }

    // Add AI suggestions
    for (const suggestion of aiAnalysis.suggestions.slice(0, 2)) {
      recommendations.push({
        priority: 'medium',
        category: 'AI Suggestion',
        suggestion,
        impact: 'Improved persuasion',
      });
    }

    // Platform-specific recommendations
    if (options.platform?.toLowerCase().includes('twitter') || options.platform?.toLowerCase().includes('x')) {
      if (!detectedIds.has('scarcity')) {
        recommendations.push({
          priority: 'low',
          category: 'Platform Optimization',
          suggestion: 'Twitter thrives on urgency - add time-sensitive language',
          impact: 'Higher engagement rate',
        });
      }
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Predict engagement level based on analysis
   */
  private predictEngagement(
    overallScore: number,
    principles: AnalysisResult['principlesDetected']
  ): AnalysisResult['predictedEngagement'] {
    const factors: string[] = [];

    let level: 'low' | 'medium' | 'high' | 'viral';
    let confidence: number;

    if (overallScore >= 85 && principles.length >= 3) {
      level = 'viral';
      confidence = 75;
      factors.push('Multiple strong persuasion principles', 'High emotional resonance');
    } else if (overallScore >= 70) {
      level = 'high';
      confidence = 80;
      factors.push('Good principle usage', 'Clear call to action');
    } else if (overallScore >= 50) {
      level = 'medium';
      confidence = 70;
      factors.push('Some persuasive elements present');
    } else {
      level = 'low';
      confidence = 65;
      factors.push('Needs stronger persuasion elements');
    }

    if (principles.some(p => p.id === 'social-proof' && p.strength > 60)) {
      factors.push('Social proof increases trust');
    }

    if (principles.some(p => p.id === 'scarcity' && p.strength > 60)) {
      factors.push('Scarcity creates urgency');
    }

    return { level, confidence, factors };
  }

  /**
   * Get all available psychology principles
   */
  async getPrinciples(): Promise<PsychologyPrinciple[]> {
    try {
      // Try to fetch from database first
      const dbPrinciples = await prisma.psychologyPrinciple.findMany({
        orderBy: { effectivenessScore: 'desc' },
      });

      if (dbPrinciples.length > 0) {
        return dbPrinciples.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || '',
          applications: Object.keys(p.brandingApplication as object || {}),
          triggerWords: p.triggerWords,
          effectivenessScore: Number(p.effectivenessScore) * 100,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch principles from database:', error);
    }

    // Fall back to built-in principles
    return this.principles;
  }

  /**
   * Store analysis result for future reference
   */
  async storeAnalysis(
    userId: string,
    content: string,
    result: AnalysisResult,
    generationId?: string
  ): Promise<void> {
    try {
      if (!generationId) return;

      for (const principle of result.principlesDetected) {
        await prisma.psychologyMetric.create({
          data: {
            generationId,
            principleUsed: principle.name,
            variantType: 'content',
            variantContent: content.substring(0, 500),
            engagementScore: principle.strength / 100,
            conversionRate: result.overallScore / 100,
            recallScore: result.readability.score / 100,
            clickThroughRate: result.persuasionMetrics.urgency / 100,
          },
        });
      }
    } catch (error) {
      console.error('Failed to store analysis:', error);
    }
  }
}

// Export singleton instance
export const psychologyAnalyzer = new PsychologyAnalyzer();
