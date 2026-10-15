/**
 * In-app help videos — the catalogue entries the product plays through
 * <HelpVideo> (sign-up, sign-in, onboarding, feature tours).
 *
 * Split out of educational-content.ts so a page that plays one help video
 * does not ship the whole YouTube marketing catalogue in its bundle.
 * EDUCATIONAL_VIDEOS still includes every entry here, in its original
 * position, for the render-and-upload pipeline.
 */

export interface EducationalVideo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  compositionId: string;
  voiceoverScript: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  youtubeVideoId?: string;
}

export const HELP_VIDEOS: EducationalVideo[] = [
  {
    id: 'ai-capability-chat',
    title: 'AI Chat Capabilities | Synthex',
    description:
      'Discover what you can do with Synthex AI Chat — strategy, content, research, and more.\n\n#AIChat #MarketingAI #Synthex',
    tags: [
      'AI chat',
      'content strategy',
      'marketing AI',
      'Synthex',
      'tutorial',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Synthex AI Chat is your always-on marketing strategist. ' +
      'Ask it to brainstorm campaign ideas, write captions for specific platforms, or analyse competitor content. ' +
      'It remembers your brand profile and past conversations, so advice gets more personalised over time. ' +
      'Use it to draft email subject lines, plan content calendars, or refine your value proposition. ' +
      'Every response is grounded in your industry context — not generic marketing advice.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'feature-tour-brand-voice',
    title: 'Brand Voice Feature Tour | Synthex',
    description:
      'Learn how Synthex captures and maintains your unique brand voice across all AI-generated content.\n\n#BrandVoice #ContentStrategy #Synthex',
    tags: ['brand voice', 'tone of voice', 'content strategy', 'AI', 'Synthex'],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'Your brand voice is what makes your content recognisable. ' +
      'Synthex learns it from your existing posts, website copy, and the tone guidelines you provide. ' +
      "In the Brand Voice page, you can review and refine the AI's understanding of your style. " +
      'Set vocabulary preferences, tone sliders, and content themes. ' +
      'Every piece of AI-generated content will match this profile — consistent across platforms and over time.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'feature-tour-research',
    title: 'Research Feature Tour | Synthex',
    description:
      'Explore Synthex Research — AI-powered market intelligence to inform your content strategy.\n\n#ContentResearch #MarketIntelligence #Synthex',
    tags: [
      'research',
      'market intelligence',
      'content strategy',
      'AI',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'The Synthex Research module puts market intelligence at your fingertips. ' +
      'Search any topic and get a synthesised brief — trends, key players, audience questions, and content angles. ' +
      'Research reports are saved to your library for future reference. ' +
      'Use the citation panel to back up your content with credible sources. ' +
      "The AI identifies gaps in your competitors's content that you can fill — giving you a consistent edge.",
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'how-to-create-content',
    title: 'How to Create AI Content | Synthex Tutorial',
    description:
      'See how to generate on-brand social media content with Synthex AI in seconds.\n\n#ContentCreation #AIMarketing #Synthex',
    tags: [
      'content creation',
      'AI writing',
      'social media',
      'Synthex',
      'tutorial',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Navigate to Content Drafts and click New Draft. ' +
      'Enter a topic or let AI suggest one based on your content calendar. ' +
      'Synthex generates platform-optimised copy for every connected channel simultaneously. ' +
      'Review, tweak, and approve — or enable auto-publish to go live immediately. ' +
      'Your brand voice is learned from your existing content, so every post sounds like you.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'how-to-sign-in',
    title: 'How to Sign In to Synthex',
    description:
      'Signing in to Synthex is simple — email and password, or one-click Google login.\n\n#Synthex #SignIn #GettingStarted',
    tags: ['login', 'sign in', 'getting started', 'Synthex'],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Signing in to Synthex is simple. Visit synthex dot social and click Sign In. ' +
      'Enter your email address and password, then click Sign In. You can also sign in ' +
      "with Google for one-click access. If you've forgotten your password, click Forgot " +
      "Password and we'll email you a reset link. Once signed in, you'll land directly " +
      'on your dashboard where all your campaigns, analytics, and tools are waiting.',
    durationInFrames: 600,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'V6d5bcnJ0z4',
  },
  {
    id: 'how-to-sign-up',
    title: 'How to Create Your Synthex Account',
    description:
      'Learn how to create your Synthex account — from the sign-up form to the activation checklist.\n\n#Synthex #GettingStarted #AccountCreation',
    tags: ['signup', 'getting started', 'account creation', 'Synthex'],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Creating your Synthex account is quick. Head to synthex dot social ' +
      'and click Get Started Free. Enter your business name, email address, and a strong ' +
      "password — then click Create Account. You'll receive a verification email immediately. " +
      "Open it and click Verify Email Address. Once verified, you'll be taken straight into " +
      'the activation checklist. This checklist connects your platforms and unlocks ' +
      'the full automation engine. Complete each step in order — starting with your URL health ' +
      'check, then connecting your social media accounts. Welcome to Synthex.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'K2QqYXi05Do',
  },
  {
    id: 'onboarding-connect-gmb',
    title: 'Connecting Google Business Profile',
    description:
      'Step 3 of activation: connect your Google Business Profile to sync reviews, insights, and local search data.\n\n#GoogleBusiness #LocalSEO #Onboarding #Synthex',
    tags: ['Google Business Profile', 'GMB', 'local SEO', 'onboarding'],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Your Google Business Profile is Step 3 of activation. Navigate to Google Business ' +
      'in your dashboard sidebar. Click Connect Google Business Profile and sign in with ' +
      'the Google account that manages your listing. Once connected, Synthex automatically ' +
      'syncs your reviews, insights, and location data. You can respond to reviews with ' +
      'AI-generated replies, post directly to your listing, and track how customers find ' +
      'you in local search. The NAP consistency audit also runs automatically, alerting you ' +
      'if your name, address, or phone number differs across platforms. This is essential ' +
      'for local search ranking.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'g8YRmVvnBj0',
  },
  {
    id: 'onboarding-connect-social',
    title: 'Connecting Your Social Media Accounts',
    description:
      'Step 2 of activation: connect Instagram, Facebook, LinkedIn, and your other platforms to unlock AI-powered publishing.\n\n#SocialMedia #Onboarding #Synthex',
    tags: [
      'social media',
      'connect accounts',
      'onboarding',
      'Instagram',
      'LinkedIn',
      'Facebook',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Connecting your social media accounts is Step 2 of your activation checklist. ' +
      'From the dashboard, navigate to Integrations and select the platform you want to connect. ' +
      'Synthex supports Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Pinterest, and Google ' +
      "Business Profile. Click Connect, authorise Synthex in the popup, and you're done. " +
      'Each connected platform unlocks direct posting, engagement tracking, and AI-powered ' +
      'scheduling. Connect all your active platforms for maximum automation impact. ' +
      'Once connected, your accounts will appear in the Integrations panel with a green status indicator.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'k6lRhET7QDY',
  },
  {
    id: 'onboarding-setup-ai',
    title: 'Setting Up Your AI Integration',
    description:
      'Step 4 of activation: connect your AI provider (OpenAI, Anthropic, Gemini, or OpenRouter) to unlock the full Content Studio.\n\n#AI #ContentGeneration #Onboarding #Synthex',
    tags: ['AI', 'LLM', 'API key', 'onboarding', 'content generation'],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Step 4 of activation is connecting your AI provider. Navigate to Settings, then ' +
      'API Keys, and select your preferred AI provider — Synthex supports OpenAI, Anthropic ' +
      'Claude, Google Gemini, and OpenRouter. Enter your API key and click Save. ' +
      "If you prefer not to use your own key, Synthex's built-in AI engine activates " +
      'automatically on any paid plan. Once your AI is connected, the Content Studio ' +
      'unlocks the full generation toolkit — long-form posts, short reels, campaign briefs, ' +
      'and competitor analysis all become available. This is the engine that powers ' +
      'autonomous content creation.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
    youtubeVideoId: 'No4TI4lLIiM',
  },
  {
    id: 'platform-guide-instagram',
    title: 'Connecting Instagram | Synthex Platform Guide',
    description:
      'Step-by-step guide to connecting your Instagram account to Synthex for automated posting.\n\n#Instagram #SocialMediaIntegration #Synthex',
    tags: [
      'Instagram',
      'platform connection',
      'OAuth',
      'social media',
      'Synthex',
    ],
    compositionId: 'HowToVideo',
    voiceoverScript:
      'Go to Integrations, find Instagram in the platform list, and click Connect. ' +
      "You will be redirected to Instagram's authorisation page. " +
      'Log in with your business account and approve the Synthex permissions. ' +
      'Once connected, Synthex can publish posts, reels, and stories on your behalf. ' +
      'Connect multiple Instagram accounts for different businesses — each managed separately.',
    durationInFrames: 1200,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  {
    id: 'workflow-overview',
    title: 'Creative Suite Workflow Overview | Synthex',
    description:
      'Get an overview of the Synthex Creative Suite — AI content studio, brand tools, and campaign builder.\n\n#CreativeSuite #ContentStudio #Synthex',
    tags: [
      'creative suite',
      'content studio',
      'brand tools',
      'campaign builder',
      'Synthex',
    ],
    compositionId: 'ExplainerVideo',
    voiceoverScript:
      'The Synthex Creative Suite is where ideas become campaigns. ' +
      'Start in the AI Content Studio to generate copy, images, and video briefs. ' +
      'Move to the Brand Tools section to apply your visual identity — logo, colours, fonts. ' +
      'Then hand off to the Campaign Builder to schedule and distribute across every platform. ' +
      'Your creative output scales with your ambition.',
    durationInFrames: 900,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];

export const HELP_VIDEO_BY_ID: Record<string, EducationalVideo> =
  Object.fromEntries(HELP_VIDEOS.map(v => [v.id, v]));
