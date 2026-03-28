/**
 * Brand Intelligence Integration Types — SYN-490
 *
 * These types define the integration boundary between the Synthex marketing
 * platform (Next.js dashboard) and the brand intelligence pipeline (UNI-1661).
 *
 * RULE: All data exchange between platform and pipeline MUST use these types.
 * Direct imports across the boundary outside of shared/types/ are prohibited.
 *
 * @see INTEGRATION.md for the full data flow diagram and API boundaries.
 */

// ============================================================================
// CLIENT ROSTER — active-clients.json schema
// ============================================================================

export interface SocialProfiles {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
}

export interface ClientRosterEntry {
  client_id: string;
  name: string;
  website: string;
  industry: string;
  social_profiles: SocialProfiles;
  industry_subreddits: string[];
  competitors: string[];
  plan: 'starter' | 'pro' | 'enterprise';
  onboarded_at: string; // ISO date
  last_discovery: string | null; // ISO timestamp
  profile_version: number | null;
  research_priority: number; // 1 = highest
}

export interface ClientRoster {
  clients: ClientRosterEntry[];
}

// ============================================================================
// BRAND PROFILE — brand-profile/active.json schema
// ============================================================================

export interface BrandVoiceAttributes {
  tone: string[];
  personality: string[];
  language_patterns: string[];
  avoid: string[];
}

export interface BrandVisualIdentity {
  primary_colors: string[];
  secondary_colors: string[];
  typography: string[];
  logo_description: string;
}

export interface CompetitorProfile {
  name: string;
  website: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
}

export interface SEOKeyword {
  keyword: string;
  search_volume: number;
  difficulty: number;
  brand_fit_score: number; // 0-100
  current_ranking: number | null;
  opportunity_score: number; // 0-100
}

export interface SEOIntelligence {
  keywords: SEOKeyword[];
  content_gaps: string[];
  competitor_keywords: Record<string, string[]>;
  last_updated: string; // ISO timestamp
}

export interface BrandProfile {
  version: number;
  client_id: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  
  // Core brand identity
  brand_name: string;
  tagline: string;
  mission: string;
  value_proposition: string;
  target_audience: string[];
  
  // Voice and visual
  voice: BrandVoiceAttributes;
  visual_identity: BrandVisualIdentity;
  
  // Competitive landscape
  competitors: CompetitorProfile[];
  market_position: string;
  
  // SEO intelligence (appended by SEO Specialist agent)
  seo_intelligence?: SEOIntelligence;
  
  // Profile quality metadata
  completeness_score: number; // 0-100
  source_coverage: {
    website: boolean;
    social: boolean;
    reviews: boolean;
    reddit: boolean;
    competitors: boolean;
  };
  
  // Drift detection
  drift_from_previous: number; // 0-100 percentage
  drift_details?: string;
}

// ============================================================================
// CONTENT INTELLIGENCE — content/intelligence-{date}.json schema
// ============================================================================

export interface ContentPillar {
  name: string;
  description: string;
  target_audience_segment: string;
  brand_alignment_score: number; // 0-100
  suggested_formats: ('blog' | 'social' | 'video' | 'email' | 'infographic')[];
}

export interface ContentOpportunity {
  title: string;
  description: string;
  pillar: string;
  priority: 'high' | 'medium' | 'low';
  estimated_impact: string;
  seo_keywords: string[];
  suggested_channel: string;
}

export interface ContentCalendarEntry {
  week: number; // 1-4
  day: string; // ISO date
  content_type: string;
  title: string;
  pillar: string;
  channel: string;
  brief: string;
  target_keywords: string[];
  status: 'planned' | 'in_queue' | 'approved' | 'published';
}

export interface ContentIntelligence {
  client_id: string;
  generated_at: string; // ISO timestamp
  pillars: ContentPillar[];
  top_opportunities: ContentOpportunity[];
  calendar: ContentCalendarEntry[];
  voice_brief: {
    dos: string[];
    donts: string[];
    example_phrases: string[];
  };
}

// ============================================================================
// HEALTH SCORES — health/health-score-log.json schema
// ============================================================================

export interface HealthScoreEntry {
  timestamp: string; // ISO timestamp
  client_id: string;
  overall_score: number; // 0-100
  components: {
    profile_freshness: number; // 0-100
    content_pipeline_health: number; // 0-100
    voice_consistency: number; // 0-100
    seo_performance: number; // 0-100
    source_coverage: number; // 0-100
  };
  alerts: HealthAlert[];
}

export interface HealthAlert {
  severity: 'info' | 'warning' | 'critical';
  category: 'drift' | 'stale_data' | 'quality' | 'pipeline_error' | 'cost';
  message: string;
  recommended_action: string;
}

export interface HealthScoreLog {
  client_id: string;
  entries: HealthScoreEntry[];
}

// ============================================================================
// COMPLIANCE / CONTENT QUEUE
// ============================================================================

export interface ContentQueueItem {
  id: string;
  client_id: string;
  content_type: string;
  title: string;
  body: string;
  channel: string;
  created_at: string; // ISO timestamp
  voice_score: number | null; // 0-100, null = not yet scored
  status: 'queued' | 'scoring' | 'approved' | 'needs_review' | 'rejected';
  corrections?: string[];
  reviewer_notes?: string;
}

// ============================================================================
// PIPELINE RUN METRICS — logs/platform-summary-{run_id}.json
// ============================================================================

export interface AgentRunMetrics {
  agent_name: string;
  model: string;
  client_id: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  error_state: 'success' | 'partial_failure' | 'failure';
  error_message?: string;
}

export interface PipelineRunSummary {
  run_id: string;
  mode: 'full' | 'discovery' | 'enforce' | 'refresh' | 'onboarding';
  started_at: string; // ISO timestamp
  completed_at: string; // ISO timestamp
  total_duration_ms: number;
  clients_processed: number;
  clients_failed: number;
  agent_runs: AgentRunMetrics[];
  cost_summary: {
    total_usd: number;
    per_client: Record<string, number>;
    per_agent: Record<string, number>;
    budget_remaining_usd: number;
  };
  drift_events: {
    client_id: string;
    drift_percentage: number;
    action_taken: 'auto_update' | 'notify_client' | 'board_review';
  }[];
}

// ============================================================================
// ADMIN DASHBOARD STATE — platform/admin-dashboard-state.json
// ============================================================================

export interface AdminDashboardState {
  last_updated: string; // ISO timestamp
  total_clients: number;
  active_clients: number;
  last_run: {
    run_id: string;
    mode: string;
    status: 'success' | 'partial_failure' | 'failure';
    timestamp: string;
    total_cost_usd: number;
  } | null;
  client_health_overview: {
    client_id: string;
    client_name: string;
    health_score: number;
    profile_version: number;
    last_discovery: string;
    pending_content: number;
    active_alerts: number;
  }[];
  cost_30d: {
    total_usd: number;
    daily_average_usd: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}
