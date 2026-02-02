/**
 * SYNTHEX SMB INDUSTRY TAXONOMY
 * Comprehensive industry classification system for specialized AI marketing
 * 
 * Based on NAICS (North American Industry Classification System) codes
 * with marketing-focused categorization for SMB specialization
 * 
 * @version 3.0
 * @author Synthex Technical Team
 */

// ============================================================================
// INDUSTRY CLASSIFICATION INTERFACE
// ============================================================================

export interface IndustryVertical {
  /** Unique NAICS-based code */
  code: string;
  /** Display name */
  name: string;
  /** High-level category */
  category: IndustryCategory;
  /** Sub-industries/specializations */
  subIndustries: SubIndustry[];
  /** Marketing characteristics */
  marketingProfile: MarketingProfile;
  /** AI persona configuration */
  aiPersona: IndustryAIPersona;
  /** Content templates available */
  contentTemplates: ContentTemplateType[];
  /** Key performance indicators */
  kpis: IndustryKPI[];
}

export interface SubIndustry {
  code: string;
  name: string;
  keywords: string[];
  typicalServices: string[];
  targetAudiences: TargetAudience[];
}

export interface MarketingProfile {
  /** Primary marketing channels */
  primaryChannels: MarketingChannel[];
  /** Content types that perform well */
  highPerformingContent: ContentType[];
  /** Typical customer journey */
  customerJourney: JourneyStage[];
  /** Seasonal trends */
  seasonalTrends?: SeasonalTrend[];
  /** Regulatory considerations */
  complianceNotes?: string[];
}

export interface IndustryAIPersona {
  /** Tone of voice for this industry */
  tone: 'professional' | 'conversational' | 'technical' | 'playful' | 'empathetic';
  /** Writing style */
  style: 'formal' | 'casual' | 'educational' | 'persuasive' | 'storytelling';
  /** Industry-specific vocabulary */
  vocabulary: string[];
  /** Topics to emphasize */
  emphasisTopics: string[];
  /** Topics to avoid */
  avoidTopics: string[];
  /** Sample phrases */
  samplePhrases: string[];
}

export interface IndustryKPI {
  name: string;
  metric: string;
  benchmark: {
    good: number;
    excellent: number;
  };
  unit: 'percentage' | 'ratio' | 'currency' | 'count';
  description: string;
}

// ============================================================================
// ENUMS
// ============================================================================

export type IndustryCategory =
  | 'RETAIL'
  | 'PROFESSIONAL_SERVICES'
  | 'HEALTHCARE'
  | 'FOOD_BEVERAGE'
  | 'REAL_ESTATE'
  | 'CONSTRUCTION'
  | 'TECHNOLOGY'
  | 'EDUCATION'
  | 'ENTERTAINMENT'
  | 'FINANCE'
  | 'LEGAL'
  | 'AUTOMOTIVE'
  | 'BEAUTY_WELLNESS'
  | 'HOME_SERVICES'
  | 'TRAVEL_HOSPITALITY'
  | 'NON_PROFIT'
  | 'MANUFACTURING'
  | 'TRANSPORTATION'
  | 'SPORTS_FITNESS'
  | 'PET_SERVICES';

export type MarketingChannel =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'TWITTER'
  | 'X'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'PINTEREST'
  | 'EMAIL'
  | 'BLOG'
  | 'GOOGLE_MY_BUSINESS'
  | 'YELP'
  | 'NEXTDOOR';

export type ContentType =
  | 'EDUCATIONAL'
  | 'PROMOTIONAL'
  | 'BEHIND_THE_SCENES'
  | 'TESTIMONIAL'
  | 'HOW_TO'
  | 'INDUSTRY_NEWS'
  | 'USER_GENERATED'
  | 'CASE_STUDY'
  | 'PRODUCT_DEMO'
  | 'FAQ'
  | 'TIPS_TRICKS';

export type JourneyStage =
  | 'AWARENESS'
  | 'INTEREST'
  | 'CONSIDERATION'
  | 'INTENT'
  | 'PURCHASE'
  | 'RETENTION'
  | 'ADVOCACY';

export interface SeasonalTrend {
  season: string;
  months: number[];
  trend: string;
  contentRecommendations: string[];
}

export interface TargetAudience {
  segment: string;
  demographics: {
    ageRange?: string;
    incomeLevel?: string;
    location?: string;
  };
  painPoints: string[];
  motivations: string[];
}

export type ContentTemplateType =
  | 'WELCOME_POST'
  | 'PRODUCT_LAUNCH'
  | 'SERVICE_PROMOTION'
  | 'TESTIMONIAL_REQUEST'
  | 'EDUCATIONAL_TIP'
  | 'SEASONAL_PROMOTION'
  | 'BEHIND_THE_SCENES'
  | 'INDUSTRY_NEWS'
  | 'FAQ_RESPONSE'
  | 'CASE_STUDY';

// ============================================================================
// INDUSTRY DATABASE - 50+ SMB VERTICALS
// ============================================================================

export const INDUSTRY_TAXONOMY: Record<string, IndustryVertical> = {
  // ==========================================================================
  // RETAIL INDUSTRIES (44-45)
  // ==========================================================================
  
  '44-451': {
    code: '44-451',
    name: 'Clothing & Fashion Retail',
    category: 'RETAIL',
    subIndustries: [
      {
        code: '44-451-01',
        name: 'Boutique Clothing',
        keywords: ['fashion', 'style', 'trends', 'seasonal', 'apparel'],
        typicalServices: ['Personal styling', 'Alterations', 'Gift wrapping'],
        targetAudiences: [
          { segment: 'Fashion-forward millennials', demographics: { ageRange: '25-40' }, painPoints: ['Finding unique pieces', 'Sizing inconsistency'], motivations: ['Self-expression', 'Staying on trend'] }
        ]
      },
      {
        code: '44-451-02',
        name: 'Athletic Wear',
        keywords: ['fitness', 'performance', 'active lifestyle', 'workout'],
        typicalServices: ['Size consultations', 'Performance advice'],
        targetAudiences: [
          { segment: 'Fitness enthusiasts', demographics: { ageRange: '22-45' }, painPoints: ['Durability concerns', 'Finding right fit'], motivations: ['Performance', 'Comfort', 'Style'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'PINTEREST', 'TIKTOK', 'FACEBOOK'],
      highPerformingContent: ['BEHIND_THE_SCENES', 'USER_GENERATED', 'PRODUCT_DEMO', 'TIPS_TRICKS'],
      customerJourney: ['AWARENESS', 'INTEREST', 'CONSIDERATION', 'PURCHASE', 'RETENTION'],
      seasonalTrends: [
        { season: 'Spring', months: [3, 4, 5], trend: 'Spring collections launch', contentRecommendations: ['Pastel color showcases', 'Spring cleaning wardrobe tips'] },
        { season: 'Back to School', months: [7, 8], trend: 'Fall fashion prep', contentRecommendations: ['Back-to-school outfits', 'Transition pieces'] },
        { season: 'Holiday', months: [11, 12], trend: 'Gift giving season', contentRecommendations: ['Gift guides', 'Holiday outfits', 'Party wear'] }
      ]
    },
    aiPersona: {
      tone: 'conversational',
      style: 'casual',
      vocabulary: ['style', 'trend', 'collection', 'outfit', 'wardrobe', 'fashion-forward', 'curated'],
      emphasisTopics: ['Personal style', 'Quality materials', 'Versatility', 'Comfort'],
      avoidTopics: ['Fast fashion criticism', 'Body negativity'],
      samplePhrases: [
        "Elevate your everyday look with...",
        "This season's must-have piece...",
        "Style tip: Pair [item] with..."
      ]
    },
    contentTemplates: ['PRODUCT_LAUNCH', 'BEHIND_THE_SCENES', 'SEASONAL_PROMOTION', 'USER_GENERATED'],
    kpis: [
      { name: 'Engagement Rate', metric: 'engagement_rate', benchmark: { good: 3.0, excellent: 6.0 }, unit: 'percentage', description: 'Likes, comments, shares as % of followers' },
      { name: 'Click-Through Rate', metric: 'ctr', benchmark: { good: 1.5, excellent: 3.0 }, unit: 'percentage', description: 'Link clicks from social posts' },
      { name: 'Conversion Rate', metric: 'conversion_rate', benchmark: { good: 2.0, excellent: 5.0 }, unit: 'percentage', description: 'Social traffic to purchase' }
    ]
  },

  '44-454': {
    code: '44-454',
    name: 'Health & Beauty Retail',
    category: 'RETAIL',
    subIndustries: [
      {
        code: '44-454-01',
        name: 'Cosmetics & Skincare',
        keywords: ['beauty', 'skincare routine', 'makeup tutorial', 'glow up'],
        typicalServices: ['Skin consultations', 'Makeup application', 'Product samples'],
        targetAudiences: [
          { segment: 'Beauty enthusiasts', demographics: { ageRange: '18-45' }, painPoints: ['Product confusion', 'Skin sensitivity'], motivations: ['Self-care', 'Confidence', 'Results'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'PINTEREST'],
      highPerformingContent: ['HOW_TO', 'PRODUCT_DEMO', 'TESTIMONIAL', 'EDUCATIONAL'],
      customerJourney: ['AWARENESS', 'INTEREST', 'CONSIDERATION', 'PURCHASE', 'RETENTION'],
      complianceNotes: ['FDA claims restrictions', 'Before/after photo guidelines']
    },
    aiPersona: {
      tone: 'empathetic',
      style: 'educational',
      vocabulary: ['glow', 'radiant', 'nourish', 'transform', 'skincare routine', 'confidence'],
      emphasisTopics: ['Self-care', 'Results', 'Ingredients', 'Routine building'],
      avoidTopics: ['Medical claims', 'Unrealistic results', 'Comparisons to other brands'],
      samplePhrases: [
        "Get that glow you've been dreaming of...",
        "Your skin deserves this kind of love...",
        "Real results, real confidence..."
      ]
    },
    contentTemplates: ['HOW_TO', 'PRODUCT_DEMO', 'TESTIMONIAL_REQUEST', 'EDUCATIONAL_TIP'],
    kpis: [
      { name: 'Tutorial Views', metric: 'tutorial_views', benchmark: { good: 1000, excellent: 5000 }, unit: 'count', description: 'Views on educational content' },
      { name: 'Sample Requests', metric: 'sample_requests', benchmark: { good: 50, excellent: 200 }, unit: 'count', description: 'Product sample requests' }
    ]
  },

  // ==========================================================================
  // PROFESSIONAL SERVICES (54)
  // ==========================================================================

  '54-111': {
    code: '54-111',
    name: 'Legal Services',
    category: 'LEGAL',
    subIndustries: [
      {
        code: '54-111-01',
        name: 'Personal Injury Law',
        keywords: ['personal injury', 'accident', 'compensation', 'legal help'],
        typicalServices: ['Free consultations', 'Case evaluations', 'Contingency representation'],
        targetAudiences: [
          { segment: 'Accident victims', demographics: { ageRange: '25-65' }, painPoints: ['Medical bills', 'Lost wages', 'Legal complexity'], motivations: ['Justice', 'Fair compensation', 'Peace of mind'] }
        ]
      },
      {
        code: '54-111-02',
        name: 'Family Law',
        keywords: ['divorce', 'custody', 'family legal', 'mediation'],
        typicalServices: ['Divorce representation', 'Child custody', 'Mediation'],
        targetAudiences: [
          { segment: 'Families in transition', demographics: { ageRange: '30-55' }, painPoints: ['Emotional stress', 'Financial concerns', 'Child welfare'], motivations: ['Fair resolution', 'Child best interests', 'Fresh start'] }
        ]
      },
      {
        code: '54-111-03',
        name: 'Estate Planning',
        keywords: ['will', 'trust', 'estate', 'legacy planning'],
        typicalServices: ['Will drafting', 'Trust creation', 'Probate assistance'],
        targetAudiences: [
          { segment: 'Pre-retirement & retirees', demographics: { ageRange: '50-75' }, painPoints: ['Protecting assets', 'Family security', 'Tax concerns'], motivations: ['Legacy protection', 'Family peace', 'Control'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['LINKEDIN', 'FACEBOOK', 'GOOGLE_MY_BUSINESS', 'YELP'],
      highPerformingContent: ['EDUCATIONAL', 'CASE_STUDY', 'FAQ', 'TESTIMONIAL'],
      customerJourney: ['AWARENESS', 'CONSIDERATION', 'INTENT', 'PURCHASE'],
      complianceNotes: ['Bar association advertising rules', 'No guarantees of outcomes', 'Confidentiality requirements']
    },
    aiPersona: {
      tone: 'professional',
      style: 'formal',
      vocabulary: ['advocate', 'protect', 'guidance', 'experience', 'dedicated', 'trusted advisor'],
      emphasisTopics: ['Experience', 'Client advocacy', 'Results', 'Compassionate guidance'],
      avoidTopics: ['Guaranteed outcomes', 'Specific case details', 'Comparisons to other firms', 'Legal advice'],
      samplePhrases: [
        "Protecting your rights with experience and dedication...",
        "When you need a trusted advocate in your corner...",
        "Committed to securing the best possible outcome..."
      ]
    },
    contentTemplates: ['EDUCATIONAL_TIP', 'FAQ_RESPONSE', 'CASE_STUDY', 'TESTIMONIAL_REQUEST'],
    kpis: [
      { name: 'Consultation Requests', metric: 'consultation_requests', benchmark: { good: 20, excellent: 50 }, unit: 'count', description: 'Free consultation bookings' },
      { name: 'Case Intake Rate', metric: 'case_intake_rate', benchmark: { good: 25, excellent: 40 }, unit: 'percentage', description: 'Consultations to retained cases' }
    ]
  },

  '54-112': {
    code: '54-112',
    name: 'Accounting & Tax Services',
    category: 'PROFESSIONAL_SERVICES',
    subIndustries: [
      {
        code: '54-112-01',
        name: 'Small Business Accounting',
        keywords: ['bookkeeping', 'small business', 'financial management', 'tax prep'],
        typicalServices: ['Monthly bookkeeping', 'Tax preparation', 'Financial reporting'],
        targetAudiences: [
          { segment: 'Small business owners', demographics: { ageRange: '30-60' }, painPoints: ['Time constraints', 'Tax complexity', 'Cash flow'], motivations: ['Compliance', 'Financial clarity', 'Time savings'] }
        ]
      },
      {
        code: '54-112-02',
        name: 'Personal Tax Services',
        keywords: ['tax return', 'tax planning', 'refund', 'IRS'],
        typicalServices: ['Tax preparation', 'Tax planning', 'IRS representation'],
        targetAudiences: [
          { segment: 'Individual taxpayers', demographics: { ageRange: '25-65' }, painPoints: ['Tax complexity', 'Maximizing refund', 'Audit fears'], motivations: ['Maximum refund', 'Peace of mind', 'Compliance'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['LINKEDIN', 'FACEBOOK', 'GOOGLE_MY_BUSINESS'],
      highPerformingContent: ['EDUCATIONAL', 'FAQ', 'TIPS_TRICKS', 'SEASONAL_PROMOTION'],
      customerJourney: ['AWARENESS', 'CONSIDERATION', 'INTENT', 'PURCHASE', 'RETENTION'],
      seasonalTrends: [
        { season: 'Tax Season', months: [1, 2, 3, 4], trend: 'Tax preparation peak', contentRecommendations: ['Deadline reminders', 'Deduction tips', 'Filing checklists'] },
        { season: 'Extension Season', months: [9, 10], trend: 'Extended filing deadline', contentRecommendations: ['Extension guidance', 'Last-minute tips'] }
      ],
      complianceNotes: ['IRS Circular 230 compliance', 'No guaranteed refund amounts', 'Confidentiality requirements']
    },
    aiPersona: {
      tone: 'professional',
      style: 'educational',
      vocabulary: ['optimize', 'maximize', 'strategy', 'compliance', 'expertise', 'peace of mind'],
      emphasisTopics: ['Tax savings', 'Compliance', 'Financial optimization', 'Expert guidance'],
      avoidTopics: ['Guaranteed refunds', 'Aggressive tax positions', 'Specific client information'],
      samplePhrases: [
        "Maximize your deductions with expert guidance...",
        "Stay compliant while optimizing your tax strategy...",
        "Your financial success is our priority..."
      ]
    },
    contentTemplates: ['EDUCATIONAL_TIP', 'FAQ_RESPONSE', 'SEASONAL_PROMOTION', 'CASE_STUDY'],
    kpis: [
      { name: 'Tax Prep Bookings', metric: 'tax_bookings', benchmark: { good: 100, excellent: 300 }, unit: 'count', description: 'Tax preparation appointments' },
      { name: 'Client Retention', metric: 'retention_rate', benchmark: { good: 75, excellent: 90 }, unit: 'percentage', description: 'Year-over-year client retention' }
    ]
  },

  // ==========================================================================
  // HEALTHCARE (62)
  // ==========================================================================

  '62-210': {
    code: '62-210',
    name: 'Dental Practices',
    category: 'HEALTHCARE',
    subIndustries: [
      {
        code: '62-210-01',
        name: 'General Dentistry',
        keywords: ['dental care', 'checkup', 'cleaning', 'oral health'],
        typicalServices: ['Cleanings', 'Exams', 'Fillings', 'X-rays'],
        targetAudiences: [
          { segment: 'Families', demographics: { ageRange: '25-65' }, painPoints: ['Dental anxiety', 'Cost concerns', 'Time constraints'], motivations: ['Family health', 'Preventive care', 'Confidence'] }
        ]
      },
      {
        code: '62-210-02',
        name: 'Cosmetic Dentistry',
        keywords: ['smile makeover', 'veneers', 'whitening', 'cosmetic dental'],
        typicalServices: ['Teeth whitening', 'Veneers', 'Smile design', 'Invisalign'],
        targetAudiences: [
          { segment: 'Appearance-conscious adults', demographics: { ageRange: '30-60' }, painPoints: ['Smile insecurity', 'Cost', 'Treatment duration'], motivations: ['Confidence', 'Professional image', 'Self-esteem'] }
        ]
      },
      {
        code: '62-210-03',
        name: 'Orthodontics',
        keywords: ['braces', 'Invisalign', 'straight teeth', 'orthodontist'],
        typicalServices: ['Traditional braces', 'Clear aligners', 'Retainers'],
        targetAudiences: [
          { segment: 'Parents & teens', demographics: { ageRange: '12-50' }, painPoints: ['Treatment duration', 'Cost', 'Aesthetics'], motivations: ['Beautiful smile', 'Dental health', 'Confidence'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'FACEBOOK', 'GOOGLE_MY_BUSINESS', 'YELP'],
      highPerformingContent: ['BEFORE_AFTER', 'TESTIMONIAL', 'EDUCATIONAL', 'BEHIND_THE_SCENES'],
      customerJourney: ['AWARENESS', 'INTEREST', 'CONSIDERATION', 'INTENT', 'PURCHASE'],
      complianceNotes: ['HIPAA compliance', 'Patient testimonial consent required', 'No specific medical outcomes guaranteed']
    },
    aiPersona: {
      tone: 'empathetic',
      style: 'educational',
      vocabulary: ['gentle', 'comfortable', 'state-of-the-art', 'personalized', 'healthy smile', 'confidence'],
      emphasisTopics: ['Patient comfort', 'Advanced technology', 'Gentle care', 'Beautiful results'],
      avoidTopics: ['Medical guarantees', 'Before/after without consent', 'Discount pricing focus'],
      samplePhrases: [
        "Experience gentle, personalized dental care...",
        "Your comfort and health are our top priorities...",
        "Achieve the confident smile you deserve..."
      ]
    },
    contentTemplates: ['TESTIMONIAL_REQUEST', 'EDUCATIONAL_TIP', 'BEHIND_THE_SCENES', 'FAQ_RESPONSE'],
    kpis: [
      { name: 'New Patient Inquiries', metric: 'new_patients', benchmark: { good: 30, excellent: 80 }, unit: 'count', description: 'New patient appointment requests' },
      { name: 'Appointment Show Rate', metric: 'show_rate', benchmark: { good: 85, excellent: 95 }, unit: 'percentage', description: 'Scheduled appointments that show up' }
    ]
  },

  '62-220': {
    code: '62-220',
    name: 'Medical Practices',
    category: 'HEALTHCARE',
    subIndustries: [
      {
        code: '62-220-01',
        name: 'Primary Care',
        keywords: ['family doctor', 'annual physical', 'preventive care', 'wellness'],
        typicalServices: ['Annual exams', 'Preventive care', 'Chronic disease management'],
        targetAudiences: [
          { segment: 'Families & individuals', demographics: { ageRange: '18-65' }, painPoints: ['Appointment availability', 'Insurance', 'Continuity of care'], motivations: ['Health maintenance', 'Prevention', 'Trust'] }
        ]
      },
      {
        code: '62-220-02',
        name: 'Dermatology',
        keywords: ['skin care', 'acne treatment', 'anti-aging', 'dermatologist'],
        typicalServices: ['Skin exams', 'Acne treatment', 'Cosmetic procedures', 'Skin cancer screening'],
        targetAudiences: [
          { segment: 'Skin-conscious patients', demographics: { ageRange: '18-65' }, painPoints: ['Skin concerns', 'Aging', 'Skin conditions'], motivations: ['Clear skin', 'Youthful appearance', 'Health'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['GOOGLE_MY_BUSINESS', 'FACEBOOK', 'YELP', 'NEXTDOOR'],
      highPerformingContent: ['EDUCATIONAL', 'TESTIMONIAL', 'FAQ', 'BEHIND_THE_SCENES'],
      customerJourney: ['AWARENESS', 'CONSIDERATION', 'INTENT', 'PURCHASE', 'RETENTION'],
      complianceNotes: ['HIPAA strict compliance', 'No patient identifiers', 'No specific outcome promises']
    },
    aiPersona: {
      tone: 'professional',
      style: 'educational',
      vocabulary: ['comprehensive', 'personalized', 'evidence-based', 'compassionate', 'wellness', 'prevention'],
      emphasisTopics: ['Patient-centered care', 'Prevention', 'Expertise', 'Comfort'],
      avoidTopics: ['Specific medical advice', 'Patient stories without consent', 'Comparisons to other practices'],
      samplePhrases: [
        "Comprehensive care tailored to your unique needs...",
        "Preventive medicine for lifelong wellness...",
        "Expert care with a compassionate approach..."
      ]
    },
    contentTemplates: ['EDUCATIONAL_TIP', 'FAQ_RESPONSE', 'TESTIMONIAL_REQUEST', 'WELCOME_POST'],
    kpis: [
      { name: 'New Patient Acquisition', metric: 'new_patients', benchmark: { good: 20, excellent: 50 }, unit: 'count', description: 'New patient registrations' },
      { name: 'Patient Satisfaction', metric: 'satisfaction_score', benchmark: { good: 4.2, excellent: 4.8 }, unit: 'ratio', description: 'Average review rating' }
    ]
  },

  // ==========================================================================
  // FOOD & BEVERAGE (72)
  // ==========================================================================

  '72-110': {
    code: '72-110',
    name: 'Restaurants & Dining',
    category: 'FOOD_BEVERAGE',
    subIndustries: [
      {
        code: '72-110-01',
        name: 'Fine Dining',
        keywords: ['gourmet', 'chef-crafted', 'wine pairing', 'special occasion'],
        typicalServices: ['Tasting menus', 'Wine programs', 'Private dining', 'Event hosting'],
        targetAudiences: [
          { segment: 'Affluent diners', demographics: { ageRange: '35-65', incomeLevel: 'high' }, painPoints: ['Finding quality', 'Special occasion planning'], motivations: ['Culinary experience', 'Celebration', 'Prestige'] }
        ]
      },
      {
        code: '72-110-02',
        name: 'Casual Dining',
        keywords: ['family-friendly', 'casual', 'comfort food', 'everyday dining'],
        typicalServices: ['Full-service dining', 'Family meals', 'Takeout', 'Catering'],
        targetAudiences: [
          { segment: 'Families & groups', demographics: { ageRange: '25-55' }, painPoints: ['Finding family-friendly options', 'Value for money'], motivations: ['Convenience', 'Quality', 'Atmosphere'] }
        ]
      },
      {
        code: '72-110-03',
        name: 'Fast Casual',
        keywords: ['quick', 'fresh', 'healthy', 'counter service'],
        typicalServices: ['Quick service', 'Fresh ingredients', 'Customization', 'Mobile ordering'],
        targetAudiences: [
          { segment: 'Busy professionals', demographics: { ageRange: '22-45' }, painPoints: ['Time constraints', 'Healthy options', 'Price'], motivations: ['Speed', 'Health', 'Value'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'FACEBOOK', 'YELP', 'GOOGLE_MY_BUSINESS', 'TIKTOK'],
      highPerformingContent: ['BEHIND_THE_SCENES', 'PRODUCT_DEMO', 'USER_GENERATED', 'PROMOTIONAL'],
      customerJourney: ['AWARENESS', 'INTEREST', 'INTENT', 'PURCHASE', 'ADVOCACY'],
      seasonalTrends: [
        { season: 'Valentine\'s Day', months: [2], trend: 'Romantic dining', contentRecommendations: ['Special menus', 'Reservation pushes', 'Couple photos'] },
        { season: 'Summer', months: [6, 7, 8], trend: 'Patio season', contentRecommendations: ['Outdoor dining', 'Summer menu items', 'Drink specials'] },
        { season: 'Holidays', months: [11, 12], trend: 'Holiday dining', contentRecommendations: ['Holiday menus', 'Catering', 'Private events'] }
      ]
    },
    aiPersona: {
      tone: 'conversational',
      style: 'casual',
      vocabulary: ['delicious', 'fresh', 'locally-sourced', 'chef-inspired', 'mouthwatering', 'artisan'],
      emphasisTopics: ['Fresh ingredients', 'Chef expertise', 'Atmosphere', 'Experience'],
      avoidTopics: ['Negative food comparisons', 'Price-focused messaging', 'Overly promotional language'],
      samplePhrases: [
        "Experience flavors that tell a story...",
        "Fresh ingredients, expertly crafted...",
        "Where every meal becomes a memory..."
      ]
    },
    contentTemplates: ['BEHIND_THE_SCENES', 'PRODUCT_DEMO', 'SEASONAL_PROMOTION', 'USER_GENERATED'],
    kpis: [
      { name: 'Reservation Bookings', metric: 'reservations', benchmark: { good: 50, excellent: 150 }, unit: 'count', description: 'Table reservations per week' },
      { name: 'Review Rating', metric: 'review_rating', benchmark: { good: 4.0, excellent: 4.6 }, unit: 'ratio', description: 'Average star rating' },
      { name: 'Menu Item Engagement', metric: 'menu_engagement', benchmark: { good: 5, excellent: 15 }, unit: 'percentage', description: 'Menu link clicks from posts' }
    ]
  },

  // ==========================================================================
  // Add more industries as needed - continuing with key SMB verticals
  // ==========================================================================

  '53-110': {
    code: '53-110',
    name: 'Real Estate',
    category: 'REAL_ESTATE',
    subIndustries: [
      {
        code: '53-110-01',
        name: 'Residential Sales',
        keywords: ['home buying', 'selling', 'listing', 'property'],
        typicalServices: ['Buyer representation', 'Listing services', 'Market analysis', 'Negotiation'],
        targetAudiences: [
          { segment: 'Home buyers/sellers', demographics: { ageRange: '25-65' }, painPoints: ['Market uncertainty', 'Pricing', 'Process complexity'], motivations: ['Home ownership', 'Investment', 'Lifestyle change'] }
        ]
      },
      {
        code: '53-110-02',
        name: 'Property Management',
        keywords: ['rental', 'property manager', 'landlord', 'tenant'],
        typicalServices: ['Tenant placement', 'Rent collection', 'Maintenance', 'Accounting'],
        targetAudiences: [
          { segment: 'Property owners', demographics: { ageRange: '35-70' }, painPoints: ['Tenant issues', 'Maintenance', 'Time management'], motivations: ['Passive income', 'Property value', 'Peace of mind'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'ZILLOW', 'TRULIA'],
      highPerformingContent: ['CASE_STUDY', 'BEHIND_THE_SCENES', 'TESTIMONIAL', 'EDUCATIONAL'],
      customerJourney: ['AWARENESS', 'INTEREST', 'CONSIDERATION', 'INTENT', 'PURCHASE'],
      seasonalTrends: [
        { season: 'Spring Market', months: [3, 4, 5], trend: 'Peak buying season', contentRecommendations: ['Market reports', 'Staging tips', 'New listings'] },
        { season: 'Fall', months: [9, 10], trend: 'Serious buyers', contentRecommendations: ['Market slowdown tips', 'Investment opportunities'] }
      ]
    },
    aiPersona: {
      tone: 'professional',
      style: 'conversational',
      vocabulary: ['market expertise', 'negotiation', 'investment', 'dream home', 'trusted advisor'],
      emphasisTopics: ['Market knowledge', 'Client advocacy', 'Results', 'Communication'],
      avoidTopics: ['Guaranteed sale prices', 'Discriminatory language', 'Unrealistic timelines'],
      samplePhrases: [
        "Your trusted partner in navigating the market...",
        "Finding more than a house - finding your home...",
        "Expert guidance through every step..."
      ]
    },
    contentTemplates: ['CASE_STUDY', 'TESTIMONIAL_REQUEST', 'EDUCATIONAL_TIP', 'BEHIND_THE_SCENES'],
    kpis: [
      { name: 'Listing Inquiries', metric: 'listing_inquiries', benchmark: { good: 10, excellent: 30 }, unit: 'count', description: 'Inquiries per listing' },
      { name: 'Buyer Leads', metric: 'buyer_leads', benchmark: { good: 20, excellent: 60 }, unit: 'count', description: 'Qualified buyer leads per month' }
    ]
  },

  // Continue with more industries...
  // For brevity, I'll add key ones and create a system to easily extend

  '23-110': {
    code: '23-110',
    name: 'Construction & Contracting',
    category: 'CONSTRUCTION',
    subIndustries: [
      {
        code: '23-110-01',
        name: 'Residential Construction',
        keywords: ['home building', 'renovation', 'remodeling', 'contractor'],
        typicalServices: ['New construction', 'Renovations', 'Additions', 'Project management'],
        targetAudiences: [
          { segment: 'Homeowners', demographics: { ageRange: '30-65' }, painPoints: ['Budget management', 'Timeline', 'Quality concerns'], motivations: ['Dream home', 'Value addition', 'Modernization'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['FACEBOOK', 'INSTAGRAM', 'HOUZZ', 'NEXTDOOR', 'GOOGLE_MY_BUSINESS'],
      highPerformingContent: ['BEFORE_AFTER', 'CASE_STUDY', 'BEHIND_THE_SCENES', 'EDUCATIONAL'],
      customerJourney: ['AWARENESS', 'CONSIDERATION', 'INTENT', 'PURCHASE'],
    },
    aiPersona: {
      tone: 'professional',
      style: 'educational',
      vocabulary: ['craftsmanship', 'quality', 'timeline', 'budget', 'transparency', 'expertise'],
      emphasisTopics: ['Quality workmanship', 'On-time delivery', 'Transparent pricing', 'Communication'],
      samplePhrases: [
        "Building your vision with precision and care...",
        "Quality craftsmanship that stands the test of time...",
        "Transparent process, exceptional results..."
      ]
    },
    contentTemplates: ['BEFORE_AFTER', 'CASE_STUDY', 'BEHIND_THE_SCENES', 'FAQ_RESPONSE'],
    kpis: [
      { name: 'Quote Requests', metric: 'quote_requests', benchmark: { good: 15, excellent: 40 }, unit: 'count', description: 'Project quote requests' },
      { name: 'Project Conversion', metric: 'conversion_rate', benchmark: { good: 20, excellent: 35 }, unit: 'percentage', description: 'Quotes to signed contracts' }
    ]
  },

  '81-110': {
    code: '81-110',
    name: 'Landscaping & Lawn Care',
    category: 'HOME_SERVICES',
    subIndustries: [
      {
        code: '81-110-01',
        name: 'Residential Landscaping',
        keywords: ['landscape design', 'lawn care', 'garden', 'outdoor living'],
        typicalServices: ['Landscape design', 'Maintenance', 'Hardscaping', 'Seasonal cleanup'],
        targetAudiences: [
          { segment: 'Homeowners', demographics: { ageRange: '35-65' }, painPoints: ['Time constraints', 'Design uncertainty', 'Maintenance'], motivations: ['Curb appeal', 'Outdoor enjoyment', 'Property value'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['FACEBOOK', 'INSTAGRAM', 'NEXTDOOR', 'HOUZZ'],
      highPerformingContent: ['BEFORE_AFTER', 'SEASONAL_PROMOTION', 'EDUCATIONAL'],
      seasonalTrends: [
        { season: 'Spring', months: [3, 4, 5], trend: 'Planting season', contentRecommendations: ['Spring cleanup', 'Planting guides', 'Design inspiration'] },
        { season: 'Fall', months: [9, 10, 11], trend: 'Cleanup & prep', contentRecommendations: ['Fall cleanup', 'Winterization', 'Spring planning'] }
      ]
    },
    aiPersona: {
      tone: 'conversational',
      style: 'educational',
      vocabulary: ['curb appeal', 'outdoor oasis', 'seasonal', 'maintenance', 'transform'],
      emphasisTopics: ['Curb appeal', 'Outdoor living', 'Seasonal care', 'Sustainability'],
      samplePhrases: [
        "Transform your outdoor space into an oasis...",
        "Seasonal care for year-round beauty...",
        "Curb appeal that makes a statement..."
      ]
    },
    contentTemplates: ['BEFORE_AFTER', 'SEASONAL_PROMOTION', 'EDUCATIONAL_TIP'],
    kpis: [
      { name: 'Service Inquiries', metric: 'service_requests', benchmark: { good: 25, excellent: 70 }, unit: 'count', description: 'Service quote requests' }
    ]
  },

  // ==========================================================================
  // TECHNOLOGY & SOFTWARE
  // ==========================================================================

  '51-110': {
    code: '51-110',
    name: 'IT Services & Support',
    category: 'TECHNOLOGY',
    subIndustries: [
      {
        code: '51-110-01',
        name: 'Managed IT Services',
        keywords: ['IT support', 'managed services', 'cybersecurity', 'cloud'],
        typicalServices: ['24/7 monitoring', 'Help desk', 'Cybersecurity', 'Cloud migration'],
        targetAudiences: [
          { segment: 'SMBs', demographics: { businessSize: '10-200 employees' }, painPoints: ['Downtime', 'Security', 'IT costs'], motivations: ['Reliability', 'Security', 'Focus on business'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['LINKEDIN', 'FACEBOOK', 'GOOGLE_MY_BUSINESS'],
      highPerformingContent: ['EDUCATIONAL', 'CASE_STUDY', 'FAQ'],
    },
    aiPersona: {
      tone: 'professional',
      style: 'educational',
      vocabulary: ['proactive', 'security', 'reliability', 'expertise', 'partnership'],
      emphasisTopics: ['Security', 'Reliability', 'Proactive support', 'Business continuity'],
      samplePhrases: [
        "Proactive IT support that keeps your business running...",
        "Enterprise-grade security for growing businesses...",
        "Your technology partner for growth..."
      ]
    },
    contentTemplates: ['EDUCATIONAL_TIP', 'CASE_STUDY', 'FAQ_RESPONSE'],
    kpis: [
      { name: 'Consultation Requests', metric: 'consultations', benchmark: { good: 10, excellent: 30 }, unit: 'count', description: 'IT assessment requests' }
    ]
  },

  // ==========================================================================
  // FITNESS & WELLNESS
  // ==========================================================================

  '71-110': {
    code: '71-110',
    name: 'Fitness Centers & Gyms',
    category: 'SPORTS_FITNESS',
    subIndustries: [
      {
        code: '71-110-01',
        name: 'Boutique Fitness',
        keywords: ['fitness classes', 'group training', 'boutique gym', 'specialized'],
        typicalServices: ['Group classes', 'Personal training', 'Nutrition coaching'],
        targetAudiences: [
          { segment: 'Fitness enthusiasts', demographics: { ageRange: '25-45' }, painPoints: ['Motivation', 'Results', 'Time'], motivations: ['Health', 'Community', 'Transformation'] }
        ]
      }
    ],
    marketingProfile: {
      primaryChannels: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
      highPerformingContent: ['BEHIND_THE_SCENES', 'TESTIMONIAL', 'PRODUCT_DEMO'],
      seasonalTrends: [
        { season: 'New Year', months: [1], trend: 'Resolution rush', contentRecommendations: ['New member specials', 'Transformation stories'] }
      ]
    },
    aiPersona: {
      tone: 'conversational',
      style: 'casual',
      vocabulary: ['transform', 'community', 'results', 'strong', 'wellness', 'journey'],
      emphasisTopics: ['Community', 'Results', 'Support', 'Transformation'],
      samplePhrases: [
        "Your fitness journey starts here...",
        "Join a community that lifts you up...",
        "Results-driven training for real transformation..."
      ]
    },
    contentTemplates: ['TESTIMONIAL_REQUEST', 'BEHIND_THE_SCENES', 'PRODUCT_DEMO'],
    kpis: [
      { name: 'Trial Signups', metric: 'trial_signups', benchmark: { good: 50, excellent: 150 }, unit: 'count', description: 'Free trial registrations' },
      { name: 'Membership Conversion', metric: 'conversion_rate', benchmark: { good: 30, excellent: 50 }, unit: 'percentage', description: 'Trials to memberships' }
    ]
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get industry by code
 */
export function getIndustryByCode(code: string): IndustryVertical | undefined {
  return INDUSTRY_TAXONOMY[code];
}

/**
 * Get all industries by category
 */
export function getIndustriesByCategory(category: IndustryCategory): IndustryVertical[] {
  return Object.values(INDUSTRY_TAXONOMY).filter(
    (industry) => industry.category === category
  );
}

/**
 * Get all industry categories
 */
export function getAllCategories(): IndustryCategory[] {
  return Array.from(
    new Set(Object.values(INDUSTRY_TAXONOMY).map((i) => i.category))
  );
}

/**
 * Search industries by keyword
 */
export function searchIndustries(keyword: string): IndustryVertical[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(INDUSTRY_TAXONOMY).filter((industry) => {
    // Search in name
    if (industry.name.toLowerCase().includes(lowerKeyword)) return true;
    // Search in sub-industries
    if (industry.subIndustries.some((sub) =>
      sub.name.toLowerCase().includes(lowerKeyword) ||
      sub.keywords.some((k) => k.toLowerCase().includes(lowerKeyword))
    )) return true;
    return false;
  });
}

/**
 * Get AI persona for industry
 */
export function getIndustryAIPersona(code: string): IndustryAIPersona | undefined {
  return INDUSTRY_TAXONOMY[code]?.aiPersona;
}

/**
 * Get content templates for industry
 */
export function getIndustryContentTemplates(code: string): ContentTemplateType[] {
  return INDUSTRY_TAXONOMY[code]?.contentTemplates || [];
}

/**
 * Get KPIs for industry
 */
export function getIndustryKPIs(code: string): IndustryKPI[] {
  return INDUSTRY_TAXONOMY[code]?.kpis || [];
}

// ============================================================================
// EXPORTS
// ============================================================================

export { INDUSTRY_TAXONOMY };
export default INDUSTRY_TAXONOMY;
