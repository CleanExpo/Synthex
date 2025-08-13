/**
 * Strategic Marketing Brand Generation Tests
 * Tests the psychology-powered brand generation system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import BrandPsychologyOrchestrator from '@/lib/ai/agents/strategic-marketing/brand-orchestrator';
import PsychologyEffectivenessTester from '@/lib/ai/agents/strategic-marketing/psychology-testing';
import testData from './sample-data.json';

describe('Brand Psychology Generation System', () => {
  let orchestrator: BrandPsychologyOrchestrator;
  let tester: PsychologyEffectivenessTester;

  beforeAll(() => {
    orchestrator = new BrandPsychologyOrchestrator();
    tester = new PsychologyEffectivenessTester();
  });

  describe('Brand Name Generation', () => {
    it('should generate psychology-aligned brand names', async () => {
      const testCase = testData.testCases[0]; // Tech Startup SaaS
      const result = await orchestrator.generateBrand(testCase.input);

      expect(result.brandNames).toBeDefined();
      expect(result.brandNames.length).toBeGreaterThan(0);
      
      // Check each brand name has required properties
      result.brandNames.forEach(name => {
        expect(name.name).toBeTruthy();
        expect(name.psychologicalTrigger).toBeTruthy();
        expect(name.rationale).toBeTruthy();
        expect(name.memorabilityFactor).toBeGreaterThan(0);
      });
    });

    it('should respect brand name validation rules', async () => {
      const testCase = testData.testCases[0];
      const result = await orchestrator.generateBrand(testCase.input);
      const rules = testData.validationRules.brandName;

      result.brandNames.forEach(brandName => {
        expect(brandName.name.length).toBeGreaterThanOrEqual(rules.minLength);
        expect(brandName.name.length).toBeLessThanOrEqual(rules.maxLength);
        
        if (!rules.allowNumbers) {
          expect(/\d/.test(brandName.name)).toBe(false);
        }
        
        if (!rules.allowSpecialChars) {
          expect(/[^a-zA-Z\s]/.test(brandName.name)).toBe(false);
        }
      });
    });
  });

  describe('Tagline Generation', () => {
    it('should generate emotionally resonant taglines', async () => {
      const testCase = testData.testCases[1]; // Luxury Fashion
      const result = await orchestrator.generateBrand(testCase.input);

      expect(result.taglines).toBeDefined();
      expect(result.taglines.length).toBeGreaterThan(0);

      result.taglines.forEach(tagline => {
        expect(tagline.text).toBeTruthy();
        expect(tagline.psychologicalTarget).toBeTruthy();
        expect(tagline.emotionalResonance).toBeTruthy();
      });
    });

    it('should follow tagline length constraints', async () => {
      const testCase = testData.testCases[2]; // Health & Wellness
      const result = await orchestrator.generateBrand(testCase.input);
      const rules = testData.validationRules.tagline;

      result.taglines.forEach(tagline => {
        const wordCount = tagline.text.split(/\s+/).length;
        expect(wordCount).toBeGreaterThanOrEqual(rules.minWords);
        expect(wordCount).toBeLessThanOrEqual(rules.maxWords);
      });
    });
  });

  describe('Psychology Effectiveness Testing', () => {
    it('should evaluate psychological impact accurately', async () => {
      const brandName = 'TrustFlow';
      const principle = 'Authority Principle';
      const audience = { demographics: ['B2B', 'Tech companies'] };

      const metrics = await tester.evaluatePsychologicalImpact(
        brandName,
        'name',
        audience,
        principle
      );

      expect(metrics.engagementScore).toBeGreaterThan(0);
      expect(metrics.conversionRate).toBeGreaterThan(0);
      expect(metrics.recallScore).toBeGreaterThan(0);
      expect(metrics.emotionalResonance).toBeGreaterThan(0);
    });

    it('should calculate cognitive load correctly', () => {
      const simpleText = 'Easy Pro';
      const complexText = 'Synchronized Enterprise Solutions Platform';

      const simpleLoad = tester.calculateCognitiveLoad(simpleText);
      const complexLoad = tester.calculateCognitiveLoad(complexText);

      expect(simpleLoad).toBeGreaterThan(complexLoad); // Lower load = higher score
    });

    it('should measure brand recall effectiveness', async () => {
      const memorableName = 'ZenCircle';
      const genericName = 'Business Solutions Inc';

      const memorableRecall = await tester.measureBrandRecall(memorableName, 3, 24);
      const genericRecall = await tester.measureBrandRecall(genericName, 3, 24);

      expect(memorableRecall).toBeGreaterThan(genericRecall);
    });
  });

  describe('A/B Testing Framework', () => {
    it('should run A/B tests between variants', async () => {
      const variantA = {
        id: 'variant-a',
        type: 'name' as const,
        content: 'PeakSync Pro',
        principle: 'Anchoring Bias',
        metrics: {
          engagementScore: 75,
          conversionRate: 68,
          recallScore: 82,
          clickThroughRate: 71,
          emotionalResonance: 70,
          brandAlignment: 78
        }
      };

      const variantB = {
        id: 'variant-b',
        type: 'name' as const,
        content: 'TrustFlow',
        principle: 'Authority Principle',
        metrics: {
          engagementScore: 80,
          conversionRate: 72,
          recallScore: 78,
          clickThroughRate: 75,
          emotionalResonance: 82,
          brandAlignment: 85
        }
      };

      const result = await tester.runABTest(variantA, variantB, 1000, 24);

      expect(result.winner).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.improvementPercentage).toBeGreaterThan(0);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should detect statistical significance', async () => {
      const highDifferenceA = {
        id: 'high-a',
        type: 'tagline' as const,
        content: 'Transform Your Business',
        principle: 'Loss Aversion',
        metrics: {
          engagementScore: 60,
          conversionRate: 55,
          recallScore: 65,
          clickThroughRate: 58,
          emotionalResonance: 62,
          brandAlignment: 60
        }
      };

      const highDifferenceB = {
        id: 'high-b',
        type: 'tagline' as const,
        content: 'Never Miss Growth Again',
        principle: 'FOMO',
        metrics: {
          engagementScore: 85,
          conversionRate: 82,
          recallScore: 88,
          clickThroughRate: 80,
          emotionalResonance: 90,
          brandAlignment: 85
        }
      };

      const result = await tester.runABTest(
        highDifferenceA,
        highDifferenceB,
        5000,
        48
      );

      expect(result.statisticalSignificance).toBe(true);
      expect(result.confidence).toBeGreaterThan(90);
    });
  });

  describe('Metadata Optimization', () => {
    it('should generate platform-specific metadata', async () => {
      const testCase = testData.testCases[0];
      const result = await orchestrator.generateBrand(testCase.input);

      expect(result.metadataPackages).toBeDefined();
      expect(result.metadataPackages.length).toBeGreaterThan(0);

      // Check for different platforms
      const platforms = result.metadataPackages.map(pkg => pkg.platform);
      expect(platforms).toContain('google');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('linkedin');
    });

    it('should include psychological triggers in metadata', async () => {
      const testCase = testData.testCases[1];
      const result = await orchestrator.generateBrand(testCase.input);

      result.metadataPackages.forEach(pkg => {
        expect(pkg.primaryTrigger).toBeTruthy();
        expect(pkg.psychologicalRationale).toBeTruthy();
        expect(pkg.keywords.length).toBeGreaterThan(0);
        expect(pkg.hashtags.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Psychology Validation', () => {
    it('should validate principle application', async () => {
      const brandElement = 'Exclusive Members Club';
      const principle = 'Scarcity Principle';
      const context = { audience: 'Luxury', goal: 'exclusivity' };

      const validation = await tester.validatePsychologyApplication(
        brandElement,
        principle,
        context
      );

      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(70);
      expect(validation.issues.length).toBe(0);
    });

    it('should identify misaligned psychology', async () => {
      const brandElement = 'Budget Bargain Barn';
      const principle = 'Luxury';
      const context = { audience: 'High-income', goal: 'premium' };

      const validation = await tester.validatePsychologyApplication(
        brandElement,
        principle,
        context
      );

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Effectiveness Scoring', () => {
    it('should calculate overall effectiveness score', async () => {
      const testCase = testData.testCases[0];
      const result = await orchestrator.generateBrand(testCase.input);

      expect(result.effectivenessScore).toBeDefined();
      expect(result.effectivenessScore).toBeGreaterThan(0);
      expect(result.effectivenessScore).toBeLessThanOrEqual(100);
    });

    it('should meet target performance metrics', async () => {
      const testCase = testData.testCases[2];
      const result = await orchestrator.generateBrand(testCase.input);
      const targets = testData.performanceMetrics.targetScores;

      // At least one brand name should meet memorability target
      const memorableNames = result.brandNames.filter(
        name => name.memorabilityFactor * 10 >= targets.memorability
      );
      expect(memorableNames.length).toBeGreaterThan(0);
    });
  });

  describe('Emotional Resonance', () => {
    it('should measure emotional resonance accurately', async () => {
      const trustText = 'Your Trusted Partner in Success';
      const excitementText = 'Revolutionary Breakthrough Innovation';

      const trustScore = await tester.measureEmotionalResonance(trustText, 'trust');
      const excitementScore = await tester.measureEmotionalResonance(excitementText, 'excitement');

      expect(trustScore).toBeGreaterThan(60);
      expect(excitementScore).toBeGreaterThan(60);
    });
  });

  describe('Implementation Guide', () => {
    it('should provide actionable implementation steps', async () => {
      const testCase = testData.testCases[0];
      const result = await orchestrator.generateBrand(testCase.input);

      expect(result.implementationGuide).toBeDefined();
      expect(result.implementationGuide.length).toBeGreaterThan(0);

      result.implementationGuide.forEach(step => {
        expect(step.phase).toBeTruthy();
        expect(step.action).toBeTruthy();
        expect(step.psychologicalPrinciple).toBeTruthy();
        expect(step.expectedOutcome).toBeTruthy();
        expect(step.metrics).toBeInstanceOf(Array);
      });
    });
  });
});

// Integration test for full workflow
describe('End-to-End Brand Generation Workflow', () => {
  it('should complete full brand generation workflow', async () => {
    const orchestrator = new BrandPsychologyOrchestrator();
    const tester = new PsychologyEffectivenessTester();
    
    // Use real test case
    const input = testData.testCases[0].input;
    
    // Generate brand
    const brandResult = await orchestrator.generateBrand(input);
    
    // Validate all components exist
    expect(brandResult.psychologicalStrategy).toBeDefined();
    expect(brandResult.brandNames.length).toBeGreaterThan(0);
    expect(brandResult.taglines.length).toBeGreaterThan(0);
    expect(brandResult.metadataPackages.length).toBeGreaterThan(0);
    expect(brandResult.implementationGuide.length).toBeGreaterThan(0);
    expect(brandResult.effectivenessScore).toBeGreaterThan(60);
    
    // Test the top brand name
    const topBrand = brandResult.brandNames[0];
    const metrics = await tester.evaluatePsychologicalImpact(
      topBrand.name,
      'name',
      input.targetAudience,
      topBrand.psychologicalTrigger
    );
    
    // Verify metrics meet minimum thresholds
    expect(metrics.engagementScore).toBeGreaterThan(50);
    expect(metrics.conversionRate).toBeGreaterThan(50);
    expect(metrics.recallScore).toBeGreaterThan(50);
    
    // Run A/B test between top two names
    if (brandResult.brandNames.length >= 2) {
      const variantA = {
        id: 'name-1',
        type: 'name' as const,
        content: brandResult.brandNames[0].name,
        principle: brandResult.brandNames[0].psychologicalTrigger,
        metrics: await tester.evaluatePsychologicalImpact(
          brandResult.brandNames[0].name,
          'name',
          input.targetAudience,
          brandResult.brandNames[0].psychologicalTrigger
        )
      };
      
      const variantB = {
        id: 'name-2',
        type: 'name' as const,
        content: brandResult.brandNames[1].name,
        principle: brandResult.brandNames[1].psychologicalTrigger,
        metrics: await tester.evaluatePsychologicalImpact(
          brandResult.brandNames[1].name,
          'name',
          input.targetAudience,
          brandResult.brandNames[1].psychologicalTrigger
        )
      };
      
      const abTestResult = await tester.runABTest(variantA, variantB);
      
      expect(abTestResult.winner).toBeDefined();
      expect(abTestResult.recommendations.length).toBeGreaterThan(0);
    }
  });
});