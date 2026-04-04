const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create test user for development
  const testPassword = await bcrypt.hash('password', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: testPassword,
      name: 'Test User',
      emailVerified: true,
      authProvider: 'local',
      preferences: {
        onboardingCompleted: true,
        userType: 'marketer',
        platforms: ['instagram', 'twitter', 'linkedin']
      }
    }
  });

  console.log('✅ Created test user:', testUser.email);

  // Create demo user
  const demoPassword = await bcrypt.hash('demo123!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@synthex.com' },
    update: {},
    create: {
      email: 'demo@synthex.com',
      password: demoPassword,
      name: 'Demo User',
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
  const adminPassword = await bcrypt.hash('admin2024!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@synthex.com' },
    update: {},
    create: {
      email: 'admin@synthex.com',
      password: adminPassword,
      name: 'Admin',
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

  // Create sample campaigns for test user
  const campaign = await prisma.campaign.upsert({
    where: { 
      id: 'test-campaign-1'
    },
    update: {},
    create: {
      id: 'test-campaign-1',
      userId: testUser.id,
      name: 'Holiday Marketing Campaign',
      description: 'End of year promotional campaign',
      platform: 'instagram',
      status: 'active',
      content: {
        variations: ['Version A', 'Version B', 'Version C'],
        hashtags: ['#HolidayMarketing', '#Synthex', '#AIMarketing']
      },
      analytics: {
        impressions: 125000,
        engagements: 8500,
        clicks: 3200,
        conversions: 150
      },
      settings: {
        targetAudience: 'Marketers and businesses',
        scheduledDates: ['2025-08-01', '2025-08-15', '2025-08-31']
      }
    }
  });

  console.log('✅ Created sample campaign:', campaign.name);

  // Create sample posts for test user
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        campaignId: campaign.id,
        platform: 'twitter',
        content: '🚀 Excited to announce our new AI-powered features! Transform your social media strategy with intelligent automation. #AI #SocialMedia #Innovation',
        status: 'published',
        scheduledAt: new Date('2025-08-10T10:00:00Z'),
        publishedAt: new Date('2025-08-10T10:00:00Z'),
        metadata: {
          hashtags: ['#AI', '#SocialMedia', '#Innovation'],
          mentions: []
        },
        analytics: {
          likes: 245,
          shares: 32,
          comments: 18,
          impressions: 5420
        }
      }
    }),
    prisma.post.create({
      data: {
        campaignId: campaign.id,
        platform: 'linkedin',
        content: 'How AI is revolutionizing social media marketing:\n\n1. Predictive analytics for content performance\n2. Automated persona learning\n3. Real-time engagement optimization\n\nWhat\'s your experience with AI in marketing?',
        status: 'scheduled',
        scheduledAt: new Date('2025-08-15T14:00:00Z'),
        metadata: {
          hashtags: [],
          mentions: []
        },
        analytics: {}
      }
    }),
    prisma.post.create({
      data: {
        campaignId: campaign.id,
        platform: 'instagram',
        content: 'Behind the scenes of our latest campaign creation! 🎬✨ #Marketing #BehindTheScenes #ContentCreation',
        status: 'draft',
        metadata: {
          hashtags: ['#Marketing', '#BehindTheScenes', '#ContentCreation'],
          mentions: []
        },
        analytics: {}
      }
    })
  ]);

  console.log(`✅ Created ${posts.length} sample posts`);

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