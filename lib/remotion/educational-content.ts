/**
 * Educational Video Registry (SYN-429 stub)
 *
 * This file will be populated with 100 educational video entries
 * once SYN-429 (Remotion educational templates) is complete.
 *
 * Each entry maps to a Remotion composition that renders a short
 * educational video about marketing automation topics.
 */

export interface EducationalVideo {
  id: string; // Unique identifier, used as output filename
  title: string;
  description: string; // YouTube video description
  tags: string[];
  compositionId: string; // Remotion composition ID
  voiceoverScript: string; // ElevenLabs TTS script (~60s at natural pace)
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Educational video registry — 100 entries to be added (SYN-429).
 * Placeholder with 2 example entries for pipeline testing.
 */
export const EDUCATIONAL_VIDEOS: EducationalVideo[] = [
  {
    id: 'intro-ai-marketing',
    title: 'What is AI Marketing Automation? | Synthex Education',
    description: `Learn how AI marketing automation can transform your business's social media presence.

In this video:
• What AI marketing automation means
• How it saves time on content creation
• Real results from early adopters

Start free: https://synthex.social

#AIMarketing #MarketingAutomation #Synthex`,
    tags: [
      'AI marketing',
      'marketing automation',
      'social media',
      'Synthex',
      'education',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Welcome to Synthex Education. Today we explore AI marketing automation — ' +
      'what it is, why it matters, and how platforms like Synthex are making it accessible ' +
      'to businesses of every size. AI marketing automation uses artificial intelligence to ' +
      'create, schedule, and optimise your social media content automatically. ' +
      'Instead of spending hours crafting posts, your AI learns your brand voice and ' +
      'generates on-brand content around the clock. Early adopters report saving over ' +
      'ten hours per week while seeing improved engagement across all platforms. ' +
      'The future of marketing is autonomous. Visit Synthex dot social to get started today.',
    durationInFrames: 900, // 30s at 30fps
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'content-calendar-tips',
    title: '5 Content Calendar Tips for 2026 | Synthex Education',
    description: `Master your content calendar with these proven strategies for 2026.

Tips covered:
• Batch content creation
• Platform-specific scheduling
• Repurposing content effectively
• Analytics-driven timing
• AI-assisted planning

Start free: https://synthex.social

#ContentCalendar #SocialMediaStrategy #Synthex`,
    tags: [
      'content calendar',
      'social media strategy',
      'content planning',
      'Synthex',
      'marketing tips',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Five content calendar tips to transform your social media strategy in 2026. ' +
      'First — batch your content creation. Set aside dedicated blocks each week to ' +
      'create multiple posts at once, rather than scrambling daily. ' +
      'Second — tailor your schedule to each platform. Instagram peaks on Tuesday mornings, ' +
      'LinkedIn on Wednesday afternoons, TikTok in the evenings. ' +
      'Third — repurpose relentlessly. One blog post becomes five social posts, ' +
      'one video becomes ten quote cards. ' +
      'Fourth — let your analytics guide your timing. Post when your audience is most active, ' +
      'not just when it is convenient. ' +
      'And fifth — use AI to fill the gaps. Synthex can generate a month of on-brand content ' +
      'in minutes, keeping your calendar full without burning out your team. ' +
      'Visit Synthex dot social to build your content calendar today.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];
