/**
 * E-E-A-T Score Builder Types (Phase 90)
 *
 * Defines the 20-point automated audit result shape.
 * Each of 4 pillars scores 0-25 for a total of 0-100.
 *
 * @module lib/eeat/audit-types
 */

export interface EEATSignal {
  name: string;
  detected: boolean;
  weight: number;       // Points this contributes when detected (max 5)
  evidence?: string;    // Snippet that triggered detection (max 100 chars)
}

export interface EEATDimension {
  score: number;        // 0-25
  maxScore: number;     // Always 25
  signals: EEATSignal[];
  missing: string[];    // What would improve this dimension
}

export interface EEATAuditResult {
  experience: EEATDimension;
  expertise: EEATDimension;
  authority: EEATDimension;
  trust: EEATDimension;
  overallScore: number;  // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  wordCount: number;
  auditedAt: string;
}

export type EEATAssetType = 'author-bio' | 'credential-checklist' | 'schema-template' | 'trust-signal' | 'citation-template';
export type EEATAssetPriority = 'high' | 'medium' | 'low';

export interface EEATAsset {
  type: EEATAssetType;
  title: string;
  content: string;
  priority: EEATAssetPriority;
}

export interface EEATAssetPlan {
  assets: EEATAsset[];
  totalImpact: number;   // Estimated score improvement (0-100)
  quickWins: EEATAsset[];
}
