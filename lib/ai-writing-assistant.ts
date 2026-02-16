/**
 * AI Writing Assistant
 * Advanced AI-powered writing tools with tone adjustment
 */

export type WritingTone = 
  | 'professional' 
  | 'casual' 
  | 'friendly' 
  | 'formal' 
  | 'humorous' 
  | 'inspirational' 
  | 'educational' 
  | 'persuasive'
  | 'empathetic'
  | 'confident';

export type ContentLength = 'short' | 'medium' | 'long';

export interface WritingStyle {
  tone: WritingTone;
  length: ContentLength;
  keywords?: string[];
  audience?: string;
  emojis?: boolean;
  hashtags?: boolean;
}

export interface AIWritingRequest {
  prompt: string;
  style: WritingStyle;
  platform?: string;
  context?: string;
  examples?: string[];
}

export interface AIWritingResponse {
  content: string;
  alternatives?: string[];
  suggestions?: string[];
  score?: number;
  readability?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

/** Configuration for a specific writing tone */
interface ToneConfig {
  description: string;
  vocabulary: string[];
  structure: string;
  punctuation: string;
  emojis: boolean;
}

// Tone descriptions and characteristics
const toneCharacteristics: Record<WritingTone, ToneConfig> = {
  professional: {
    description: 'Business-appropriate, clear, and authoritative',
    vocabulary: ['strategic', 'innovative', 'comprehensive', 'efficient'],
    structure: 'Clear paragraphs with topic sentences',
    punctuation: 'Standard punctuation, minimal exclamations',
    emojis: false
  },
  casual: {
    description: 'Relaxed, conversational, and approachable',
    vocabulary: ['awesome', 'cool', 'check out', 'grab'],
    structure: 'Short sentences, informal flow',
    punctuation: 'Varied punctuation, occasional exclamations',
    emojis: true
  },
  friendly: {
    description: 'Warm, welcoming, and personable',
    vocabulary: ['happy', 'excited', 'love', 'wonderful'],
    structure: 'Conversational with personal touches',
    punctuation: 'Moderate exclamations, positive tone',
    emojis: true
  },
  formal: {
    description: 'Traditional, structured, and academic',
    vocabulary: ['therefore', 'furthermore', 'consequently', 'pursuant'],
    structure: 'Complex sentences, logical flow',
    punctuation: 'Conservative punctuation',
    emojis: false
  },
  humorous: {
    description: 'Witty, entertaining, and light-hearted',
    vocabulary: ['hilarious', 'epic', 'legendary', 'plot twist'],
    structure: 'Setup and punchline, wordplay',
    punctuation: 'Expressive punctuation',
    emojis: true
  },
  inspirational: {
    description: 'Motivating, uplifting, and empowering',
    vocabulary: ['achieve', 'dream', 'believe', 'transform'],
    structure: 'Building momentum, call to action',
    punctuation: 'Emphatic punctuation',
    emojis: true
  },
  educational: {
    description: 'Informative, clear, and instructional',
    vocabulary: ['learn', 'discover', 'understand', 'explore'],
    structure: 'Step-by-step, examples, summaries',
    punctuation: 'Clear and consistent',
    emojis: false
  },
  persuasive: {
    description: 'Convincing, compelling, and action-oriented',
    vocabulary: ['proven', 'guaranteed', 'exclusive', 'limited'],
    structure: 'Problem-solution, benefits focus',
    punctuation: 'Strategic emphasis',
    emojis: false
  },
  empathetic: {
    description: 'Understanding, supportive, and compassionate',
    vocabulary: ['understand', 'feel', 'support', 'together'],
    structure: 'Acknowledging feelings, offering help',
    punctuation: 'Gentle and reassuring',
    emojis: true
  },
  confident: {
    description: 'Bold, assertive, and self-assured',
    vocabulary: ['definitely', 'absolutely', 'guaranteed', 'proven'],
    structure: 'Direct statements, strong claims',
    punctuation: 'Declarative and strong',
    emojis: false
  }
};

/**
 * Generate AI-powered content with specific tone.
 * Requires OPENROUTER_API_KEY to be configured.
 */
export async function generateContent(request: AIWritingRequest): Promise<AIWritingResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI writing assistant not configured. Content generation requires an AI API key (OPENROUTER_API_KEY).'
    );
  }

  const toneConfig = toneCharacteristics[request.style.tone];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://synthex.app',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: `Write content about: "${request.prompt}"

Tone: ${request.style.tone} (${toneConfig.description})
Length: ${request.style.length}
${request.style.emojis ? 'Include emojis.' : 'No emojis.'}
${request.style.hashtags ? 'Include relevant hashtags.' : 'No hashtags.'}
${request.platform ? `Platform: ${request.platform}` : ''}

Respond with ONLY the generated content text. No preamble.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}. Content generation failed.`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  if (!content) {
    throw new Error('AI returned empty content. Please try again.');
  }

  const suggestions = generateSuggestions(content, request.style);

  return {
    content,
    alternatives: [], // Alternatives require separate AI calls; not populated in single generation
    suggestions,
    score: calculateContentScore(content, request.style),
    readability: calculateReadability(content),
    sentiment: analyzeSentiment(content)
  };
}

/**
 * Rewrite content with different tone
 */
export function rewriteWithTone(
  originalContent: string,
  fromTone: WritingTone,
  toTone: WritingTone
): string {
  const fromConfig = toneCharacteristics[fromTone];
  const toConfig = toneCharacteristics[toTone];
  
  // Mock tone transformation
  let rewritten = originalContent;
  
  // Replace vocabulary
  fromConfig.vocabulary.forEach((word: string, index: number) => {
    if (toConfig.vocabulary[index]) {
      rewritten = rewritten.replace(new RegExp(word, 'gi'), toConfig.vocabulary[index]);
    }
  });
  
  // Adjust punctuation
  if (toConfig.emojis && !fromConfig.emojis) {
    rewritten += ' 😊';
  }
  
  return rewritten;
}

/**
 * Enhance content with AI suggestions
 */
export function enhanceContent(content: string, style: WritingStyle): string[] {
  const enhancements: string[] = [];
  
  // Add power words based on tone
  if (style.tone === 'persuasive') {
    enhancements.push('Add urgency: "Limited time offer"');
    enhancements.push('Include social proof: "Join 10,000+ satisfied customers"');
  }
  
  // Suggest structural improvements
  if (content.length < 50) {
    enhancements.push('Expand with more details or examples');
  }
  
  // Add call-to-action suggestions
  if (!content.includes('!') && style.tone === 'inspirational') {
    enhancements.push('Add an inspiring call-to-action');
  }
  
  // Keyword optimization
  if (style.keywords && style.keywords.length > 0) {
    const missingKeywords = style.keywords.filter(kw => 
      !content.toLowerCase().includes(kw.toLowerCase())
    );
    if (missingKeywords.length > 0) {
      enhancements.push(`Include keywords: ${missingKeywords.join(', ')}`);
    }
  }
  
  return enhancements;
}

/**
 * Generate content variations
 */
export function generateVariations(
  content: string,
  count: number = 3
): string[] {
  const variations: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Mock variations - in production, use AI
    const variation = content
      .replace(/great/gi, ['amazing', 'fantastic', 'excellent'][i] || 'great')
      .replace(/!/g, i === 0 ? '.' : '!')
      .replace(/Check out/gi, ['Discover', 'Explore', 'See'][i] || 'Check out');
    
    variations.push(variation);
  }
  
  return variations;
}

/**
 * Adjust content length
 */
export function adjustLength(
  content: string,
  targetLength: ContentLength
): string {
  const lengths = {
    short: 50,
    medium: 150,
    long: 300
  };
  
  const targetWords = lengths[targetLength];
  const currentWords = content.split(' ').length;
  
  if (currentWords > targetWords) {
    // Shorten content
    return content.split(' ').slice(0, targetWords).join(' ') + '...';
  } else if (currentWords < targetWords * 0.8) {
    // Expand content
    return content + ' ' + generateFillerContent(targetWords - currentWords);
  }
  
  return content;
}

/**
 * Check content for tone consistency
 */
export function checkToneConsistency(
  content: string,
  expectedTone: WritingTone
): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const toneConfig = toneCharacteristics[expectedTone];
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // Check for inappropriate emoji usage
  const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(content);
  if (hasEmojis && !toneConfig.emojis) {
    issues.push('Remove emojis for ' + expectedTone + ' tone');
    score -= 20;
  } else if (!hasEmojis && toneConfig.emojis) {
    suggestions.push('Consider adding emojis for better engagement');
    score -= 10;
  }
  
  // Check vocabulary alignment
  const inappropriateWords: Partial<Record<WritingTone, string[]>> = {
    professional: ['lol', 'omg', 'btw', 'gonna'],
    formal: ['cool', 'awesome', 'stuff', 'things'],
    casual: ['pursuant', 'heretofore', 'whereas'],
    educational: ['lol', 'omg', 'awesome'],
    persuasive: ['maybe', 'possibly', 'uncertain'],
    empathetic: ['whatever', 'don\'t care', 'not my problem'],
    confident: ['maybe', 'perhaps', 'uncertain']
  };
  
  const wordsToAvoid = inappropriateWords[expectedTone] || [];
  wordsToAvoid.forEach((word: string) => {
    if (content.toLowerCase().includes(word)) {
      issues.push(`"${word}" doesn't fit ${expectedTone} tone`);
      score -= 15;
    }
  });
  
  return { score, issues, suggestions };
}

// Helper functions

function generateSuggestions(content: string, style: WritingStyle): string[] {
  const suggestions: string[] = [];
  
  if (content.length < 100) {
    suggestions.push('Add more detail to improve engagement');
  }
  
  if (!content.includes('#') && style.hashtags) {
    suggestions.push('Add relevant hashtags for better reach');
  }
  
  if (style.tone === 'persuasive' && !content.includes('?')) {
    suggestions.push('Consider adding a question to engage readers');
  }
  
  return suggestions;
}

function calculateContentScore(content: string, style: WritingStyle): number {
  let score = 70; // Base score
  
  // Length appropriateness
  const wordCount = content.split(' ').length;
  const idealLengths = { short: 50, medium: 150, long: 300 };
  const idealLength = idealLengths[style.length];
  
  if (Math.abs(wordCount - idealLength) / idealLength < 0.2) {
    score += 10;
  }
  
  // Keyword inclusion
  if (style.keywords) {
    const includedKeywords = style.keywords.filter(kw => 
      content.toLowerCase().includes(kw.toLowerCase())
    );
    score += (includedKeywords.length / style.keywords.length) * 20;
  }
  
  return Math.min(100, score);
}

function calculateReadability(content: string): number {
  // Simple readability score based on sentence and word length
  const sentences = content.split(/[.!?]/).filter(s => s.trim());
  const words = content.split(' ');
  const avgWordsPerSentence = words.length / sentences.length;
  
  // Lower is better (simpler)
  if (avgWordsPerSentence < 15) return 90;
  if (avgWordsPerSentence < 20) return 75;
  if (avgWordsPerSentence < 25) return 60;
  return 45;
}

function analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['great', 'awesome', 'love', 'excellent', 'amazing', 'happy'];
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'horrible', 'sad'];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (content.toLowerCase().includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (content.toLowerCase().includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function generateFillerContent(wordCount: number): string {
  const fillers = [
    'This provides additional value',
    'Furthermore, it enhances the experience',
    'Additionally, consider the benefits',
    'This approach ensures success'
  ];
  
  let filler = '';
  for (let i = 0; i < wordCount / 5; i++) {
    filler += ' ' + fillers[i % fillers.length];
  }
  
  return filler;
}