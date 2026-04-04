/**
 * AI-Powered NLP Analyzer
 *
 * Uses LLMs for deep content analysis including:
 * - Tone and style detection
 * - Topic extraction
 * - Pattern recognition
 * - Sentiment analysis
 * - Writing style fingerprinting
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 */

import { callOpenRouter } from './openrouter';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface NLPAnalysisResult {
  tone: ToneAnalysis;
  vocabulary: VocabularyAnalysis;
  structure: StructureAnalysis;
  patterns: PatternAnalysis;
  topics: string[];
  sentiment: SentimentAnalysis;
  confidence: number;
  rawAnalysis?: string;
}

export interface ToneAnalysis {
  primary: string;
  secondary: string[];
  formality: number; // 0-100
  energy: number; // 0-100
  warmth: number; // 0-100
  humor: number; // 0-100
  confidence: number; // 0-100
  explanation: string;
}

export interface VocabularyAnalysis {
  complexity: 'simple' | 'standard' | 'technical' | 'sophisticated';
  jargonLevel: number; // 0-100
  preferredWords: string[];
  uniquePhrases: string[];
  readingLevel: string;
}

export interface StructureAnalysis {
  averageSentenceLength: number;
  usesLists: boolean;
  usesQuestions: boolean;
  usesCTA: boolean;
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtagUsage: number;
  paragraphStyle: string;
}

export interface PatternAnalysis {
  hookPatterns: string[];
  closingPatterns: string[];
  transitionPhrases: string[];
  callToActions: string[];
  signatureElements: string[];
  recurringThemes: string[];
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  score: number; // -100 to 100
  emotions: string[];
  confidence: number;
}

// ============================================================================
// NLP ANALYZER CLASS
// ============================================================================

export class NLPAnalyzer {
  private readonly analysisPrompt = `You are an expert linguist and content analyst. Analyze the following text and provide a detailed JSON response.

Analyze this content:
"""
{CONTENT}
"""

Provide your analysis in this exact JSON format (no markdown, just JSON):
{
  "tone": {
    "primary": "professional|casual|humorous|inspirational|educational|authoritative|friendly|formal",
    "secondary": ["list of secondary tones"],
    "formality": 0-100,
    "energy": 0-100,
    "warmth": 0-100,
    "humor": 0-100,
    "explanation": "brief explanation of tone choices"
  },
  "vocabulary": {
    "complexity": "simple|standard|technical|sophisticated",
    "jargonLevel": 0-100,
    "preferredWords": ["frequently used significant words"],
    "uniquePhrases": ["distinctive phrases or expressions"],
    "readingLevel": "grade level description"
  },
  "structure": {
    "averageSentenceLength": number,
    "usesLists": true/false,
    "usesQuestions": true/false,
    "usesCTA": true/false,
    "emojiUsage": "none|minimal|moderate|heavy",
    "hashtagUsage": average per paragraph,
    "paragraphStyle": "description of paragraph organization"
  },
  "patterns": {
    "hookPatterns": ["opening patterns used"],
    "closingPatterns": ["closing patterns used"],
    "transitionPhrases": ["transition words/phrases"],
    "callToActions": ["CTAs found"],
    "signatureElements": ["recurring signature phrases or elements"],
    "recurringThemes": ["main themes in content"]
  },
  "topics": ["main topics covered"],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": -100 to 100,
    "emotions": ["detected emotions"],
    "confidence": 0-100
  },
  "confidence": 0-100
}

Be precise and analytical. Extract real patterns from the content.`;

  /**
   * Analyze content using AI
   */
  async analyze(content: string): Promise<NLPAnalysisResult> {
    if (!content || content.trim().length < 10) {
      throw new Error('Content too short for analysis');
    }

    try {
      const prompt = this.analysisPrompt.replace('{CONTENT}', content);

      const response = await callOpenRouter(prompt, {
        model: 'anthropic/claude-3-haiku-20240307', // Fast and capable for analysis
        systemPrompt:
          'You are a precise JSON-only response generator. Output valid JSON only, no markdown, no explanations.',
        temperature: 0.3, // Lower temperature for consistent analysis
        maxTokens: 2000,
      });

      // Parse JSON from response
      const analysis = this.parseAnalysisResponse(response);

      return {
        ...analysis,
        rawAnalysis: response,
      };
    } catch (error) {
      logger.error('NLP analysis failed', { error, contentLength: content.length });

      // Return fallback analysis using rule-based approach
      return this.fallbackAnalysis(content);
    }
  }

  /**
   * Batch analyze multiple content pieces
   */
  async batchAnalyze(contents: string[]): Promise<NLPAnalysisResult[]> {
    const results = await Promise.all(
      contents.map((content) =>
        this.analyze(content).catch((error) => {
          logger.warn('Batch analysis item failed', { error });
          return this.fallbackAnalysis(content);
        })
      )
    );

    return results;
  }

  /**
   * Extract topics from content using AI
   */
  async extractTopics(content: string): Promise<string[]> {
    try {
      const response = await callOpenRouter(
        `Extract the main topics from this content. Return only a JSON array of topic strings.

Content:
"""
${content}
"""

Response format: ["topic1", "topic2", "topic3"]`,
        {
          model: 'anthropic/claude-3-haiku-20240307',
          temperature: 0.2,
          maxTokens: 500,
        }
      );

      const topics = JSON.parse(response);
      return Array.isArray(topics) ? topics : [];
    } catch {
      // Fallback: simple word frequency
      return this.extractTopicsFallback(content);
    }
  }

  /**
   * Analyze sentiment with AI
   */
  async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      const response = await callOpenRouter(
        `Analyze the sentiment of this content. Return JSON only.

Content:
"""
${content}
"""

Response format:
{
  "overall": "positive|neutral|negative",
  "score": -100 to 100,
  "emotions": ["detected emotions"],
  "confidence": 0-100
}`,
        {
          model: 'anthropic/claude-3-haiku-20240307',
          temperature: 0.2,
          maxTokens: 300,
        }
      );

      return JSON.parse(response);
    } catch {
      return this.analyzeSentimentFallback(content);
    }
  }

  /**
   * Compare two content pieces for similarity
   */
  async compareContent(content1: string, content2: string): Promise<{
    similarity: number;
    sharedPatterns: string[];
    differences: string[];
  }> {
    try {
      const response = await callOpenRouter(
        `Compare these two pieces of content and analyze their similarity.

Content 1:
"""
${content1}
"""

Content 2:
"""
${content2}
"""

Return JSON:
{
  "similarity": 0-100,
  "sharedPatterns": ["shared writing patterns"],
  "differences": ["key differences in style/tone"]
}`,
        {
          model: 'anthropic/claude-3-haiku-20240307',
          temperature: 0.3,
          maxTokens: 500,
        }
      );

      return JSON.parse(response);
    } catch {
      return { similarity: 50, sharedPatterns: [], differences: [] };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private parseAnalysisResponse(response: string): NLPAnalysisResult {
    // Try to extract JSON from response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '');
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the response
      return {
        tone: this.normalizeTone(parsed.tone),
        vocabulary: this.normalizeVocabulary(parsed.vocabulary),
        structure: this.normalizeStructure(parsed.structure),
        patterns: this.normalizePatterns(parsed.patterns),
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        sentiment: this.normalizeSentiment(parsed.sentiment),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 70,
      };
    } catch (parseError) {
      logger.warn('Failed to parse NLP response as JSON', { parseError });
      throw new Error('Failed to parse analysis response');
    }
  }

  private normalizeTone(tone: Partial<ToneAnalysis> | undefined): ToneAnalysis {
    return {
      primary: tone?.primary || 'professional',
      secondary: Array.isArray(tone?.secondary) ? tone.secondary : [],
      formality: this.clamp(tone?.formality ?? 50, 0, 100),
      energy: this.clamp(tone?.energy ?? 50, 0, 100),
      warmth: this.clamp(tone?.warmth ?? 50, 0, 100),
      humor: this.clamp(tone?.humor ?? 20, 0, 100),
      confidence: this.clamp(tone?.confidence ?? 70, 0, 100),
      explanation: tone?.explanation || '',
    };
  }

  private normalizeVocabulary(vocab: Partial<VocabularyAnalysis> | undefined): VocabularyAnalysis {
    const validComplexity = ['simple', 'standard', 'technical', 'sophisticated'];
    return {
      complexity: validComplexity.includes(vocab?.complexity || '')
        ? (vocab!.complexity as VocabularyAnalysis['complexity'])
        : 'standard',
      jargonLevel: this.clamp(vocab?.jargonLevel ?? 30, 0, 100),
      preferredWords: Array.isArray(vocab?.preferredWords) ? vocab.preferredWords : [],
      uniquePhrases: Array.isArray(vocab?.uniquePhrases) ? vocab.uniquePhrases : [],
      readingLevel: vocab?.readingLevel || 'Grade 10-12',
    };
  }

  private normalizeStructure(struct: Partial<StructureAnalysis> | undefined): StructureAnalysis {
    const validEmoji = ['none', 'minimal', 'moderate', 'heavy'];
    return {
      averageSentenceLength: struct?.averageSentenceLength ?? 15,
      usesLists: !!struct?.usesLists,
      usesQuestions: !!struct?.usesQuestions,
      usesCTA: !!struct?.usesCTA,
      emojiUsage: validEmoji.includes(struct?.emojiUsage || '')
        ? (struct!.emojiUsage as StructureAnalysis['emojiUsage'])
        : 'minimal',
      hashtagUsage: struct?.hashtagUsage ?? 0,
      paragraphStyle: struct?.paragraphStyle || 'standard',
    };
  }

  private normalizePatterns(patterns: Partial<PatternAnalysis> | undefined): PatternAnalysis {
    return {
      hookPatterns: Array.isArray(patterns?.hookPatterns) ? patterns.hookPatterns : [],
      closingPatterns: Array.isArray(patterns?.closingPatterns) ? patterns.closingPatterns : [],
      transitionPhrases: Array.isArray(patterns?.transitionPhrases) ? patterns.transitionPhrases : [],
      callToActions: Array.isArray(patterns?.callToActions) ? patterns.callToActions : [],
      signatureElements: Array.isArray(patterns?.signatureElements) ? patterns.signatureElements : [],
      recurringThemes: Array.isArray(patterns?.recurringThemes) ? patterns.recurringThemes : [],
    };
  }

  private normalizeSentiment(sent: Partial<SentimentAnalysis> | undefined): SentimentAnalysis {
    const validOverall = ['positive', 'neutral', 'negative'];
    return {
      overall: validOverall.includes(sent?.overall || '')
        ? (sent!.overall as SentimentAnalysis['overall'])
        : 'neutral',
      score: this.clamp(sent?.score ?? 0, -100, 100),
      emotions: Array.isArray(sent?.emotions) ? sent.emotions : [],
      confidence: this.clamp(sent?.confidence ?? 70, 0, 100),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // ============================================================================
  // FALLBACK METHODS (Rule-based)
  // ============================================================================

  private fallbackAnalysis(content: string): NLPAnalysisResult {
    return {
      tone: this.analyzeToneFallback(content),
      vocabulary: this.analyzeVocabularyFallback(content),
      structure: this.analyzeStructureFallback(content),
      patterns: this.extractPatternsFallback(content),
      topics: this.extractTopicsFallback(content),
      sentiment: this.analyzeSentimentFallback(content),
      confidence: 40, // Lower confidence for fallback
    };
  }

  private analyzeToneFallback(content: string): ToneAnalysis {
    const lower = content.toLowerCase();

    // Detect tones
    const toneMarkers: Record<string, string[]> = {
      professional: ['we', 'our', 'company', 'business', 'solution', 'strategy'],
      casual: ["i'm", "you're", 'gonna', 'kinda', 'hey', 'cool'],
      humorous: ['lol', 'haha', '😂', '🤣', 'joke', 'funny'],
      inspirational: ['dream', 'achieve', 'believe', 'success', 'journey'],
      educational: ['learn', 'discover', 'tip', 'guide', 'how to'],
    };

    const scores: Record<string, number> = {};
    for (const [tone, markers] of Object.entries(toneMarkers)) {
      scores[tone] = markers.filter((m) => lower.includes(m)).length;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0]?.[0] || 'professional';

    return {
      primary,
      secondary: sorted.slice(1, 3).map(([t]) => t),
      formality: lower.includes('therefore') || lower.includes('moreover') ? 70 : 50,
      energy: (content.match(/!/g) || []).length * 10,
      warmth: (content.match(/you|your|we|together/gi) || []).length * 10,
      humor: lower.includes('lol') || lower.includes('haha') ? 60 : 20,
      confidence: 40,
      explanation: 'Fallback analysis based on keyword matching',
    };
  }

  private analyzeVocabularyFallback(content: string): VocabularyAnalysis {
    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const avgLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);

    let complexity: VocabularyAnalysis['complexity'] = 'standard';
    if (avgLength > 7) complexity = 'sophisticated';
    else if (avgLength > 5.5) complexity = 'technical';
    else if (avgLength < 4.5) complexity = 'simple';

    return {
      complexity,
      jargonLevel: 30,
      preferredWords: [],
      uniquePhrases: [],
      readingLevel: 'Unknown',
    };
  }

  private analyzeStructureFallback(content: string): StructureAnalysis {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = content.split(/\s+/).length;

    return {
      averageSentenceLength: words / Math.max(sentences.length, 1),
      usesLists: /[-*•]\s/.test(content) || /^\d+\.\s/m.test(content),
      usesQuestions: /\?/.test(content),
      usesCTA: /click|sign up|subscribe|learn more/i.test(content),
      emojiUsage: this.countEmojis(content) > 3 ? 'heavy' : 'minimal',
      hashtagUsage: (content.match(/#\w+/g) || []).length,
      paragraphStyle: 'unknown',
    };
  }

  private extractPatternsFallback(content: string): PatternAnalysis {
    return {
      hookPatterns: content.includes('?') ? ['question'] : [],
      closingPatterns: /let me know|thoughts/i.test(content) ? ['engagement'] : [],
      transitionPhrases: ['however', 'but', 'and'].filter((t) => content.toLowerCase().includes(t)),
      callToActions: (content.match(/click|subscribe|sign up|learn more/gi) || []).slice(0, 3),
      signatureElements: [],
      recurringThemes: [],
    };
  }

  private extractTopicsFallback(content: string): string[] {
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 6);

    const counts: Record<string, number> = {};
    words.forEach((w) => {
      counts[w] = (counts[w] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private analyzeSentimentFallback(content: string): SentimentAnalysis {
    const lower = content.toLowerCase();
    const positive = ['great', 'awesome', 'love', 'amazing', 'excellent'].filter((w) =>
      lower.includes(w)
    ).length;
    const negative = ['bad', 'terrible', 'hate', 'awful', 'worst'].filter((w) =>
      lower.includes(w)
    ).length;

    const score = (positive - negative) * 20;

    return {
      overall: score > 10 ? 'positive' : score < -10 ? 'negative' : 'neutral',
      score: Math.max(-100, Math.min(100, score)),
      emotions: [],
      confidence: 40,
    };
  }

  private countEmojis(content: string): number {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu;
    return (content.match(emojiRegex) || []).length;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const nlpAnalyzer = new NLPAnalyzer();
export default nlpAnalyzer;
