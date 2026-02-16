/**
 * AI Persona Learning System
 * Learns and adapts to brand voice and audience preferences
 *
 * NOTE(phase-3): This file is client-side (imported by components/AIPersonaManager.tsx).
 * It uses in-memory Map and localStorage for persona storage.
 * Phase 3 will migrate this to API calls backed by Prisma database queries
 * (the Persona model in prisma/schema.prisma) instead of localStorage.
 */

export interface PersonaProfile {
  id: string;
  name: string;
  description: string;
  voiceCharacteristics: VoiceCharacteristics;
  contentPreferences: ContentPreferences;
  audienceInsights: AudienceInsights;
  learningData: LearningData;
  performance: PerformanceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceCharacteristics {
  tonePreferences: {
    primary: string;
    secondary: string[];
    avoided: string[];
  };
  vocabularyStyle: {
    complexity: 'simple' | 'moderate' | 'complex';
    jargonLevel: 'none' | 'minimal' | 'industry' | 'technical';
    preferredWords: string[];
    bannedWords: string[];
  };
  sentenceStructure: {
    averageLength: number;
    complexity: 'short' | 'medium' | 'long';
    punctuationStyle: 'minimal' | 'standard' | 'expressive';
  };
  emotionalTone: {
    positivity: number; // 0-100
    energy: number; // 0-100
    formality: number; // 0-100
    humor: number; // 0-100
  };
}

export interface ContentPreferences {
  topics: {
    primary: string[];
    secondary: string[];
    trending: string[];
    avoided: string[];
  };
  formats: {
    preferred: ContentFormat[];
    successful: ContentFormat[];
    unsuccessful: ContentFormat[];
  };
  timing: {
    bestDays: string[];
    bestHours: number[];
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  };
  hashtags: {
    commonly: string[];
    branded: string[];
    performance: Record<string, number>;
  };
  emojis: {
    usage: 'never' | 'minimal' | 'moderate' | 'frequent';
    preferred: string[];
  };
}

export interface ContentFormat {
  type: 'text' | 'image' | 'video' | 'carousel' | 'story' | 'thread';
  platform: string;
  engagement: number;
  reach: number;
}

export interface AudienceInsights {
  demographics: {
    ageRange: string;
    primaryGender: string;
    locations: string[];
    interests: string[];
    occupations: string[];
  };
  behavior: {
    activeHours: number[];
    engagementPatterns: Record<string, number>;
    contentPreferences: string[];
    interactionStyle: 'passive' | 'moderate' | 'highly-engaged';
  };
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    topicSentiment: Record<string, string>;
    feedbackThemes: string[];
  };
}

export interface LearningData {
  contentHistory: ContentHistoryItem[];
  engagementPatterns: EngagementPattern[];
  adaptations: Adaptation[];
  experiments: Experiment[];
}

export interface ContentHistoryItem {
  id: string;
  content: string;
  platform: string;
  timestamp: Date;
  metrics: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
    engagement: number;
  };
  sentiment: string;
  topics: string[];
}

export interface EngagementPattern {
  pattern: string;
  frequency: number;
  success: number;
  examples: string[];
}

export interface Adaptation {
  date: Date;
  type: 'tone' | 'timing' | 'format' | 'topic';
  change: string;
  reason: string;
  impact: number;
}

export interface Experiment {
  id: string;
  hypothesis: string;
  variable: string;
  control: unknown;
  variant: unknown;
  result: 'success' | 'failure' | 'inconclusive';
  learning: string;
}

/** Content metrics for learning */
interface ContentLearnMetrics {
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  engagement: number;
}

export interface PerformanceMetrics {
  overallScore: number;
  growthRate: number;
  engagementRate: number;
  consistencyScore: number;
  adaptabilityScore: number;
  predictions: {
    nextBestTime: Date;
    recommendedContent: string[];
    expectedEngagement: number;
  };
}

// Persona learning class
export class PersonaLearningSystem {
  private personas: Map<string, PersonaProfile> = new Map();
  private currentPersona: PersonaProfile | null = null;
  
  constructor() {
    this.loadPersonas();
  }
  
  // Load existing personas
  private loadPersonas() {
    const stored = localStorage.getItem('ai_personas');
    if (stored) {
      const data = JSON.parse(stored);
      data.forEach((p: PersonaProfile) => {
        this.personas.set(p.id, p);
      });
    }
  }
  
  // Save personas
  private savePersonas() {
    const data = Array.from(this.personas.values());
    localStorage.setItem('ai_personas', JSON.stringify(data));
  }
  
  // Create new persona
  createPersona(name: string, description: string): PersonaProfile {
    const persona: PersonaProfile = {
      id: `persona-${Date.now()}`,
      name,
      description,
      voiceCharacteristics: this.initializeVoiceCharacteristics(),
      contentPreferences: this.initializeContentPreferences(),
      audienceInsights: this.initializeAudienceInsights(),
      learningData: {
        contentHistory: [],
        engagementPatterns: [],
        adaptations: [],
        experiments: []
      },
      performance: this.initializePerformanceMetrics(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.personas.set(persona.id, persona);
    this.savePersonas();
    return persona;
  }
  
  // Learn from content performance
  learnFromContent(
    personaId: string,
    content: string,
    metrics: ContentLearnMetrics,
    platform: string
  ) {
    const persona = this.personas.get(personaId);
    if (!persona) return;
    
    // Add to content history
    const historyItem: ContentHistoryItem = {
      id: `content-${Date.now()}`,
      content,
      platform,
      timestamp: new Date(),
      metrics,
      sentiment: this.analyzeSentiment(content),
      topics: this.extractTopics(content)
    };
    
    persona.learningData.contentHistory.push(historyItem);
    
    // Update patterns
    this.updateEngagementPatterns(persona, historyItem);
    
    // Adapt based on performance
    this.adaptPersona(persona, historyItem);
    
    // Update predictions
    this.updatePredictions(persona);
    
    persona.updatedAt = new Date();
    this.savePersonas();
  }
  
  // Update engagement patterns
  private updateEngagementPatterns(
    persona: PersonaProfile,
    item: ContentHistoryItem
  ) {
    // Identify patterns in successful content
    if (item.metrics.engagement > persona.performance.engagementRate * 1.2) {
      // This content performed well, learn from it
      const patterns = this.extractPatterns(item.content);
      
      patterns.forEach(pattern => {
        const existing = persona.learningData.engagementPatterns.find(
          p => p.pattern === pattern
        );
        
        if (existing) {
          existing.frequency++;
          existing.success = (existing.success + item.metrics.engagement) / 2;
          existing.examples.push(item.content.substring(0, 100));
        } else {
          persona.learningData.engagementPatterns.push({
            pattern,
            frequency: 1,
            success: item.metrics.engagement,
            examples: [item.content.substring(0, 100)]
          });
        }
      });
    }
  }
  
  // Adapt persona based on learning
  private adaptPersona(
    persona: PersonaProfile,
    item: ContentHistoryItem
  ) {
    const recentHistory = persona.learningData.contentHistory.slice(-10);
    const avgEngagement = recentHistory.reduce(
      (sum, h) => sum + h.metrics.engagement, 0
    ) / recentHistory.length;
    
    // If performance is declining, suggest adaptations
    if (avgEngagement < persona.performance.engagementRate * 0.8) {
      const adaptation: Adaptation = {
        date: new Date(),
        type: 'tone',
        change: 'Adjust tone to be more engaging',
        reason: 'Declining engagement detected',
        impact: 0
      };
      
      persona.learningData.adaptations.push(adaptation);
      
      // Adjust voice characteristics
      if (persona.voiceCharacteristics.emotionalTone.energy < 70) {
        persona.voiceCharacteristics.emotionalTone.energy += 10;
      }
    }
  }
  
  // Generate content suggestions based on learning
  generateSuggestions(personaId: string): string[] {
    const persona = this.personas.get(personaId);
    if (!persona) return [];
    
    const suggestions: string[] = [];
    
    // Based on successful patterns
    const topPatterns = persona.learningData.engagementPatterns
      .sort((a, b) => b.success - a.success)
      .slice(0, 5);
    
    topPatterns.forEach(pattern => {
      suggestions.push(`Use "${pattern.pattern}" - historically drives ${pattern.success}% engagement`);
    });
    
    // Based on timing
    const bestHour = persona.contentPreferences.timing.bestHours[0];
    suggestions.push(`Post at ${bestHour}:00 for optimal reach`);
    
    // Based on topics
    persona.contentPreferences.topics.trending.forEach(topic => {
      suggestions.push(`Create content about "${topic}" - currently trending with your audience`);
    });
    
    return suggestions;
  }
  
  // Predict content performance
  predictPerformance(
    personaId: string,
    content: string,
    platform: string
  ): number {
    const persona = this.personas.get(personaId);
    if (!persona) return 50;
    
    let score = 50; // Base score
    
    // Check for successful patterns
    persona.learningData.engagementPatterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern.pattern.toLowerCase())) {
        score += pattern.success * 0.1;
      }
    });
    
    // Check tone alignment
    const sentiment = this.analyzeSentiment(content);
    if (sentiment === 'positive' && persona.audienceInsights.sentiment.overall === 'positive') {
      score += 10;
    }
    
    // Check topic relevance
    const topics = this.extractTopics(content);
    topics.forEach(topic => {
      if (persona.contentPreferences.topics.primary.includes(topic)) {
        score += 5;
      }
    });
    
    return Math.min(100, Math.max(0, score));
  }
  
  // Run A/B test experiment
  runExperiment(
    _personaId: string,
    _hypothesis: string,
    _variable: string,
    _control: unknown,
    _variant: unknown
  ): Experiment {
    // Experiment tracking requires analytics integration (API-backed).
    // This client-side file is pending migration to API calls (see TODO at top).
    // Previously this used Math.random() to simulate results, which is not useful.
    throw new Error(
      'Experiment tracking not configured. ' +
      'A/B testing requires analytics integration backed by the Persona API.'
    );
  }
  
  // Get persona recommendations
  getRecommendations(personaId: string): {
    content: string[];
    timing: string;
    format: string;
    hashtags: string[];
  } {
    const persona = this.personas.get(personaId);
    if (!persona) return { content: [], timing: '', format: '', hashtags: [] };
    
    return {
      content: this.generateSuggestions(personaId),
      timing: `Best time: ${persona.contentPreferences.timing.bestHours[0]}:00`,
      format: persona.contentPreferences.formats.preferred[0]?.type || 'text',
      hashtags: persona.contentPreferences.hashtags.commonly.slice(0, 10)
    };
  }
  
  // Helper methods
  private initializeVoiceCharacteristics(): VoiceCharacteristics {
    return {
      tonePreferences: {
        primary: 'professional',
        secondary: ['friendly', 'informative'],
        avoided: ['controversial', 'negative']
      },
      vocabularyStyle: {
        complexity: 'moderate',
        jargonLevel: 'minimal',
        preferredWords: [],
        bannedWords: []
      },
      sentenceStructure: {
        averageLength: 15,
        complexity: 'medium',
        punctuationStyle: 'standard'
      },
      emotionalTone: {
        positivity: 70,
        energy: 60,
        formality: 50,
        humor: 30
      }
    };
  }
  
  private initializeContentPreferences(): ContentPreferences {
    return {
      topics: {
        primary: [],
        secondary: [],
        trending: [],
        avoided: []
      },
      formats: {
        preferred: [],
        successful: [],
        unsuccessful: []
      },
      timing: {
        bestDays: ['Tuesday', 'Thursday'],
        bestHours: [9, 12, 17],
        frequency: 'daily'
      },
      hashtags: {
        commonly: [],
        branded: [],
        performance: {}
      },
      emojis: {
        usage: 'moderate',
        preferred: ['👍', '❤️', '🚀', '✨']
      }
    };
  }
  
  private initializeAudienceInsights(): AudienceInsights {
    return {
      demographics: {
        ageRange: '25-44',
        primaryGender: 'all',
        locations: [],
        interests: [],
        occupations: []
      },
      behavior: {
        activeHours: [9, 12, 17, 20],
        engagementPatterns: {},
        contentPreferences: [],
        interactionStyle: 'moderate'
      },
      sentiment: {
        overall: 'positive',
        topicSentiment: {},
        feedbackThemes: []
      }
    };
  }
  
  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      overallScore: 70,
      growthRate: 0,
      engagementRate: 4.5,
      consistencyScore: 80,
      adaptabilityScore: 60,
      predictions: {
        nextBestTime: new Date(),
        recommendedContent: [],
        expectedEngagement: 5
      }
    };
  }
  
  private analyzeSentiment(content: string): string {
    // Simple sentiment analysis
    const positive = ['great', 'awesome', 'love', 'amazing', 'excellent'].filter(
      word => content.toLowerCase().includes(word)
    ).length;
    
    const negative = ['bad', 'terrible', 'hate', 'awful', 'worst'].filter(
      word => content.toLowerCase().includes(word)
    ).length;
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }
  
  private extractTopics(content: string): string[] {
    // Simple topic extraction
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 5);
    
    return [...new Set(words)].slice(0, 5);
  }
  
  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    
    // Check for question patterns
    if (content.includes('?')) patterns.push('question');
    
    // Check for emoji usage
    if (/[\u{1F300}-\u{1F9FF}]/u.test(content)) patterns.push('emoji');
    
    // Check for hashtag usage
    if (content.includes('#')) patterns.push('hashtag');
    
    // Check for call-to-action
    if (content.match(/click|link|visit|check out|learn more/i)) patterns.push('cta');
    
    return patterns;
  }
  
  private updatePredictions(persona: PersonaProfile) {
    // Update performance predictions based on recent data
    const recentHistory = persona.learningData.contentHistory.slice(-20);
    
    if (recentHistory.length > 0) {
      const avgEngagement = recentHistory.reduce(
        (sum, h) => sum + h.metrics.engagement, 0
      ) / recentHistory.length;
      
      persona.performance.predictions.expectedEngagement = avgEngagement;
    }
    
    // Predict next best time
    const now = new Date();
    const bestHour = persona.contentPreferences.timing.bestHours[0] || 12;
    const nextBest = new Date(now);
    nextBest.setHours(bestHour, 0, 0, 0);
    if (nextBest <= now) {
      nextBest.setDate(nextBest.getDate() + 1);
    }
    
    persona.performance.predictions.nextBestTime = nextBest;
  }
}

// Export singleton instance
export const personaLearning = new PersonaLearningSystem();