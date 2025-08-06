const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.znyjoyjsvjotlzjppzal:lX2WLK2mB8Ucrjdv@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function main() {
  console.log('🌱 Seeding production database...');
  
  try {
    // Hash the demo password
    const demoPassword = await bcrypt.hash('demo123!', 12);
    
    // Create or update demo user
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@synthex.com' },
      update: {
        password: demoPassword,
        name: 'Demo User',
        emailVerified: true
      },
      create: {
        email: 'demo@synthex.com',
        password: demoPassword,
        name: 'Demo User',
        emailVerified: true
      }
    });

    console.log('✅ Demo user created/updated:', demoUser.email);
    
    // Create some sample data for the demo user
    const campaign = await prisma.campaign.upsert({
      where: { 
        id: 'demo-campaign-1' 
      },
      update: {
        name: 'Summer Product Launch',
        description: 'Q3 2025 Product Launch Campaign',
        platform: 'multi-platform',
        status: 'active'
      },
      create: {
        id: 'demo-campaign-1',
        name: 'Summer Product Launch',
        description: 'Q3 2025 Product Launch Campaign',
        platform: 'multi-platform',
        status: 'active',
        userId: demoUser.id,
        content: {
          posts: [
            {
              title: 'Introducing Our Latest Innovation',
              content: 'Get ready for something amazing...',
              platform: 'twitter'
            }
          ]
        }
      }
    });
    
    console.log('✅ Sample campaign created');
    
    const project = await prisma.project.upsert({
      where: { 
        id: 'demo-project-1' 
      },
      update: {
        name: 'Brand Refresh 2025',
        description: 'Complete brand identity refresh',
        type: 'marketing'
      },
      create: {
        id: 'demo-project-1',
        name: 'Brand Refresh 2025',
        description: 'Complete brand identity refresh',
        type: 'marketing',
        userId: demoUser.id,
        data: {
          status: 'in-progress',
          tasks: [
            'Logo redesign',
            'Color palette update',
            'Typography selection'
          ]
        }
      }
    });
    
    console.log('✅ Sample project created');
    
    console.log('✅ Production database seeded successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });