/**
 * Psychology Analysis Types
 * Type definitions for psychology analysis features
 */

export interface PsychologyPrinciple {
  name: string;
  score: number;
  description: string;
  recommendation: string;
}

export interface EmotionalTone {
  primary: string;
  secondary: string[];
  score: number;
}

export interface Readability {
  score: number;
  level: string;
  wordCount: number;
  avgSentenceLength: number;
}

export interface PersuasionMetrics {
  clarity: number;
  urgency: number;
  credibility: number;
  engagement: number;
}

export interface AnalysisResult {
  overallScore: number;
  principles: PsychologyPrinciple[];
  emotionalTone: EmotionalTone;
  readability: Readability;
  persuasionMetrics: PersuasionMetrics;
  recommendations: string[];
}

export interface Platform {
  id: string;
  name: string;
  maxLength: number;
}

export interface ContentType {
  id: string;
  name: string;
}
