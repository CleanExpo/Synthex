// Custom Event Tracking for Auto Marketing Platform
// Tracks engagement with AI-generated marketing assets

// ============================================
// 1. PERSONA INTERACTION TRACKING
// ============================================

// Track when users view persona cards
gtag('event', 'persona_view', {
  event_category: 'engagement_persona',
  persona_id: 'persona_001',
  persona_name: 'Sarah Johnson',
  persona_type: 'marketing_manager',
  view_duration: 15, // seconds
  interaction_type: 'hover', // hover, click, expand
  user_segment: currentUser.segment
});

// Track persona selection for campaigns
gtag('event', 'persona_select', {
  event_category: 'conversion_persona',
  persona_id: 'persona_001',
  persona_type: 'marketing_manager',
  campaign_type: 'email',
  selection_context: 'campaign_creation',
  value: 10 // Engagement value
});

// Track persona customization
gtag('event', 'persona_customize', {
  event_category: 'interaction_persona',
  persona_id: 'persona_001',
  customization_type: 'demographics', // demographics, pain_points, goals
  changes_made: 3,
  time_spent: 120 // seconds
});

// ============================================
// 2. HOOK ENGAGEMENT TRACKING
// ============================================

// Track hook performance by style and persona
gtag('event', 'hook_engagement', {
  event_category: 'engagement_hook',
  hook_id: 'hook_h1_001',
  persona_type: 'business_professional',
  hook_style: 'humorous', // humorous, serious, business, playful, meaningful
  engagement_level: 'high', // high, medium, low
  engagement_score: 85, // 0-100
  click_through: true,
  time_to_engage: 2.5, // seconds
  device_type: deviceType,
  test_variant: 'variant_a' // For A/B testing
});

// Track hook selection and usage
gtag('event', 'hook_select', {
  event_category: 'conversion_hook',
  hook_id: 'hook_b3_002',
  hook_style: 'business',
  persona_match: 'enterprise_buyer',
  usage_context: 'landing_page', // landing_page, email, social_media
  confidence_score: 92 // AI confidence in match
});

// Track hook performance in campaigns
gtag('event', 'hook_performance', {
  event_category: 'performance_hook',
  hook_id: 'hook_s2_003',
  campaign_id: 'q1_launch',
  impressions: 5000,
  clicks: 250,
  ctr: 5.0,
  conversions: 25,
  conversion_rate: 10.0,
  revenue_attributed: 2500
});

// Track hook A/B test results
gtag('event', 'hook_test_complete', {
  event_category: 'testing_hook',
  test_id: 'hook_test_001',
  control_hook: 'serious',
  variant_hook: 'humorous',
  winner: 'humorous',
  lift_percentage: 23,
  confidence_level: 97,
  sample_size: 10000
});

// ============================================
// 3. STORYBOARD INTERACTION TRACKING
// ============================================

// Track storyboard viewing and engagement
gtag('event', 'storyboard_view', {
  event_category: 'engagement_storyboard',
  storyboard_id: 'story_office_001',
  scenario_type: 'office', // office, home, adventure, event
  completion_rate: 85, // Percentage viewed
  user_segment: 'returning_visitor',
  scenes_viewed: 5,
  total_scenes: 6,
  interaction_points: ['scene_2_click', 'scene_4_hover'],
  time_spent: 45, // seconds
  device_type: deviceType
});

// Track storyboard scene interactions
gtag('event', 'storyboard_scene_interaction', {
  event_category: 'interaction_storyboard',
  storyboard_id: 'story_adventure_002',
  scene_number: 3,
  interaction_type: 'click', // click, hover, play_animation
  element_interacted: 'character', // character, background, cta
  time_in_scene: 8, // seconds
  engagement_score: 75
});

// Track storyboard customization
gtag('event', 'storyboard_customize', {
  event_category: 'creation_storyboard',
  storyboard_template: 'home_scenario',
  customizations: {
    scenes_modified: 3,
    characters_changed: 2,
    text_updated: true,
    colors_adjusted: true
  },
  time_to_customize: 300, // seconds
  save_action: true
});

// Track storyboard conversion impact
gtag('event', 'storyboard_conversion', {
  event_category: 'conversion_storyboard',
  storyboard_id: 'story_event_003',
  scenario_type: 'event',
  conversion_action: 'signup', // signup, purchase, download
  attribution_weight: 0.3, // Attribution model weight
  value: 50
});

// ============================================
// 4. VISUAL DESIGN ENGAGEMENT
// ============================================

// Track workspace canvas interactions
gtag('event', 'canvas_interaction', {
  event_category: 'workspace_canvas',
  action_type: 'drag_drop', // drag_drop, zoom, pan, select
  elements_moved: 3,
  canvas_zoom_level: 100,
  collaboration_active: true,
  concurrent_users: 2
});

// Track template usage
gtag('event', 'template_use', {
  event_category: 'creation_template',
  template_id: 'social_instagram_001',
  template_category: 'social_media',
  template_subcategory: 'instagram_post',
  customization_level: 'high', // none, low, medium, high
  brand_kit_applied: true,
  export_format: 'png',
  value: 15
});

// Track design system component usage
gtag('event', 'component_use', {
  event_category: 'design_system',
  component_type: 'cta_button', // cta_button, persona_card, testimonial
  component_variant: 'primary',
  placement_context: 'landing_page',
  ab_test_variant: 'control'
});

// ============================================
// 5. COLLABORATION TRACKING
// ============================================

// Track real-time collaboration
gtag('event', 'collaboration_session', {
  event_category: 'collaboration',
  session_id: 'collab_001',
  participants: 3,
  duration: 1800, // seconds
  comments_added: 12,
  edits_made: 45,
  conflicts_resolved: 2,
  productivity_score: 85
});

// Track comment interactions
gtag('event', 'comment_interaction', {
  event_category: 'collaboration_comment',
  action: 'reply', // add, reply, resolve, mention
  thread_length: 5,
  participants_involved: 3,
  time_to_resolution: 300, // seconds
  mention_user: '@john'
});

// ============================================
// 6. AI AGENT USAGE TRACKING
// ============================================

// Track AI agent activation
gtag('event', 'agent_activate', {
  event_category: 'ai_agent',
  agent_type: 'ux_research', // ux_research, content_creator, visual_designer, performance_optimizer
  trigger_type: 'manual', // manual, automatic, workflow
  input_quality_score: 90,
  execution_time: 45, // seconds
  success: true
});

// Track agent output quality
gtag('event', 'agent_output_rating', {
  event_category: 'ai_quality',
  agent_type: 'content_creator',
  output_type: 'hooks',
  quality_rating: 4.5, // 1-5 scale
  usefulness_score: 90, // 0-100
  modifications_needed: 2,
  user_satisfaction: 'satisfied' // very_satisfied, satisfied, neutral, unsatisfied
});

// ============================================
// 7. WORKFLOW COMPLETION TRACKING
// ============================================

// Track complete workflow execution
gtag('event', 'workflow_complete', {
  event_category: 'workflow',
  workflow_id: 'workflow_001',
  total_duration: 10800, // seconds (3 hours)
  phases_completed: 4,
  deliverables_generated: 52,
  quality_score: 92,
  user_interventions: 3,
  value: 500
});

// Track individual phase completion
gtag('event', 'phase_complete', {
  event_category: 'workflow_phase',
  phase_number: 1,
  phase_name: 'ux_research',
  duration: 2700, // seconds
  outputs_generated: ['personas', 'journey_maps', 'market_analysis'],
  quality_score: 88,
  auto_progression: true
});

// ============================================
// 8. PERFORMANCE METRICS TRACKING
// ============================================

// Track dashboard interactions
gtag('event', 'dashboard_interaction', {
  event_category: 'analytics_dashboard',
  widget_interacted: 'conversion_funnel',
  action: 'filter_apply', // filter_apply, date_change, drill_down
  filters_applied: ['persona:marketing_manager', 'device:mobile'],
  time_range: 'last_30_days'
});

// Track optimization recommendations
gtag('event', 'optimization_recommendation', {
  event_category: 'performance_optimization',
  recommendation_type: 'cta_color', // cta_color, headline, layout
  expected_impact: 'high',
  expected_lift: 15, // percentage
  implementation_difficulty: 'easy',
  accepted: true
});

// ============================================
// 9. EXPORT AND SHARING TRACKING
// ============================================

// Track asset exports
gtag('event', 'asset_export', {
  event_category: 'export',
  asset_type: 'complete_campaign', // complete_campaign, individual_asset
  format: 'pdf', // pdf, png, html, json
  include_analytics: true,
  file_size: 2500, // KB
  destination: 'download' // download, email, cloud
});

// Track sharing actions
gtag('event', 'asset_share', {
  event_category: 'sharing',
  share_method: 'link', // link, embed, social
  permissions: 'view_only', // view_only, comment, edit
  expiration: '7_days',
  recipients: 5
});

// ============================================
// 10. ERROR AND ISSUE TRACKING
// ============================================

// Track workflow errors
gtag('event', 'workflow_error', {
  event_category: 'error',
  error_type: 'agent_timeout', // agent_timeout, generation_failed, api_error
  agent_affected: 'visual_designer',
  error_code: 'TIMEOUT_001',
  recovery_action: 'retry',
  impact_severity: 'medium'
});

// Track user feedback
gtag('event', 'user_feedback', {
  event_category: 'feedback',
  feedback_type: 'bug_report', // bug_report, feature_request, improvement
  component_affected: 'drag_drop_system',
  severity: 'low',
  description_length: 150
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Helper function to track engagement scores
function calculateEngagementScore(interactions) {
  const weights = {
    view: 1,
    hover: 2,
    click: 5,
    share: 10,
    convert: 20
  };
  
  let score = 0;
  interactions.forEach(interaction => {
    score += weights[interaction.type] * interaction.count;
  });
  
  return Math.min(100, score);
}

// Helper function to track user journey
function trackUserJourney(stage, context) {
  gtag('event', 'journey_progression', {
    event_category: 'user_journey',
    journey_stage: stage, // awareness, consideration, decision, retention
    previous_stage: context.previousStage,
    time_in_stage: context.timeInStage,
    actions_taken: context.actions,
    next_predicted_stage: context.predictedNext,
    conversion_probability: context.conversionProb
  });
}

// Helper function for batch event tracking
function batchTrackEvents(events) {
  events.forEach(event => {
    gtag('event', event.name, event.parameters);
  });
}

// Enhanced scroll tracking with content awareness
function trackScrollWithContext() {
  const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  const currentSection = getCurrentSection(); // Custom function to determine section
  
  gtag('event', 'intelligent_scroll', {
    event_category: 'engagement_scroll',
    scroll_depth: Math.round(scrollPercentage),
    current_section: currentSection,
    time_on_section: getSectionTime(currentSection),
    content_type: getContentType(currentSection),
    engagement_actions: getEngagementActions(currentSection)
  });
}

// Performance monitoring for AI operations
function trackAIPerformance(operation) {
  const startTime = performance.now();
  
  return function(result) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    gtag('event', 'ai_performance', {
      event_category: 'performance_ai',
      operation: operation,
      duration: duration,
      success: result.success,
      quality_score: result.qualityScore,
      tokens_used: result.tokensUsed,
      cost_estimate: result.costEstimate
    });
    
    return result;
  };
}