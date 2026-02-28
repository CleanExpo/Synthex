import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

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
        platforms: ['instagram', 'twitter', 'linkedin']
      }
    }
  });

  console.log('✅ Created demo user:', demoUser.email);

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
        platforms: ['all']
      }
    }
  });

  console.log('✅ Created admin user:', adminUser.email);

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
          'Transform your marketing with AI-powered tools'
        ]
      },
      settings: {
        targetAudience: 'B2B marketers',
        postFrequency: 'daily',
        optimalTimes: ['9:00 AM', '2:00 PM', '6:00 PM']
      }
    }
  });

  console.log('✅ Created sample campaign:', sampleCampaign.name);

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
          imageUrl: 'https://example.com/image1.jpg'
        }
      }
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
          imageUrl: 'https://example.com/image2.jpg'
        }
      }
    })
  ]);

  console.log(`✅ Created ${posts.length} sample posts`);

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
        timeline: '3 months'
      }
    }
  });

  console.log('✅ Created sample project:', sampleProject.name);

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

  console.log('✅ Created 5 onboarding QA test users (test-new, test-step1..3, test-complete)');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });