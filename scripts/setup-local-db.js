#!/usr/bin/env node

/**
 * Setup Local Development Database
 * This script sets up a local SQLite database for development
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up local development database...\n');

// Step 1: Check if using SQLite or PostgreSQL
const envPath = path.join(process.cwd(), '.env.development');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.development not found!');
  console.log('   Run: cp .env.development.example .env.development');
  process.exit(1);
}

// Step 2: Copy SQLite schema if needed
const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const usingSQLite = dbUrl.includes('file:');

if (usingSQLite) {
  console.log('📦 Using SQLite for local development');
  
  // Backup existing schema
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const backupPath = path.join(process.cwd(), 'prisma', 'schema.postgres.backup');
  
  if (fs.existsSync(schemaPath)) {
    console.log('   Backing up PostgreSQL schema...');
    fs.copyFileSync(schemaPath, backupPath);
  }
  
  // Use SQLite schema
  const sqliteSchemaPath = path.join(process.cwd(), 'prisma', 'schema.sqlite.prisma');
  if (fs.existsSync(sqliteSchemaPath)) {
    console.log('   Switching to SQLite schema...');
    fs.copyFileSync(sqliteSchemaPath, schemaPath);
  }
} else {
  console.log('📦 Using PostgreSQL');
}

// Step 3: Push schema to database
console.log('\n📝 Creating database tables...');
try {
  execSync('npx prisma db push --skip-generate', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
} catch (error) {
  console.error('❌ Failed to create tables:', error.message);
  process.exit(1);
}

// Step 4: Generate Prisma Client
console.log('\n🔧 Generating Prisma Client...');
try {
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
} catch (error) {
  console.error('❌ Failed to generate client:', error.message);
  process.exit(1);
}

// Step 5: Seed initial data
console.log('\n🌱 Seeding initial data...');

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

async function seed() {
  try {
    // Check if demo user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'demo@synthex.com' }
    });

    if (!existingUser) {
      // Create demo user
      const hashedPassword = await bcrypt.hash('demo123', 10);
      const demoUser = await prisma.user.create({
        data: {
          email: 'demo@synthex.com',
          password: hashedPassword,
          name: 'Demo User',
          emailVerified: true,
          authProvider: 'local'
        }
      });
      console.log('   ✅ Created demo user: demo@synthex.com');

      // Create sample campaign
      const campaign = await prisma.campaign.create({
        data: {
          name: 'Sample Marketing Campaign',
          description: 'A sample campaign to demonstrate features',
          platform: 'multi',
          status: 'active',
          userId: demoUser.id,
          content: JSON.stringify({
            title: 'AI-Powered Marketing',
            description: 'Boost your social media presence'
          })
        }
      });
      console.log('   ✅ Created sample campaign');

      // Create sample posts
      await prisma.post.createMany({
        data: [
          {
            content: '🚀 Excited to launch our new AI-powered marketing platform!',
            platform: 'twitter',
            status: 'published',
            campaignId: campaign.id,
            publishedAt: new Date()
          },
          {
            content: 'Transform your social media strategy with AI-driven insights.',
            platform: 'linkedin',
            status: 'scheduled',
            campaignId: campaign.id,
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        ]
      });
      console.log('   ✅ Created sample posts');
    } else {
      console.log('   ℹ️ Demo user already exists');
    }

    // Create test user
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@synthex.com' }
    });

    if (!testUser) {
      const hashedPassword = await bcrypt.hash('test123', 10);
      await prisma.user.create({
        data: {
          email: 'test@synthex.com',
          password: hashedPassword,
          name: 'Test User',
          emailVerified: true,
          authProvider: 'local'
        }
      });
      console.log('   ✅ Created test user: test@synthex.com');
    }

  } catch (error) {
    console.error('   ❌ Seeding failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed().then(() => {
  console.log('\n✅ Local database setup complete!');
  console.log('\n📋 Available test accounts:');
  console.log('   • demo@synthex.com / demo123');
  console.log('   • test@synthex.com / test123');
  console.log('\n🎯 Next steps:');
  console.log('   1. Restart your dev server: npm run dev');
  console.log('   2. Test login at: http://localhost:3000/login');
  console.log('   3. View database: npx prisma studio');
});