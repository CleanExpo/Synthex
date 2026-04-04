export interface SentimentData {
  id: string;
  content: string;
  platform: string;
  author: string;
  timestamp: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1
  confidence: number; // 0 to 100
  emotions: EmotionScore[];
  topics: string[];
  entities: Entity[];
  engagement: EngagementMetrics;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface EmotionScore {
  emotion: 'joy' | 'anger' | 'sadness' | 'fear' | 'surprise' | 'disgust';
  score: number;
}

export interface Entity {
  text: string;
  type: 'person' | 'product' | 'brand' | 'location' | 'topic';
  sentiment: number;
}

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

export interface SentimentTrend {
  date: Date;
  positive: number;
  negative: number;
  neutral: number;
  volume: number;
}

export interface TopicSentiment {
  topic: string;
  mentions: number;
  sentiment: number;
  trend: 'rising' | 'falling' | 'stable';
}

// API response types
export interface AnalyticsResponse {
  overall: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    avgScore: number;
    avgConfidence: number;
  };
  trends: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    count: number;
  }>;
  topEmotions: Array<{
    emotion: string;
    count: number;
    percentage: number;
  }>;
}

export interface AnalysisResponse {
  analyses: Array<{
    id: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    score: number;
    confidence: number;
    emotions: Array<{ emotion: string; intensity: number }>;
    platform: string;
    analyzedAt: string;
  }>;
}

export interface SingleAnalysisResponse {
  analysis: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    score: number;
    confidence: number;
    emotions: Array<{ emotion: string; intensity: number }>;
    toneIndicators: string[];
    keyPhrases: string[];
  };
}
