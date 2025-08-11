/**
 * Content Templates Library
 * Pre-built templates for faster content creation
 */

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'marketing' | 'engagement' | 'educational' | 'promotional' | 'personal';
  platforms: ('twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok')[];
  structure: {
    hook: string;
    body: string;
    cta?: string;
    hashtags?: string[];
    mediaType?: 'image' | 'video' | 'carousel' | 'text';
  };
  variables?: string[]; // Placeholders to fill in
  tips?: string[];
  exampleUrl?: string;
  popularity: number; // Usage count
}

export const contentTemplates: ContentTemplate[] = [
  // Marketing Templates
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Announce a new product or feature with maximum impact',
    icon: '🚀',
    category: 'marketing',
    platforms: ['twitter', 'linkedin', 'facebook', 'instagram'],
    structure: {
      hook: '🎉 Big news! We just launched {product_name}!',
      body: '{product_description}\n\n✨ Key features:\n• {feature_1}\n• {feature_2}\n• {feature_3}\n\n{special_offer}',
      cta: '🔗 Learn more: {link}',
      hashtags: ['#ProductLaunch', '#Innovation', '#NewRelease'],
      mediaType: 'image'
    },
    variables: ['product_name', 'product_description', 'feature_1', 'feature_2', 'feature_3', 'special_offer', 'link'],
    tips: [
      'Use high-quality product images',
      'Post at peak engagement times',
      'Create urgency with limited-time offers'
    ],
    popularity: 245
  },
  
  {
    id: 'customer-story',
    name: 'Customer Success Story',
    description: 'Share customer testimonials and success stories',
    icon: '💬',
    category: 'marketing',
    platforms: ['linkedin', 'twitter', 'facebook'],
    structure: {
      hook: '"${quote}" - {customer_name}',
      body: '🌟 Success Story Alert!\n\n{customer_name} from {company} achieved {achievement} using our {product/service}.\n\nThe results:\n📈 {metric_1}\n📊 {metric_2}\n✅ {metric_3}',
      cta: 'Read the full case study → {link}',
      hashtags: ['#CustomerSuccess', '#CaseStudy', '#Results'],
      mediaType: 'image'
    },
    variables: ['quote', 'customer_name', 'company', 'achievement', 'product/service', 'metric_1', 'metric_2', 'metric_3', 'link'],
    tips: [
      'Always get customer permission first',
      'Use real metrics and data',
      'Include customer photo if possible'
    ],
    popularity: 189
  },
  
  // Engagement Templates
  {
    id: 'question-poll',
    name: 'Engaging Question/Poll',
    description: 'Boost engagement with thought-provoking questions',
    icon: '❓',
    category: 'engagement',
    platforms: ['twitter', 'linkedin', 'instagram'],
    structure: {
      hook: '🤔 Quick question for my {audience}:',
      body: '{question}\n\nA) {option_a}\nB) {option_b}\nC) {option_c}\nD) {option_d}\n\nDrop your answer below! 👇',
      hashtags: ['#Poll', '#Question', '#Community'],
      mediaType: 'text'
    },
    variables: ['audience', 'question', 'option_a', 'option_b', 'option_c', 'option_d'],
    tips: [
      'Ask questions relevant to your audience',
      'Keep options clear and distinct',
      'Engage with responses'
    ],
    popularity: 312
  },
  
  {
    id: 'behind-scenes',
    name: 'Behind the Scenes',
    description: 'Show the human side of your brand',
    icon: '🎬',
    category: 'engagement',
    platforms: ['instagram', 'tiktok', 'facebook'],
    structure: {
      hook: '👀 Behind the scenes at {company}!',
      body: 'Ever wondered how we {process/activity}?\n\n{description}\n\n{fun_fact}',
      cta: 'What would you like to see next? Let us know! 💭',
      hashtags: ['#BehindTheScenes', '#BTS', '#DayInTheLife'],
      mediaType: 'video'
    },
    variables: ['company', 'process/activity', 'description', 'fun_fact'],
    tips: [
      'Keep it authentic and unpolished',
      'Show real people and processes',
      'Add personality and humor'
    ],
    popularity: 278
  },
  
  // Educational Templates
  {
    id: 'tips-list',
    name: 'Tips & Tricks List',
    description: 'Share valuable tips in an easy-to-digest format',
    icon: '💡',
    category: 'educational',
    platforms: ['twitter', 'linkedin', 'instagram'],
    structure: {
      hook: '🧵 {number} {topic} tips that will {benefit}:',
      body: '1️⃣ {tip_1}\n\n2️⃣ {tip_2}\n\n3️⃣ {tip_3}\n\n4️⃣ {tip_4}\n\n5️⃣ {tip_5}',
      cta: 'Save this for later! Which tip was most helpful? 💭',
      hashtags: ['#Tips', '#HowTo', '#Learning'],
      mediaType: 'carousel'
    },
    variables: ['number', 'topic', 'benefit', 'tip_1', 'tip_2', 'tip_3', 'tip_4', 'tip_5'],
    tips: [
      'Keep each tip concise and actionable',
      'Use emojis to improve readability',
      'Create carousel images for Instagram'
    ],
    popularity: 423
  },
  
  {
    id: 'myth-buster',
    name: 'Myth Buster',
    description: 'Debunk common misconceptions in your industry',
    icon: '🚫',
    category: 'educational',
    platforms: ['linkedin', 'twitter'],
    structure: {
      hook: '❌ Myth: {myth}\n✅ Reality: {reality}',
      body: 'Let\'s bust this common {industry} myth!\n\n{explanation}\n\nThe truth is: {truth}\n\nHere\'s what you should do instead:\n→ {action_1}\n→ {action_2}\n→ {action_3}',
      hashtags: ['#MythBusting', '#Facts', '#Truth'],
      mediaType: 'image'
    },
    variables: ['myth', 'reality', 'industry', 'explanation', 'truth', 'action_1', 'action_2', 'action_3'],
    tips: [
      'Back up claims with data',
      'Be respectful when correcting misconceptions',
      'Provide actionable alternatives'
    ],
    popularity: 234
  },
  
  // Promotional Templates
  {
    id: 'limited-offer',
    name: 'Limited Time Offer',
    description: 'Create urgency with time-sensitive promotions',
    icon: '⏰',
    category: 'promotional',
    platforms: ['twitter', 'facebook', 'instagram'],
    structure: {
      hook: '⏰ {hours} HOURS LEFT! {emoji}',
      body: '{offer_description}\n\n🎯 {discount}% OFF\n📅 Ends: {end_date}\n💳 Code: {promo_code}',
      cta: '👉 Grab yours now: {link}\n\n*{terms}',
      hashtags: ['#LimitedOffer', '#Sale', '#Discount'],
      mediaType: 'image'
    },
    variables: ['hours', 'emoji', 'offer_description', 'discount', 'end_date', 'promo_code', 'link', 'terms'],
    tips: [
      'Use countdown timers in stories',
      'Create FOMO with stock levels',
      'Be clear about terms and conditions'
    ],
    popularity: 356
  },
  
  {
    id: 'webinar-invite',
    name: 'Webinar Invitation',
    description: 'Promote upcoming webinars and online events',
    icon: '🎓',
    category: 'promotional',
    platforms: ['linkedin', 'twitter', 'facebook'],
    structure: {
      hook: '📢 Free {type}: {title}',
      body: 'Join us on {date} at {time} for an exclusive {type} on {topic}!\n\nYou\'ll learn:\n✅ {learning_1}\n✅ {learning_2}\n✅ {learning_3}\n\n👤 Speaker: {speaker}\n📍 Platform: {platform}',
      cta: '🎟️ Register free: {link}\n\nLimited spots available!',
      hashtags: ['#Webinar', '#FreeEvent', '#Learning'],
      mediaType: 'image'
    },
    variables: ['type', 'title', 'date', 'time', 'topic', 'learning_1', 'learning_2', 'learning_3', 'speaker', 'platform', 'link'],
    tips: [
      'Send reminder posts as event approaches',
      'Create speaker highlight posts',
      'Share key takeaways after the event'
    ],
    popularity: 267
  },
  
  // Personal Brand Templates
  {
    id: 'milestone-celebration',
    name: 'Milestone Celebration',
    description: 'Celebrate achievements and thank your audience',
    icon: '🎉',
    category: 'personal',
    platforms: ['twitter', 'linkedin', 'instagram'],
    structure: {
      hook: '🎉 WE DID IT! {milestone}!',
      body: 'I\'m incredibly grateful to announce {achievement}!\n\n{gratitude_message}\n\nThis wouldn\'t be possible without {acknowledgment}.\n\n{reflection}',
      cta: 'Here\'s to the next milestone! What are you celebrating today? 🥂',
      hashtags: ['#Milestone', '#Grateful', '#Success'],
      mediaType: 'image'
    },
    variables: ['milestone', 'achievement', 'gratitude_message', 'acknowledgment', 'reflection'],
    tips: [
      'Be genuine and humble',
      'Thank specific people/groups',
      'Share lessons learned'
    ],
    popularity: 298
  },
  
  {
    id: 'monday-motivation',
    name: 'Monday Motivation',
    description: 'Start the week with inspiring content',
    icon: '💪',
    category: 'personal',
    platforms: ['linkedin', 'instagram', 'twitter'],
    structure: {
      hook: '💪 Monday Motivation',
      body: '"{quote}"\n\n{personal_insight}\n\nThis week, I\'m focusing on {focus}.\n\nWhat\'s your big goal for this week? Share below! 👇',
      hashtags: ['#MondayMotivation', '#WeeklyGoals', '#Motivation'],
      mediaType: 'image'
    },
    variables: ['quote', 'personal_insight', 'focus'],
    tips: [
      'Post early Monday morning',
      'Use high-quality motivational graphics',
      'Engage with responses'
    ],
    popularity: 412
  }
];

// Helper functions
export const getTemplatesByCategory = (category: ContentTemplate['category']) => 
  contentTemplates.filter(t => t.category === category);

export const getTemplatesByPlatform = (platform: string) =>
  contentTemplates.filter(t => t.platforms.includes(platform as any));

export const getMostPopularTemplates = (limit = 5) =>
  [...contentTemplates].sort((a, b) => b.popularity - a.popularity).slice(0, limit);

export const searchTemplates = (query: string) => {
  const lowerQuery = query.toLowerCase();
  return contentTemplates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.category.includes(lowerQuery)
  );
};

// Track template usage
export const trackTemplateUsage = (templateId: string) => {
  const template = contentTemplates.find(t => t.id === templateId);
  if (template) {
    template.popularity++;
    // In production, this would update the database
    localStorage.setItem(`template_usage_${templateId}`, String(template.popularity));
  }
};