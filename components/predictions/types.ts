/**
 * Predictive Analytics Types
 *
 * @description TypeScript interfaces for prediction API responses:
 * - Engagement prediction input/output
 * - Prediction history and stats
 * - Optimal posting times
 * - Engagement forecasting
 */

// ============================================================================
// ENGAGEMENT PREDICTION
// ============================================================================

export interface PredictionInput {
  text: string;
  platform: string;
  contentType: string;
  hasMedia: boolean;
  mediaType?: string;
  scheduledTime?: string;
  audienceSize?: number;
}

export interface PredictionResult {
  prediction: {
    id: string;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagementRate: number;
    confidence: number;
  };
  factors: Array<{
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    weight: number;
  }>;
  recommendations: string[];
  predictedAt: string;
}

// ============================================================================
// PREDICTION HISTORY
// ============================================================================

export interface PredictionHistoryItem {
  id: string;
  platform: string;
  contentType: string;
  predictedLikes: number;
  predictedComments: number;
  predictedShares: number;
  predictedReach: number;
  predictedEngRate: number;
  actualLikes?: number;
  actualComments?: number;
  actualShares?: number;
  actualReach?: number;
  accuracy?: number;
  confidenceLevel: number;
  predictedAt: string;
}

export interface PredictionStats {
  totalPredictions: number;
  withResults: number;
  avgAccuracy: number | null;
}

// ============================================================================
// OPTIMAL POSTING TIMES
// ============================================================================

export interface OptimalTimeSlot {
  day: number;
  hour: number;
  score: number;
  confidence: number;
}

export interface OptimalTimesResult {
  platform: string;
  timezone: string;
  slots: OptimalTimeSlot[];
  topSlot: OptimalTimeSlot;
  nextOptimalTime: string;
  basedOnDataPoints: number;
  methodology: 'historical' | 'industry' | 'hybrid';
}

// ============================================================================
// ENGAGEMENT FORECAST
// ============================================================================

export interface ForecastPoint {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

export interface EngagementForecast {
  platform: string;
  metric: string;
  currentValue: number;
  predictions: ForecastPoint[];
  trend: 'rising' | 'stable' | 'declining' | 'volatile';
  growthRate: number;
  confidence: number;
}
