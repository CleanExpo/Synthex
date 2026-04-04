/**
 * Persona Training Pipeline
 *
 * @description End-to-end persona training system:
 * - Process training sources (writing samples, social posts, documents)
 * - Extract voice characteristics and patterns
 * - Build/update persona profiles
 * - Validate training quality
 * - Persist to database
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: AI provider key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { nlpAnalyzer, type NLPAnalysisResult } from '@/lib/ai/nlp-analyzer';
import { embeddingService } from '@/lib/ai/embedding-service';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingSource {
  id: string;
  type: 'text' | 'social_post' | 'document' | 'website' | 'conversation';
  content: string;
  metadata?: {
    platform?: string;
    engagement?: number;
    date?: string;
    url?: string;
  };
}

export interface ExtractedCharacteristics {
  tone: ToneProfile;
  vocabulary: VocabularyProfile;
  structure: StructureProfile;
  patterns: PatternProfile;
  confidence: number;
}

export interface ToneProfile {
  primary: string;
  secondary: string[];
  avoided: string[];
  formality: number; // 0-100
  energy: number; // 0-100
  warmth: number; // 0-100
  humor: number; // 0-100
}

export interface VocabularyProfile {
  complexity: 'simple' | 'standard' | 'technical' | 'sophisticated';
  averageWordLength: number;
  uniqueWordsRatio: number;
  preferredWords: string[];
  bannedWords: string[];
  jargonLevel: number; // 0-100
}

export interface StructureProfile {
  averageSentenceLength: number;
  paragraphLength: number;
  usesLists: boolean;
  usesQuestions: boolean;
  usesCTA: boolean;
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtagUsage: number; // average per post
}

export interface PatternProfile {
  hookPatterns: string[];
  closingPatterns: string[];
  transitionPhrases: string[];
  callToActions: string[];
  signatureElements: string[];
}

export interface TrainingProgress {
  phase: 'initializing' | 'extracting' | 'analyzing' | 'validating' | 'persisting' | 'complete' | 'failed';
  progress: number; // 0-100
  sourcesProcessed: number;
  totalSources: number;
  currentStep: string;
  errors: string[];
  startedAt: Date;
  estimatedCompletion?: Date;
}

export interface TrainingResult {
  success: boolean;
  personaId: string;
  characteristics: ExtractedCharacteristics;
  quality: TrainingQuality;
  suggestions: string[];
}

export interface TrainingQuality {
  overallScore: number; // 0-100
  dataQuality: number;
  consistency: number;
  distinctiveness: number;
  sampleSize: number;
  warnings: string[];
}

// ============================================================================
// TRAINING PIPELINE CLASS
// ============================================================================

export class PersonaTrainingPipeline {
  private progress: TrainingProgress = {
    phase: 'initializing',
    progress: 0,
    sourcesProcessed: 0,
    totalSources: 0,
    currentStep: '',
    errors: [],
    startedAt: new Date(),
  };

  private onProgressUpdate?: (progress: TrainingProgress) => void;

  constructor(onProgress?: (progress: TrainingProgress) => void) {
    this.onProgressUpdate = onProgress;
  }

  /**
   * Main training entry point
   */
  async train(personaId: string, sources: TrainingSource[]): Promise<TrainingResult> {
    this.resetProgress();
    this.progress.totalSources = sources.length;

    try {
      // Phase 1: Initialize
      this.updateProgress('initializing', 5, 'Validating inputs...');

      // Validate persona exists
      const persona = await prisma.persona.findUnique({ where: { id: personaId } });
      if (!persona) {
        throw new Error(`Persona ${personaId} not found`);
      }

      // Update persona status to training
      await prisma.persona.update({
        where: { id: personaId },
        data: { status: 'training' },
      });

      // Phase 2: Extract characteristics from each source and store training data
      this.updateProgress('extracting', 10, 'Processing training sources...');
      const extractedData = await this.extractFromSources(sources, personaId);

      // Phase 3: Analyze and aggregate patterns
      this.updateProgress('analyzing', 50, 'Analyzing patterns...');
      const characteristics = await this.analyzePatterns(extractedData);

      // Phase 4: Validate training quality
      this.updateProgress('validating', 70, 'Validating training quality...');
      const quality = await this.validateTraining(characteristics, sources.length);

      // Phase 5: Persist to database
      this.updateProgress('persisting', 85, 'Saving persona profile...');
      await this.persistPersona(personaId, characteristics, sources.length);

      // Complete
      this.updateProgress('complete', 100, 'Training complete');

      return {
        success: true,
        personaId,
        characteristics,
        quality,
        suggestions: this.generateSuggestions(quality),
      };
    } catch (error) {
      this.updateProgress('failed', this.progress.progress, `Error: ${error}`);

      // Revert persona status - best effort cleanup, don't mask original error
      await prisma.persona.update({
        where: { id: personaId },
        data: { status: 'draft' },
      }).catch(() => { /* Cleanup failed, continue with error throw */ });

      throw error;
    }
  }

  // ============================================================================
  // EXTRACTION
  // ============================================================================

  private async extractFromSources(sources: TrainingSource[], personaId: string): Promise<ExtractedCharacteristics[]> {
    const results: ExtractedCharacteristics[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      try {
        const extracted = await this.extractFromSingleSource(source);
        results.push(extracted);

        // Store training data in database
        await this.storeTrainingData(personaId, source, extracted);

        this.progress.sourcesProcessed = i + 1;
        this.updateProgress(
          'extracting',
          10 + (40 * (i + 1) / sources.length),
          `Processing source ${i + 1}/${sources.length}`
        );
      } catch (error) {
        this.progress.errors.push(`Failed to process source ${i + 1}: ${error}`);
        logger.warn('Failed to extract from source', { sourceId: source.id, error });
      }
    }

    return results;
  }

  /**
   * Store training data with embeddings in database
   */
  private async storeTrainingData(
    personaId: string,
    source: TrainingSource,
    characteristics: ExtractedCharacteristics
  ): Promise<void> {
    try {
      // Generate content hash for deduplication
      const contentHash = crypto
        .createHash('sha256')
        .update(source.content)
        .digest('hex')
        .substring(0, 32);

      // Extract topics using NLP
      const topics = await nlpAnalyzer.extractTopics(source.content).catch(() => []);

      // Analyze sentiment
      const sentiment = await nlpAnalyzer.analyzeSentiment(source.content).catch(() => null);

      // Generate embedding for semantic search (optional, may fail without OPENAI_API_KEY)
      let embedding: number[] | null = null;
      try {
        const embeddingResult = await embeddingService.embed(source.content);
        embedding = embeddingResult.embedding;
      } catch (embError) {
        logger.debug('Embedding generation skipped (no API key or error)', { embError });
      }

      // Upsert training data (cast objects to JSON for Prisma)
      await prisma.personaTrainingData.upsert({
        where: {
          personaId_contentHash: {
            personaId,
            contentHash,
          },
        },
        update: {
          extractedTone: characteristics.tone as unknown as object,
          extractedVocabulary: characteristics.vocabulary as unknown as object,
          extractedPatterns: characteristics.patterns as unknown as object,
          aiAnalysis: characteristics as unknown as object,
          topics,
          sentiment: sentiment?.overall ?? undefined,
          embedding: embedding ? (embedding as unknown as object) : undefined,
          processedAt: new Date(),
          confidence: characteristics.confidence,
          updatedAt: new Date(),
        },
        create: {
          personaId,
          sourceType: source.type,
          sourceUrl: source.metadata?.url ?? undefined,
          platform: source.metadata?.platform ?? undefined,
          content: source.content,
          contentHash,
          extractedTone: characteristics.tone as unknown as object,
          extractedVocabulary: characteristics.vocabulary as unknown as object,
          extractedPatterns: characteristics.patterns as unknown as object,
          aiAnalysis: characteristics as unknown as object,
          topics,
          sentiment: sentiment?.overall ?? undefined,
          embedding: embedding ? (embedding as unknown as object) : undefined,
          engagement: source.metadata?.engagement ?? undefined,
          processedAt: new Date(),
          confidence: characteristics.confidence,
        },
      });

      logger.debug('Training data stored', { personaId, contentHash });
    } catch (error) {
      // Don't fail the training if storage fails
      logger.warn('Failed to store training data', { personaId, error });
    }
  }

  private async extractFromSingleSource(source: TrainingSource): Promise<ExtractedCharacteristics> {
    const content = source.content;

    // Try AI-powered analysis first
    try {
      const aiAnalysis = await nlpAnalyzer.analyze(content);

      // Map AI analysis to our ExtractedCharacteristics format
      return this.mapNLPToCharacteristics(aiAnalysis);
    } catch (error) {
      logger.warn('AI analysis failed, falling back to rule-based', { error, sourceId: source.id });

      // Fallback to rule-based analysis
      return this.extractWithRules(content);
    }
  }

  /**
   * Map NLP analysis result to ExtractedCharacteristics
   */
  private mapNLPToCharacteristics(analysis: NLPAnalysisResult): ExtractedCharacteristics {
    return {
      tone: {
        primary: analysis.tone.primary,
        secondary: analysis.tone.secondary,
        avoided: [],
        formality: analysis.tone.formality,
        energy: analysis.tone.energy,
        warmth: analysis.tone.warmth,
        humor: analysis.tone.humor,
      },
      vocabulary: {
        complexity: analysis.vocabulary.complexity,
        averageWordLength: 5, // Default, can be calculated
        uniqueWordsRatio: 0.5,
        preferredWords: analysis.vocabulary.preferredWords,
        bannedWords: [],
        jargonLevel: analysis.vocabulary.jargonLevel,
      },
      structure: {
        averageSentenceLength: analysis.structure.averageSentenceLength,
        paragraphLength: 3,
        usesLists: analysis.structure.usesLists,
        usesQuestions: analysis.structure.usesQuestions,
        usesCTA: analysis.structure.usesCTA,
        emojiUsage: analysis.structure.emojiUsage,
        hashtagUsage: analysis.structure.hashtagUsage,
      },
      patterns: {
        hookPatterns: analysis.patterns.hookPatterns,
        closingPatterns: analysis.patterns.closingPatterns,
        transitionPhrases: analysis.patterns.transitionPhrases,
        callToActions: analysis.patterns.callToActions,
        signatureElements: analysis.patterns.signatureElements,
      },
      confidence: analysis.confidence,
    };
  }

  /**
   * Rule-based extraction fallback
   */
  private extractWithRules(content: string): ExtractedCharacteristics {
    // Analyze tone
    const tone = this.analyzeTone(content);

    // Analyze vocabulary
    const vocabulary = this.analyzeVocabulary(content);

    // Analyze structure
    const structure = this.analyzeStructure(content);

    // Extract patterns
    const patterns = this.extractPatterns(content);

    // Calculate confidence based on content length
    const confidence = Math.min(100, content.length / 50);

    return { tone, vocabulary, structure, patterns, confidence };
  }

  private analyzeTone(content: string): ToneProfile {
    const lowerContent = content.toLowerCase();

    // Detect primary tone based on markers
    const toneMarkers: Record<string, string[]> = {
      professional: ['we', 'our', 'company', 'business', 'solution', 'strategy'],
      casual: ["i'm", "you're", "gonna", "kinda", 'hey', 'cool'],
      humorous: ['lol', 'haha', '😂', '🤣', 'joke', 'funny'],
      inspirational: ['dream', 'achieve', 'believe', 'success', 'journey', 'grow'],
      educational: ['learn', 'discover', 'tip', 'guide', 'how to', 'step'],
      authoritative: ['must', 'should', 'essential', 'critical', 'important'],
    };

    const scores: Record<string, number> = {};
    for (const [tone, markers] of Object.entries(toneMarkers)) {
      scores[tone] = markers.filter((m) => lowerContent.includes(m)).length;
    }

    const sortedTones = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([tone]) => tone);

    // Calculate formality (higher = more formal)
    const informalMarkers = ["'ll", "'re", "'ve", 'gonna', 'wanna', 'kinda'];
    const formalMarkers = ['therefore', 'however', 'moreover', 'consequently'];
    const informal = informalMarkers.filter((m) => lowerContent.includes(m)).length;
    const formal = formalMarkers.filter((m) => lowerContent.includes(m)).length;
    const formality = Math.min(100, Math.max(0, 50 + (formal - informal) * 10));

    // Calculate energy (exclamation marks, caps)
    const exclamations = (content.match(/!/g) || []).length;
    const caps = (content.match(/[A-Z]{2,}/g) || []).length;
    const energy = Math.min(100, exclamations * 5 + caps * 3);

    // Calculate warmth
    const warmMarkers = ['you', 'your', 'we', 'together', 'community', 'friend'];
    const warmth = Math.min(100, warmMarkers.filter((m) => lowerContent.includes(m)).length * 15);

    // Calculate humor
    const humorMarkers = ['😂', '🤣', '😄', 'lol', 'haha', 'joke'];
    const humor = Math.min(100, humorMarkers.filter((m) => lowerContent.includes(m)).length * 20);

    return {
      primary: sortedTones[0] || 'professional',
      secondary: sortedTones.slice(1, 3),
      avoided: [],
      formality,
      energy,
      warmth,
      humor,
    };
  }

  private analyzeVocabulary(content: string): VocabularyProfile {
    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));

    // Calculate average word length
    const averageWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);

    // Calculate unique words ratio
    const uniqueWordsRatio = uniqueWords.size / Math.max(words.length, 1);

    // Determine complexity
    let complexity: VocabularyProfile['complexity'] = 'standard';
    if (averageWordLength > 7) complexity = 'sophisticated';
    else if (averageWordLength > 5.5) complexity = 'technical';
    else if (averageWordLength < 4.5) complexity = 'simple';

    // Find frequently used significant words (potential preferred words)
    const wordCounts: Record<string, number> = {};
    words.forEach((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, '');
      if (lower.length > 4) {
        wordCounts[lower] = (wordCounts[lower] || 0) + 1;
      }
    });

    const preferredWords = Object.entries(wordCounts)
      .filter(([, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Calculate jargon level
    const technicalWords = [
      'roi', 'kpi', 'metrics', 'analytics', 'optimization', 'leverage',
      'synergy', 'scalable', 'agile', 'paradigm', 'disrupt',
    ];
    const jargonCount = technicalWords.filter((w) => content.toLowerCase().includes(w)).length;
    const jargonLevel = Math.min(100, jargonCount * 15);

    return {
      complexity,
      averageWordLength,
      uniqueWordsRatio,
      preferredWords,
      bannedWords: [],
      jargonLevel,
    };
  }

  private analyzeStructure(content: string): StructureProfile {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

    // Average sentence length
    const totalWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
    const averageSentenceLength = totalWords / Math.max(sentences.length, 1);

    // Paragraph length
    const paragraphLength = sentences.length / Math.max(paragraphs.length, 1);

    // Feature detection
    const usesLists = /[-*•]\s/.test(content) || /^\d+\.\s/m.test(content);
    const usesQuestions = /\?/.test(content);
    const usesCTA = /click|sign up|subscribe|learn more|get started|try|join/i.test(content);

    // Emoji usage
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu;
    const emojiCount = (content.match(emojiRegex) || []).length;
    let emojiUsage: StructureProfile['emojiUsage'] = 'none';
    if (emojiCount > 5) emojiUsage = 'heavy';
    else if (emojiCount > 2) emojiUsage = 'moderate';
    else if (emojiCount > 0) emojiUsage = 'minimal';

    // Hashtag usage
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    const hashtagUsage = hashtagCount / Math.max(paragraphs.length, 1);

    return {
      averageSentenceLength,
      paragraphLength,
      usesLists,
      usesQuestions,
      usesCTA,
      emojiUsage,
      hashtagUsage,
    };
  }

  private extractPatterns(content: string): PatternProfile {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const firstSentences = sentences.slice(0, 3).map((s) => s.trim());
    const lastSentences = sentences.slice(-3).map((s) => s.trim());

    // Detect hook patterns
    const hookPatterns: string[] = [];
    firstSentences.forEach((s) => {
      if (s.startsWith('Did you')) hookPatterns.push('question_hook');
      if (s.includes('?')) hookPatterns.push('curiosity_hook');
      if (/^\d/.test(s)) hookPatterns.push('number_hook');
      if (/imagine|picture this/i.test(s)) hookPatterns.push('story_hook');
      if (/stop|wait|warning/i.test(s)) hookPatterns.push('urgency_hook');
    });

    // Detect closing patterns
    const closingPatterns: string[] = [];
    lastSentences.forEach((s) => {
      if (/let me know|thoughts\??|what do you think/i.test(s)) closingPatterns.push('engagement_close');
      if (/click|subscribe|sign up|learn more/i.test(s)) closingPatterns.push('cta_close');
      if (/thanks|thank you/i.test(s)) closingPatterns.push('gratitude_close');
      if (/follow|share/i.test(s)) closingPatterns.push('social_close');
    });

    // Transition phrases
    const transitionPhrases = [
      'however', 'moreover', 'furthermore', 'in addition', 'on the other hand',
      'but', 'and', 'so', 'because', 'therefore',
    ].filter((t) => content.toLowerCase().includes(t));

    // CTAs
    const ctaPatterns = content.match(/(click|subscribe|sign up|learn more|get started|try|join|download)[^.!?]*/gi) || [];
    const callToActions = [...new Set(ctaPatterns.map((c) => c.trim().substring(0, 50)))];

    // Signature elements (repeated phrases)
    const phrases = content.match(/\b\w+\s+\w+\s+\w+\b/g) || [];
    const phraseCounts: Record<string, number> = {};
    phrases.forEach((p) => {
      const lower = p.toLowerCase();
      phraseCounts[lower] = (phraseCounts[lower] || 0) + 1;
    });
    const signatureElements = Object.entries(phraseCounts)
      .filter(([, count]) => count > 1)
      .map(([phrase]) => phrase);

    return {
      hookPatterns: [...new Set(hookPatterns)],
      closingPatterns: [...new Set(closingPatterns)],
      transitionPhrases,
      callToActions,
      signatureElements: signatureElements.slice(0, 5),
    };
  }

  // ============================================================================
  // ANALYSIS
  // ============================================================================

  private async analyzePatterns(extracted: ExtractedCharacteristics[]): Promise<ExtractedCharacteristics> {
    if (extracted.length === 0) {
      throw new Error('No data extracted from sources');
    }

    // Weight by confidence
    const totalConfidence = extracted.reduce((sum, e) => sum + e.confidence, 0);

    // Aggregate tone
    const toneVotes: Record<string, number> = {};
    let avgFormality = 0, avgEnergy = 0, avgWarmth = 0, avgHumor = 0;

    extracted.forEach((e) => {
      const weight = e.confidence / totalConfidence;
      toneVotes[e.tone.primary] = (toneVotes[e.tone.primary] || 0) + weight;
      avgFormality += e.tone.formality * weight;
      avgEnergy += e.tone.energy * weight;
      avgWarmth += e.tone.warmth * weight;
      avgHumor += e.tone.humor * weight;
    });

    const primaryTone = Object.entries(toneVotes)
      .sort((a, b) => b[1] - a[1])[0][0];

    // Aggregate vocabulary
    let avgWordLength = 0, avgUniqueRatio = 0, avgJargon = 0;
    const allPreferred: string[] = [];

    extracted.forEach((e) => {
      const weight = e.confidence / totalConfidence;
      avgWordLength += e.vocabulary.averageWordLength * weight;
      avgUniqueRatio += e.vocabulary.uniqueWordsRatio * weight;
      avgJargon += e.vocabulary.jargonLevel * weight;
      allPreferred.push(...e.vocabulary.preferredWords);
    });

    // Most common preferred words
    const wordFreq: Record<string, number> = {};
    allPreferred.forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const topPreferred = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([w]) => w);

    // Aggregate structure
    let avgSentLen = 0, avgParaLen = 0, avgHashtags = 0;
    let listsCount = 0, questionsCount = 0, ctaCount = 0;
    const emojiCounts: Record<string, number> = { none: 0, minimal: 0, moderate: 0, heavy: 0 };

    extracted.forEach((e) => {
      const weight = e.confidence / totalConfidence;
      avgSentLen += e.structure.averageSentenceLength * weight;
      avgParaLen += e.structure.paragraphLength * weight;
      avgHashtags += e.structure.hashtagUsage * weight;
      if (e.structure.usesLists) listsCount++;
      if (e.structure.usesQuestions) questionsCount++;
      if (e.structure.usesCTA) ctaCount++;
      emojiCounts[e.structure.emojiUsage]++;
    });

    const mostCommonEmoji = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as StructureProfile['emojiUsage'];

    // Aggregate patterns
    const allHooks: string[] = [];
    const allClosings: string[] = [];
    const allTransitions: string[] = [];
    const allCTAs: string[] = [];
    const allSignature: string[] = [];

    extracted.forEach((e) => {
      allHooks.push(...e.patterns.hookPatterns);
      allClosings.push(...e.patterns.closingPatterns);
      allTransitions.push(...e.patterns.transitionPhrases);
      allCTAs.push(...e.patterns.callToActions);
      allSignature.push(...e.patterns.signatureElements);
    });

    const countUnique = (arr: string[]) => {
      const counts: Record<string, number> = {};
      arr.forEach((i) => { counts[i] = (counts[i] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([item]) => item);
    };

    return {
      tone: {
        primary: primaryTone,
        secondary: Object.entries(toneVotes)
          .filter(([t]) => t !== primaryTone)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([t]) => t),
        avoided: [],
        formality: Math.round(avgFormality),
        energy: Math.round(avgEnergy),
        warmth: Math.round(avgWarmth),
        humor: Math.round(avgHumor),
      },
      vocabulary: {
        complexity: this.determineComplexity(avgWordLength),
        averageWordLength: avgWordLength,
        uniqueWordsRatio: avgUniqueRatio,
        preferredWords: topPreferred,
        bannedWords: [],
        jargonLevel: Math.round(avgJargon),
      },
      structure: {
        averageSentenceLength: avgSentLen,
        paragraphLength: avgParaLen,
        usesLists: listsCount > extracted.length / 2,
        usesQuestions: questionsCount > extracted.length / 2,
        usesCTA: ctaCount > extracted.length / 2,
        emojiUsage: mostCommonEmoji,
        hashtagUsage: avgHashtags,
      },
      patterns: {
        hookPatterns: countUnique(allHooks),
        closingPatterns: countUnique(allClosings),
        transitionPhrases: countUnique(allTransitions),
        callToActions: countUnique(allCTAs),
        signatureElements: countUnique(allSignature),
      },
      confidence: extracted.reduce((sum, e) => sum + e.confidence, 0) / extracted.length,
    };
  }

  private determineComplexity(avgWordLength: number): VocabularyProfile['complexity'] {
    if (avgWordLength > 7) return 'sophisticated';
    if (avgWordLength > 5.5) return 'technical';
    if (avgWordLength < 4.5) return 'simple';
    return 'standard';
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private async validateTraining(
    characteristics: ExtractedCharacteristics,
    sampleSize: number
  ): Promise<TrainingQuality> {
    const warnings: string[] = [];

    // Data quality check
    let dataQuality = 100;
    if (sampleSize < 5) {
      dataQuality -= 30;
      warnings.push('Low sample size - consider adding more training sources');
    }
    if (sampleSize < 10) {
      dataQuality -= 15;
    }
    if (characteristics.confidence < 50) {
      dataQuality -= 20;
      warnings.push('Low confidence scores - training sources may be too short');
    }

    // Consistency check (based on confidence)
    const consistency = Math.min(100, characteristics.confidence);
    if (consistency < 60) {
      warnings.push('Inconsistent patterns detected across sources');
    }

    // Distinctiveness check
    let distinctiveness = 50;
    if (characteristics.vocabulary.preferredWords.length > 5) distinctiveness += 15;
    if (characteristics.patterns.hookPatterns.length > 0) distinctiveness += 10;
    if (characteristics.patterns.signatureElements.length > 0) distinctiveness += 15;
    if (characteristics.tone.formality > 70 || characteristics.tone.formality < 30) distinctiveness += 10;

    // Overall score
    const overallScore = Math.round((dataQuality + consistency + distinctiveness) / 3);

    return {
      overallScore,
      dataQuality,
      consistency,
      distinctiveness,
      sampleSize,
      warnings,
    };
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private async persistPersona(
    personaId: string,
    characteristics: ExtractedCharacteristics,
    sourcesCount: number
  ): Promise<void> {
    // Map extracted characteristics to Prisma model
    const toneMap: Record<string, string> = {
      professional: 'professional',
      casual: 'casual',
      humorous: 'humorous',
      inspirational: 'inspirational',
      educational: 'educational',
      authoritative: 'authoritative',
    };

    const styleMap: Record<string, string> = {
      professional: 'formal',
      casual: 'conversational',
      educational: 'educational',
      inspirational: 'inspirational',
    };

    const vocabMap: Record<string, string> = {
      simple: 'simple',
      standard: 'standard',
      technical: 'technical',
      sophisticated: 'sophisticated',
    };

    // Determine emotion from tone metrics
    let emotion = 'neutral';
    if (characteristics.tone.warmth > 60) emotion = 'friendly';
    if (characteristics.tone.energy > 70) emotion = 'inspiring';
    if (characteristics.tone.formality > 70) emotion = 'confident';

    // Calculate total words processed (estimate)
    const estimatedWords = sourcesCount * 200;

    await prisma.persona.update({
      where: { id: personaId },
      data: {
        tone: toneMap[characteristics.tone.primary] || 'professional',
        style: styleMap[characteristics.tone.primary] || 'formal',
        vocabulary: vocabMap[characteristics.vocabulary.complexity] || 'standard',
        emotion,
        trainingSourcesCount: sourcesCount,
        trainingWordsCount: estimatedWords,
        trainingSamplesCount: sourcesCount,
        accuracy: Math.round(characteristics.confidence),
        lastTrained: new Date(),
        status: 'active',
      },
    });

    logger.info('Persona training persisted', { personaId, sourcesCount });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private generateSuggestions(quality: TrainingQuality): string[] {
    const suggestions: string[] = [];

    if (quality.sampleSize < 10) {
      suggestions.push('Add more training samples for better accuracy (aim for 10+)');
    }

    if (quality.distinctiveness < 70) {
      suggestions.push('Include more unique/signature content to improve distinctiveness');
    }

    if (quality.consistency < 70) {
      suggestions.push('Ensure training sources have consistent voice and style');
    }

    if (quality.dataQuality < 80) {
      suggestions.push('Use longer, more detailed content samples');
    }

    if (suggestions.length === 0) {
      suggestions.push('Persona is well-trained! Consider periodic retraining to stay current');
    }

    return suggestions;
  }

  private resetProgress(): void {
    this.progress = {
      phase: 'initializing',
      progress: 0,
      sourcesProcessed: 0,
      totalSources: 0,
      currentStep: '',
      errors: [],
      startedAt: new Date(),
    };
  }

  private updateProgress(phase: TrainingProgress['phase'], progress: number, step: string): void {
    this.progress.phase = phase;
    this.progress.progress = progress;
    this.progress.currentStep = step;
    this.onProgressUpdate?.(this.progress);
  }

  getProgress(): TrainingProgress {
    return { ...this.progress };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const personaTrainingPipeline = new PersonaTrainingPipeline();
export default personaTrainingPipeline;
