import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create demo user
  const demoPassword = await bcrypt.hash('demo123!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@synthex.com' },
    update: {},
    create: {
      email: 'demo@synthex.com',
      password: demoPassword,
      name: 'Demo User',
      // Database expects DateTime, not boolean
      emailVerified: new Date(),
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
  const adminPassword = await bcrypt.hash('Admin123!@#', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@synthex.com' },
    update: {},
    create: {
      email: 'admin@synthex.com',
      password: adminPassword,
      name: 'Admin User',
      // Database expects DateTime, not boolean
      emailVerified: new Date(),
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