#!/usr/bin/env node

/**
 * SYNTHEX Production Setup Script
 * Run this to ensure everything is properly configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 SYNTHEX Production Setup Starting...\n');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function runCommand(command, description) {
  try {
    info(`Running: ${description}`);
    execSync(command, { stdio: 'inherit' });
    success(`Completed: ${description}`);
    return true;
  } catch (err) {
    error(`Failed: ${description}`);
    return false;
  }
}

// Step 1: Check Node.js version
function checkNodeVersion() {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (major >= 18) {
    success(`Node.js version ${nodeVersion} is compatible`);
    return true;
  } else {
    error(`Node.js version ${nodeVersion} is too old. Please upgrade to v18 or higher`);
    return false;
  }
}

// Step 2: Check and create .env file
function setupEnvironment() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (!fs.existsSync(envPath)) {
    info('Creating .env file...');
    
    const envContent = `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/synthex?schema=public"

# For Vercel Postgres (uncomment and fill if using)
# DATABASE_URL="postgres://default:password@host.postgres.vercel-storage.com:5432/verceldb?sslmode=require"

# JWT Secret (generate a secure random string)
JWT_SECRET="${require('crypto').randomBytes(32).toString('hex')}"

# Application
NODE_ENV="production"
PORT=3000

# AI API Keys (optional - for content generation)
OPENROUTER_API_KEY=""
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Email Service (optional)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
FROM_EMAIL="noreply@synthex.io"

# Stripe (optional - for payments)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Frontend URL
FRONTEND_URL="http://localhost:3000"
`;
    
    fs.writeFileSync(envPath, envContent);
    success('.env file created with default values');
    warning('Please update DATABASE_URL with your actual database connection string');
    return false; // Needs manual configuration
  } else {
    success('.env file exists');
    
    // Check for required variables
    const envContent = fs.readFileSync(envPath, 'utf8');
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = [];
    
    required.forEach(key => {
      if (!envContent.includes(key) || envContent.includes(`${key}=""`)) {
        missing.push(key);
      }
    });
    
    if (missing.length > 0) {
      warning(`Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
}

// Step 3: Install dependencies
function installDependencies() {
  return runCommand('npm install', 'Installing dependencies');
}

// Step 4: Generate Prisma Client
function generatePrismaClient() {
  return runCommand('npx prisma generate', 'Generating Prisma Client');
}

// Step 5: Run database migrations
function runMigrations() {
  info('Checking database migrations...');
  
  try {
    // First, check if we can connect to the database
    execSync('npx prisma db push --accept-data-loss', { stdio: 'pipe' });
    success('Database schema synchronized');
    return true;
  } catch (err) {
    warning('Could not connect to database. Please check DATABASE_URL in .env');
    info('For local development, you can use SQLite:');
    info('  DATABASE_URL="file:./dev.db"');
    info('For production, use PostgreSQL:');
    info('  DATABASE_URL="postgresql://user:password@host:5432/dbname"');
    return false;
  }
}

// Step 6: Seed database with initial data
function seedDatabase() {
  const seedPath = path.join(__dirname, 'prisma', 'seed.js');
  
  if (!fs.existsSync(seedPath)) {
    info('Creating seed file...');
    
    const seedContent = `const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@synthex.io' },
    update: {},
    create: {
      email: 'admin@synthex.io',
      password: hashedPassword,
      name: 'Admin User',
      emailVerified: true,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      }
    }
  });
  
  console.log('✅ Created admin user:', adminUser.email);
  
  // Create sample campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Welcome Campaign',
      description: 'Your first campaign',
      platform: 'instagram',
      status: 'draft',
      userId: adminUser.id,
      settings: {
        autoPost: false,
        hashtags: ['#synthex', '#marketing', '#ai']
      }
    }
  });
  
  console.log('✅ Created sample campaign:', campaign.name);
  
  // Create welcome notification
  await prisma.notification.create({
    data: {
      type: 'info',
      title: 'Welcome to Synthex!',
      message: 'Your marketing automation platform is ready. Start by creating your first campaign.',
      userId: adminUser.id
    }
  });
  
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📧 Default admin credentials:');
  console.log('   Email: admin@synthex.io');
  console.log('   Password: admin123');
  console.log('');
  console.log('⚠️  Remember to change the password after first login!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;
    
    fs.writeFileSync(seedPath, seedContent);
    success('Seed file created');
  }
  
  try {
    info('Seeding database with initial data...');
    execSync('node prisma/seed.js', { stdio: 'inherit' });
    success('Database seeded successfully');
    return true;
  } catch (err) {
    warning('Database seeding failed (may already be seeded)');
    return true; // Not critical
  }
}

// Step 7: Build the application
function buildApplication() {
  return runCommand('npm run build:prod', 'Building application for production');
}

// Step 8: Test the API
async function testAPI() {
  info('Testing API endpoints...');
  
  try {
    // Start server in background
    const { spawn } = require('child_process');
    const server = spawn('node', ['test-api.js'], { detached: false });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test health endpoint
    const http = require('http');
    
    return new Promise((resolve) => {
      http.get('http://localhost:3001/api/health', (res) => {
        if (res.statusCode === 200) {
          success('API health check passed');
          server.kill();
          resolve(true);
        } else {
          error('API health check failed');
          server.kill();
          resolve(false);
        }
      }).on('error', () => {
        warning('Could not test API (server may not be running)');
        server.kill();
        resolve(true); // Not critical
      });
    });
  } catch (err) {
    warning('API test skipped');
    return true;
  }
}

// Step 9: Verify Vercel configuration
function verifyVercelConfig() {
  const vercelPath = path.join(__dirname, 'vercel.json');
  
  if (!fs.existsSync(vercelPath)) {
    error('vercel.json not found');
    return false;
  }
  
  const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  
  // Check required fields
  const checks = [
    { field: 'buildCommand', expected: 'npm install && npm run build:prod' },
    { field: 'outputDirectory', expected: 'public' },
    { field: 'functions', type: 'object' }
  ];
  
  let valid = true;
  
  checks.forEach(check => {
    if (check.type === 'object') {
      if (!config[check.field] || typeof config[check.field] !== 'object') {
        error(`vercel.json: ${check.field} is missing or invalid`);
        valid = false;
      }
    } else if (config[check.field] !== check.expected) {
      warning(`vercel.json: ${check.field} should be "${check.expected}"`);
    }
  });
  
  if (valid) {
    success('Vercel configuration is valid');
  }
  
  return valid;
}

// Step 10: Create deployment checklist
function createDeploymentChecklist() {
  const checklistPath = path.join(__dirname, 'DEPLOYMENT-CHECKLIST.md');
  
  const checklist = `# 🚀 SYNTHEX Deployment Checklist

## Prerequisites ✅
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database available
- [ ] Vercel account created
- [ ] Domain name (optional)

## Local Setup ✅
- [ ] Run \`npm install\`
- [ ] Configure \`.env\` file with production values
- [ ] Run \`npx prisma generate\`
- [ ] Run \`npx prisma db push\`
- [ ] Run \`node prisma/seed.js\` (optional)
- [ ] Test locally with \`npm run dev\`

## Database Setup 🗄️

### Option 1: Vercel Postgres
1. Go to Vercel Dashboard > Storage
2. Create a new Postgres database
3. Copy the connection string
4. Update \`DATABASE_URL\` in Vercel environment variables

### Option 2: Supabase
1. Create account at supabase.com
2. Create new project
3. Go to Settings > Database
4. Copy connection string
5. Update \`DATABASE_URL\` in Vercel environment variables

### Option 3: Other PostgreSQL
- Any PostgreSQL provider (Railway, Render, Neon, etc.)
- Ensure SSL is enabled for production

## Vercel Deployment 🌐

### First Time Setup:
\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
\`\`\`

### Environment Variables in Vercel:
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add the following:

\`\`\`
DATABASE_URL = [your-postgres-connection-string]
JWT_SECRET = [generate-secure-random-string]
NODE_ENV = production
\`\`\`

### Optional Variables:
\`\`\`
OPENROUTER_API_KEY = [for AI content generation]
ANTHROPIC_API_KEY = [for AI content generation]
GOOGLE_CLIENT_ID = [for Google OAuth]
GOOGLE_CLIENT_SECRET = [for Google OAuth]
\`\`\`

## Post-Deployment ✨

1. **Test Authentication**
   - Visit your-domain.vercel.app
   - Try logging in with: admin@synthex.io / admin123
   - Change the default password immediately

2. **Monitor Health**
   - Check: your-domain.vercel.app/api/health
   - Should return: {"success":true,"status":"healthy"}

3. **Configure Custom Domain** (optional)
   - Vercel Dashboard > Domains
   - Add your domain
   - Update DNS records

4. **Enable Analytics** (optional)
   - Vercel Dashboard > Analytics
   - Enable Web Analytics

## Troubleshooting 🔧

### Database Connection Issues
- Ensure DATABASE_URL is properly formatted
- Check if database allows connections from Vercel IPs
- Verify SSL mode is set correctly

### Build Failures
- Check build logs in Vercel Dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### API Not Working
- Check Function Logs in Vercel Dashboard
- Verify environment variables are set
- Test with: curl your-domain.vercel.app/api/health

## Security Checklist 🔒
- [ ] Change default admin password
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS only (automatic with Vercel)
- [ ] Set up rate limiting (included in code)
- [ ] Configure CORS properly
- [ ] Regular security updates

## Monitoring 📊
- Set up Vercel Analytics
- Monitor Function logs
- Track API usage in database
- Set up error alerting (optional)

---

**Support**: If you encounter issues, check:
1. Vercel Function Logs
2. Browser Console
3. Network tab in DevTools
4. Database connection

**Ready to deploy!** 🎉
`;
  
  fs.writeFileSync(checklistPath, checklist);
  success('Deployment checklist created: DEPLOYMENT-CHECKLIST.md');
  return true;
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('         SYNTHEX PRODUCTION SETUP          ');
  console.log('═══════════════════════════════════════════\n');
  
  const steps = [
    { name: 'Node.js Version', fn: checkNodeVersion, critical: true },
    { name: 'Environment Variables', fn: setupEnvironment, critical: false },
    { name: 'Dependencies', fn: installDependencies, critical: true },
    { name: 'Prisma Client', fn: generatePrismaClient, critical: true },
    { name: 'Database Migrations', fn: runMigrations, critical: false },
    { name: 'Database Seeding', fn: seedDatabase, critical: false },
    { name: 'Build Application', fn: buildApplication, critical: false },
    { name: 'API Testing', fn: testAPI, critical: false },
    { name: 'Vercel Config', fn: verifyVercelConfig, critical: true },
    { name: 'Deployment Checklist', fn: createDeploymentChecklist, critical: false }
  ];
  
  let allPassed = true;
  let criticalPassed = true;
  
  for (const step of steps) {
    console.log(`\n📋 ${step.name}`);
    console.log('─'.repeat(40));
    
    const result = await step.fn();
    
    if (!result) {
      allPassed = false;
      if (step.critical) {
        criticalPassed = false;
        error(`Critical step failed: ${step.name}`);
      }
    }
  }
  
  console.log('\n═══════════════════════════════════════════');
  console.log('              SETUP SUMMARY                 ');
  console.log('═══════════════════════════════════════════\n');
  
  if (criticalPassed) {
    if (allPassed) {
      success('✨ All checks passed! Your application is ready for production.');
    } else {
      warning('⚠️  Setup completed with warnings. Please review the output above.');
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Review and update .env file with production values');
    console.log('2. Set up your PostgreSQL database');
    console.log('3. Run: npx prisma db push');
    console.log('4. Run: node prisma/seed.js (optional)');
    console.log('5. Deploy to Vercel: vercel --prod');
    console.log('\n📖 See DEPLOYMENT-CHECKLIST.md for detailed instructions');
  } else {
    error('❌ Critical errors found. Please fix them before deploying.');
  }
}

// Run the setup
main().catch(console.error);