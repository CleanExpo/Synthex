/**
 * Strategic Marketing Brand Orchestrator
 * Main orchestration logic for psychology-powered brand generation
 */

import { AGENT_CONFIG, PSYCHOLOGY_PRINCIPLES } from './agent-prompts';
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

export interface BrandGenerationInput {
  businessType: string;
  targetAudience: {
    demographics: string[];
    psychographics: string[];
    painPoints: string[];
  };
  brandGoals: string[];
  tonePreference: string;
  psychologyPreference?: string[];
  competitorContext?: string;
}

export interface BrandGenerationResult {
  psychologicalStrategy: {
    primaryTriggers: PsychologyTrigger[];
    secondaryTriggers: PsychologyTrigger[];
    rationale: string;
  };
  brandNames: BrandNameOption[];
  taglines: TaglineVariation[];
  metadataPackages: PlatformMetadata[];
  implementationGuide: ImplementationStep[];
  effectivenessScore: number;
}

interface PsychologyTrigger {
  principle: string;
  relevanceScore: number;
  implementationStrategy: string;
  expectedImpact: string;
}

interface BrandNameOption {
  name: string;
  psychologicalTrigger: string;
  rationale: string;
  audienceResonance: string;
  memorabilityFactor: number;
  differentiationScore: number;
}

interface TaglineVariation {
  text: string;
  psychologicalTarget: string;
  cognitiveTrigger: string;
  emotionalResonance: string;
  callToAction: string;
  memorabilityEnhancers: string[];
}

interface PlatformMetadata {
  platform: string;
  primaryTrigger: string;
  title: string;
  description: string;
  keywords: string[];
  hashtags: string[];
  callToAction: string;
  psychologicalRationale: string;
}

interface ImplementationStep {
  phase: string;
  action: string;
  psychologicalPrinciple: string;
  expectedOutcome: string;
  metrics: string[];
}

/** Psychology analysis result from AI */
interface PsychologyAnalysisResult {
  primaryTriggers: PsychologyTrigger[];
  secondaryTriggers: PsychologyTrigger[];
  rationale: string;
}

/** Psychology principle from config */
interface PsychologyPrinciple {
  name: string;
  triggerWords?: string[];
  [key: string]: unknown;
}

export class BrandPsychologyOrchestrator {
  private config = AGENT_CONFIG;
  private principles = PSYCHOLOGY_PRINCIPLES;

  /** Call the AI provider and return the response text */
  private async callAI(request: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<string> {
    const provider = getAIProvider();
    const response = await provider.complete(request);
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content in AI response');
    return content;
  }

  async generateBrand(input: BrandGenerationInput): Promise<BrandGenerationResult> {
    try {
      // Step 1: Analyze psychological strategy
      const psychologyAnalysis = await this.analyzePsychology(input);
      
      // Step 2: Generate brand names based on psychology
      const brandNames = await this.generateBrandNames(input, psychologyAnalysis);
      
      // Step 3: Create taglines with psychological triggers
      const taglines = await this.generateTaglines(input, psychologyAnalysis, brandNames[0]);
      
      // Step 4: Optimize metadata for platforms
      const metadataPackages = await this.optimizeMetadata(input, psychologyAnalysis, brandNames[0], taglines[0]);
      
      // Step 5: Create implementation guide
      const implementationGuide = this.createImplementationGuide(psychologyAnalysis, brandNames[0], taglines[0]);
      
      // Step 6: Calculate effectiveness score
      const effectivenessScore = this.calculateEffectivenessScore(psychologyAnalysis, brandNames, taglines);

      return {
        psychologicalStrategy: psychologyAnalysis,
        brandNames,
        taglines,
        metadataPackages,
        implementationGuide,
        effectivenessScore
      };
    } catch (error) {
      logger.error('Brand generation error', { error });
      throw new Error('Failed to generate brand with psychological strategy');
    }
  }

  private async analyzePsychology(input: BrandGenerationInput): Promise<PsychologyAnalysisResult> {
    const prompt = this.buildPsychologyAnalysisPrompt(input);

    const response = await this.callAI({
      model: this.config.psychologyAnalyzer.model,
      messages: [
        { role: 'system', content: this.config.psychologyAnalyzer.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: this.config.psychologyAnalyzer.temperature,
      max_tokens: this.config.psychologyAnalyzer.maxTokens
    });

    return this.parsePsychologyAnalysis(response);
  }

  private async generateBrandNames(
    input: BrandGenerationInput,
    psychologyAnalysis: PsychologyAnalysisResult
  ): Promise<BrandNameOption[]> {
    const prompt = this.buildBrandNamePrompt(input, psychologyAnalysis);

    const response = await this.callAI({
      model: this.config.brandNameGenerator.model,
      messages: [
        { role: 'system', content: this.config.brandNameGenerator.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: this.config.brandNameGenerator.temperature,
      max_tokens: this.config.brandNameGenerator.maxTokens
    });

    return this.parseBrandNames(response);
  }

  private async generateTaglines(
    input: BrandGenerationInput,
    psychologyAnalysis: PsychologyAnalysisResult,
    primaryBrandName: BrandNameOption
  ): Promise<TaglineVariation[]> {
    const prompt = this.buildTaglinePrompt(input, psychologyAnalysis, primaryBrandName);

    const response = await this.callAI({
      model: this.config.taglineSpecialist.model,
      messages: [
        { role: 'system', content: this.config.taglineSpecialist.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: this.config.taglineSpecialist.temperature,
      max_tokens: this.config.taglineSpecialist.maxTokens
    });

    return this.parseTaglines(response);
  }

  private async optimizeMetadata(
    input: BrandGenerationInput,
    psychologyAnalysis: PsychologyAnalysisResult,
    brandName: BrandNameOption,
    tagline: TaglineVariation
  ): Promise<PlatformMetadata[]> {
    const platforms = ['google', 'instagram', 'linkedin', 'twitter', 'tiktok'];
    const metadataPackages: PlatformMetadata[] = [];

    for (const platform of platforms) {
      const prompt = this.buildMetadataPrompt(input, psychologyAnalysis, brandName, tagline, platform);
      
      const response = await this.callAI({
        model: this.config.metadataOptimizer.model,
        messages: [
          { role: 'system', content: this.config.metadataOptimizer.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.metadataOptimizer.temperature,
        max_tokens: this.config.metadataOptimizer.maxTokens
      });

      metadataPackages.push(this.parseMetadata(response, platform));
    }

    return metadataPackages;
  }

  private buildPsychologyAnalysisPrompt(input: BrandGenerationInput): string {
    return JSON.stringify({
      business_type: input.businessType,
      target_audience: input.targetAudience,
      brand_objectives: input.brandGoals,
      competitive_landscape: input.competitorContext || 'Not specified',
      psychological_preferences: input.psychologyPreference || [],
      available_principles: this.principles
    });
  }

  private buildBrandNamePrompt(input: BrandGenerationInput, psychologyAnalysis: PsychologyAnalysisResult): string {
    return JSON.stringify({
      psychology_analysis: psychologyAnalysis,
      business_type: input.businessType,
      demographics: input.targetAudience.demographics,
      desired_traits: input.tonePreference,
      trigger_words: this.getRelevantTriggerWords(psychologyAnalysis)
    });
  }

  private buildTaglinePrompt(
    input: BrandGenerationInput,
    psychologyAnalysis: PsychologyAnalysisResult,
    brandName: BrandNameOption
  ): string {
    return JSON.stringify({
      selected_brand_name: brandName.name,
      identified_triggers: psychologyAnalysis.primaryTriggers,
      target_demographics: input.targetAudience,
      core_values: input.brandGoals,
      tone_preference: input.tonePreference
    });
  }

  private buildMetadataPrompt(
    input: BrandGenerationInput,
    psychologyAnalysis: PsychologyAnalysisResult,
    brandName: BrandNameOption,
    tagline: TaglineVariation,
    platform: string
  ): string {
    return JSON.stringify({
      name: brandName.name,
      tagline: tagline.text,
      specific_platform: platform,
      identified_triggers: psychologyAnalysis.primaryTriggers,
      conversion_objectives: input.brandGoals,
      target_audience: input.targetAudience
    });
  }

  private parsePsychologyAnalysis(response: string): PsychologyAnalysisResult {
    try {
      const parsed = JSON.parse(response);
      return {
        primaryTriggers: parsed.primaryTriggers || [],
        secondaryTriggers: parsed.secondaryTriggers || [],
        rationale: parsed.rationale || ''
      };
    } catch (error) {
      logger.error('Failed to parse psychology analysis', { error });
      return {
        primaryTriggers: [],
        secondaryTriggers: [],
        rationale: 'Analysis parsing error'
      };
    }
  }

  private parseBrandNames(response: string): BrandNameOption[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.brandNames || [];
    } catch (error) {
      logger.error('Failed to parse brand names', { error });
      return [];
    }
  }

  private parseTaglines(response: string): TaglineVariation[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.taglines || [];
    } catch (error) {
      logger.error('Failed to parse taglines', { error });
      return [];
    }
  }

  private parseMetadata(response: string, platform: string): PlatformMetadata {
    try {
      const parsed = JSON.parse(response);
      return {
        platform,
        ...parsed.metadata,
        psychologicalRationale: parsed.psychologicalRationale
      };
    } catch (error) {
      logger.error(`Failed to parse metadata for ${platform}`, { error });
      return {
        platform,
        primaryTrigger: '',
        title: '',
        description: '',
        keywords: [],
        hashtags: [],
        callToAction: '',
        psychologicalRationale: 'Parsing error'
      };
    }
  }

  private getRelevantTriggerWords(psychologyAnalysis: PsychologyAnalysisResult): string[] {
    const triggerWords: string[] = [];

    psychologyAnalysis.primaryTriggers.forEach((trigger: PsychologyTrigger) => {
      const principle = this.findPrinciple(trigger.principle);
      if (principle?.triggerWords) {
        triggerWords.push(...principle.triggerWords);
      }
    });

    return [...new Set(triggerWords)]; // Remove duplicates
  }

  private findPrinciple(principleName: string): PsychologyPrinciple | undefined {
    const allPrinciples: PsychologyPrinciple[] = [
      ...this.principles.cognitiveBlases,
      ...this.principles.socialPsychology,
      ...this.principles.behavioralEconomics,
      ...this.principles.memoryLearning
    ];

    return allPrinciples.find(p => p.name === principleName);
  }

  private createImplementationGuide(
    psychologyAnalysis: PsychologyAnalysisResult,
    brandName: BrandNameOption,
    tagline: TaglineVariation
  ): ImplementationStep[] {
    return [
      {
        phase: 'Launch Preparation',
        action: `Introduce ${brandName.name} with focus on ${brandName.psychologicalTrigger}`,
        psychologicalPrinciple: brandName.psychologicalTrigger,
        expectedOutcome: 'Establish psychological anchor in target audience',
        metrics: ['Brand recall', 'Initial engagement rate']
      },
      {
        phase: 'Messaging Deployment',
        action: `Deploy tagline "${tagline.text}" across all channels`,
        psychologicalPrinciple: tagline.psychologicalTarget,
        expectedOutcome: tagline.emotionalResonance,
        metrics: ['Message retention', 'Emotional response score']
      },
      {
        phase: 'Content Strategy',
        action: 'Create content that reinforces psychological triggers',
        psychologicalPrinciple: psychologyAnalysis.primaryTriggers[0]?.principle || 'Social Proof',
        expectedOutcome: 'Build trust and authority',
        metrics: ['Content engagement', 'Share rate', 'Conversion rate']
      },
      {
        phase: 'Optimization',
        action: 'A/B test psychological variations',
        psychologicalPrinciple: 'Multiple principles',
        expectedOutcome: 'Identify highest-converting psychological approach',
        metrics: ['Conversion rate', 'Click-through rate', 'ROI']
      },
      {
        phase: 'Scale',
        action: 'Amplify successful psychological strategies',
        psychologicalPrinciple: 'Proven winners from testing',
        expectedOutcome: 'Maximize brand impact and market penetration',
        metrics: ['Market share', 'Brand awareness', 'Customer lifetime value']
      }
    ];
  }

  private calculateEffectivenessScore(
    psychologyAnalysis: PsychologyAnalysisResult,
    brandNames: BrandNameOption[],
    taglines: TaglineVariation[]
  ): number {
    let score = 0;
    let factors = 0;

    // Psychology strategy alignment (30%)
    if (psychologyAnalysis.primaryTriggers.length >= 3) {
      score += 30;
    } else {
      score += psychologyAnalysis.primaryTriggers.length * 10;
    }
    factors++;

    // Brand name quality (30%)
    const avgMemorability = brandNames.reduce((sum, name) => sum + (name.memorabilityFactor || 0), 0) / brandNames.length;
    score += avgMemorability * 3;
    factors++;

    // Tagline effectiveness (20%)
    const taglineQuality = taglines.length >= 3 ? 20 : taglines.length * 6.67;
    score += taglineQuality;
    factors++;

    // Differentiation (20%)
    const avgDifferentiation = brandNames.reduce((sum, name) => sum + (name.differentiationScore || 0), 0) / brandNames.length;
    score += avgDifferentiation * 2;
    factors++;

    return Math.min(100, Math.round(score));
  }
}

export default BrandPsychologyOrchestrator;