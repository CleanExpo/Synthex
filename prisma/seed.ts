import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Starting seed...');

  // Create demo user
  const demoPassword = await bcrypt.hash('Rrw6qRd1IIIY5Br9!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@synthex.com' },
    update: {},
    create: {
      email: 'demo@synthex.com',
      password: demoPassword,
      name: 'Demo User',
      // Database expects Boolean
      emailVerified: true,
      authProvider: 'local',
      preferences: {
        onboardingCompleted: true,
        userType: 'marketer',
        platforms: ['instagram', 'twitter', 'linkedin'],
      },
    },
  });

  console.info('✅ Created demo user:', demoUser.email);

  // Create admin user
  const adminPassword = await bcrypt.hash('IBkxhZpGPQW3a5B2!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@synthex.com' },
    update: {},
    create: {
      email: 'admin@synthex.com',
      password: adminPassword,
      name: 'Admin User',
      // Database expects Boolean
      emailVerified: true,
      authProvider: 'local',
      preferences: {
        onboardingCompleted: true,
        userType: 'admin',
        platforms: ['all'],
      },
    },
  });

  console.info('✅ Created admin user:', adminUser.email);

  // Create a sample campaign for demo user
  const sampleCampaign = await prisma.campaign.create({
    data: {
      name: 'Sample Marketing Campaign',
      description: 'A demo campaign to showcase platform features',
      platform: 'instagram',
      status: 'draft',
      userId: demoUser.id,
      content: {
        mainMessage: 'Check out our amazing product!',
        hashtags: ['#marketing', '#automation', '#synthex'],
        variations: [
          'Discover the future of marketing automation',
          'Transform your marketing with AI-powered tools',
        ],
      },
      settings: {
        targetAudience: 'B2B marketers',
        postFrequency: 'daily',
        optimalTimes: ['9:00 AM', '2:00 PM', '6:00 PM'],
      },
    },
  });

  console.info('✅ Created sample campaign:', sampleCampaign.name);

  // Create sample posts for the campaign
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        content: 'Introducing SYNTHEX - Your AI Marketing Assistant 🚀',
        platform: 'instagram',
        status: 'draft',
        campaignId: sampleCampaign.id,
        metadata: {
          hashtags: ['#AI', '#Marketing', '#Automation'],
          imageUrl: 'https://example.com/image1.jpg',
        },
      },
    }),
    prisma.post.create({
      data: {
        content: 'Save 10 hours per week with automated content generation',
        platform: 'instagram',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        campaignId: sampleCampaign.id,
        metadata: {
          hashtags: ['#Productivity', '#TimeSaver'],
          imageUrl: 'https://example.com/image2.jpg',
        },
      },
    }),
  ]);

  console.info(`✅ Created ${posts.length} sample posts`);

  // Create a sample project
  const sampleProject = await prisma.project.create({
    data: {
      name: 'Q1 Marketing Strategy',
      description: 'First quarter marketing initiatives',
      type: 'marketing',
      userId: demoUser.id,
      data: {
        goals: ['Increase brand awareness', 'Generate 1000 leads'],
        budget: 10000,
        timeline: '3 months',
      },
    },
  });

  console.info('✅ Created sample project:', sampleProject.name);

  // ---------------------------------------------------------------------------
  // Onboarding QA test users (UNI-1030)
  // 5 users at different onboarding steps for testing the onboarding flow.
  // Shared password for all test users: TestUser123!
  // ---------------------------------------------------------------------------
  const testPassword = await bcrypt.hash('TestUser123!', 12);

  // 1. Brand new user — step 0, no onboarding started
  await prisma.user.upsert({
    where: { email: 'test-new@synthex.com' },
    update: {},
    create: {
      email: 'test-new@synthex.com',
      password: testPassword,
      name: 'Test New User',
      emailVerified: true,
      authProvider: 'local',
      onboardingComplete: false,
      onboardingStep: 0,
      businessProfileComplete: false,
      apiKeyConfigured: false,
    },
  });

  // 2. Completed step 1 (business profile)
  await prisma.user.upsert({
    where: { email: 'test-step1@synthex.com' },
    update: {},
    create: {
      email: 'test-step1@synthex.com',
      password: testPassword,
      name: 'Test Step1 User',
      emailVerified: true,
      authProvider: 'local',
      onboardingComplete: false,
      onboardingStep: 1,
      businessProfileComplete: true,
      apiKeyConfigured: false,
    },
  });

  // 3. Completed step 2 (API key configured)
  await prisma.user.upsert({
    where: { email: 'test-step2@synthex.com' },
    update: {},
    create: {
      email: 'test-step2@synthex.com',
      password: testPassword,
      name: 'Test Step2 User',
      emailVerified: true,
      authProvider: 'local',
      onboardingComplete: false,
      onboardingStep: 2,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
    },
  });

  // 4. Completed step 3 (socials connected)
  await prisma.user.upsert({
    where: { email: 'test-step3@synthex.com' },
    update: {},
    create: {
      email: 'test-step3@synthex.com',
      password: testPassword,
      name: 'Test Step3 User',
      emailVerified: true,
      authProvider: 'local',
      onboardingComplete: false,
      onboardingStep: 3,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
    },
  });

  // 5. Fully onboarded user
  await prisma.user.upsert({
    where: { email: 'test-complete@synthex.com' },
    update: {},
    create: {
      email: 'test-complete@synthex.com',
      password: testPassword,
      name: 'Test Complete User',
      emailVerified: true,
      authProvider: 'local',
      onboardingComplete: true,
      onboardingStep: 4,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
      preferences: {
        onboardingCompleted: true,
        userType: 'marketer',
        platforms: ['instagram', 'linkedin'],
      },
    },
  });

  console.info(
    '✅ Created 5 onboarding QA test users (test-new, test-step1..3, test-complete)'
  );

  // ---------------------------------------------------------------------------
  // 3-Layer Prompt System — Task-layer templates (SYN-515)
  // System templates (isSystem/isPublic) tagged layer='task'. Deterministic ids
  // make the seed idempotent.
  // ---------------------------------------------------------------------------
  const taskTemplates = [
    { slug: 'twitter-post', name: 'Twitter Post', icon: '🐦', category: 'engagement', platforms: ['twitter'], hook: 'Open with a bold one-line claim.', body: 'One idea, plainly argued in 2-3 short sentences.', cta: 'End with a question or invite a reply.', mediaType: 'none' },
    { slug: 'twitter-thread', name: 'Twitter Thread', icon: '🧵', category: 'educational', platforms: ['twitter'], hook: 'Promise a specific payoff in the first tweet.', body: 'Number each step; one point per tweet.', cta: 'Close with a summary and a follow prompt.', mediaType: 'none' },
    { slug: 'linkedin-post', name: 'LinkedIn Post', icon: '💼', category: 'marketing', platforms: ['linkedin'], hook: 'Lead with a concrete result or lesson.', body: 'Tell a short story, then draw the insight.', cta: 'Ask readers to share their experience.', mediaType: 'none' },
    { slug: 'linkedin-article', name: 'LinkedIn Article', icon: '📄', category: 'educational', platforms: ['linkedin'], hook: 'State the problem the reader recognises.', body: 'Structured sections with practical examples.', cta: 'Invite comments and connection.', mediaType: 'none' },
    { slug: 'instagram-caption', name: 'Instagram Caption', icon: '📸', category: 'engagement', platforms: ['instagram'], hook: 'First line stops the scroll.', body: 'Conversational value in a few short lines.', cta: 'Prompt a save or a comment.', hashtags: ['#tips'], mediaType: 'image' },
    { slug: 'instagram-reel', name: 'Instagram Reel Script', icon: '🎬', category: 'engagement', platforms: ['instagram'], hook: '3-second visual hook and spoken opener.', body: 'Fast beats; one takeaway per shot.', cta: 'Tell viewers to follow for more.', mediaType: 'video' },
    { slug: 'instagram-story', name: 'Instagram Story', icon: '⭐', category: 'personal', platforms: ['instagram'], hook: 'A single arresting frame or question.', body: 'One idea; use a poll or sticker.', cta: 'Swipe up / tap to learn more.', mediaType: 'image' },
    { slug: 'facebook-post', name: 'Facebook Post', icon: '👍', category: 'marketing', platforms: ['facebook'], hook: 'Relatable opener for a broad audience.', body: 'Warm, plain-language value.', cta: 'Encourage shares and comments.', mediaType: 'none' },
    { slug: 'tiktok-hook', name: 'TikTok Hook', icon: '🎵', category: 'engagement', platforms: ['tiktok'], hook: 'Pattern-interrupt in the first second.', body: 'Punchy, high-energy delivery.', cta: 'Ask for a like/follow.', mediaType: 'video' },
    { slug: 'youtube-description', name: 'YouTube Description', icon: '▶️', category: 'educational', platforms: ['youtube'], hook: 'One-sentence summary of the value.', body: 'Timestamps and key points.', cta: 'Subscribe prompt and links.', mediaType: 'video' },
    { slug: 'promotional-post', name: 'Promotional Post', icon: '📣', category: 'promotional', platforms: ['twitter', 'linkedin', 'facebook'], hook: 'Lead with the concrete benefit.', body: 'What it is, who it helps, why now.', cta: 'Clear next step with a link.', mediaType: 'none' },
    { slug: 'educational-carousel', name: 'Educational Carousel', icon: '📚', category: 'educational', platforms: ['instagram', 'linkedin'], hook: 'Cover slide names the payoff.', body: 'One idea per slide, ordered logically.', cta: 'Final slide asks for a save/share.', mediaType: 'image' },
  ];

  for (const t of taskTemplates) {
    await prisma.promptTemplate.upsert({
      where: { id: `syn515-task-${t.slug}` },
      update: { layer: 'task' },
      create: {
        id: `syn515-task-${t.slug}`,
        name: t.name,
        description: `Task-layer template for ${t.name} (SYN-515).`,
        icon: t.icon,
        category: t.category,
        layer: 'task',
        platforms: t.platforms,
        structure: {
          hook: t.hook,
          body: t.body,
          ...(t.cta ? { cta: t.cta } : {}),
          ...(t.hashtags ? { hashtags: t.hashtags } : {}),
          mediaType: t.mediaType,
        },
        variables: ['topic', 'audience', 'tone'],
        tips: ['Keep it specific.', 'Australian English.', 'No AI slop.'],
        isPublic: true,
        isSystem: true,
      },
    });
  }

  console.info('✅ Seeded 12 task-layer prompt templates (SYN-515)');

  console.info('🎉 Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
