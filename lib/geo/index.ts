/**
 * GEO Engine — Generative Engine Optimization
 *
 * Main barrel export for all GEO library modules
 *
 * @module lib/geo
 */

// Core analyzer
export { analyzeGEO } from './geo-analyzer';

// Type definitions
export type {
  GEOAnalysisInput,
  GEOAnalysisResult,
  GEOScore,
  GEOPlatform,
  CitablePassage,
  StructureAnalysis,
  PlatformScore,
  GEORecommendation,
  SchemaIssue,
} from './types';

// Sub-modules (for advanced usage)
export { extractCitablePassages } from './passage-extractor';
export { scoreCitability } from './citability-scorer';
export { analyzeStructure } from './structure-analyzer';
export { optimizeForPlatform } from './platform-optimizer';
export { analyzeSchema, generateSchemaRecommendations } from './schema-enhancer';
export { generateRecommendations } from './recommendations';
