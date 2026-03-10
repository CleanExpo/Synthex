export interface DesignAuditResult {
  designQuality: DesignQualityScore;
  croReadiness: CROReadinessScore;
  llmCitationFitness: LLMCitationFitnessScore;
  overallScore: number; // 0-100 weighted average
  issues: DesignIssue[];
  recommendations: DesignRecommendation[];
}

export interface DesignQualityScore {
  total: number; // 0-100
  headingHierarchy: number; // 0-15
  mobileReadiness: number; // 0-15
  aboveFoldClarity: number; // 0-15
  informationDensity: number; // 0-15
  performance: number; // 0-15
  mediaOptimisation: number; // 0-10
  interstitialPenalty: number; // 0-15 (deductions)
}

export interface CROReadinessScore {
  total: number; // 0-100
  conversionFunnel: number; // 0-20
  trustSignals: number; // 0-20
  frictionReduction: number; // 0-20
  mobileConversion: number; // 0-20
  aboveFoldConversion: number; // 0-20
}

export interface LLMCitationFitnessScore {
  total: number; // 0-100
  claimIsolation: number; // 0-15 (C)
  inlineAttribution: number; // 0-15 (I)
  tableListStructure: number; // 0-15 (T)
  answerQueryAlignment: number; // 0-15 (A)
  boldEntityDefinitions: number; // 0-10 (B)
  logicalHeadingDepth: number; // 0-15 (L)
  entityConsistency: number; // 0-15 (E)
}

export interface DesignIssue {
  type: 'error' | 'warning' | 'info';
  category: 'heading' | 'mobile' | 'performance' | 'cro' | 'citation' | 'media' | 'structure';
  message: string;
  penalty: number; // points deducted
  element?: string;
}

export interface DesignRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
}

export interface PageContent {
  html: string;
  text: string;
  url?: string;
  headings: Array<{ level: number; text: string; position: number }>;
  paragraphs: string[];
  links: Array<{ text: string; href: string; isExternal: boolean }>;
  images: Array<{ src: string; alt: string; width?: number; height?: number }>;
  tables: number;
  lists: number;
  forms: Array<{ fields: number; hasSubmit: boolean }>;
  meta: { title?: string; description?: string; viewport?: string };
}

export interface CoreWebVitals {
  lcp: number; // seconds
  inp: number; // milliseconds
  cls: number; // score
  performanceScore: number; // 0-100
  accessibilityScore: number; // 0-100
}
