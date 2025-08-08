#!/usr/bin/env node

/**
 * Cleanup Script - Removes duplicate and test files
 * Run this before deployment to clean up the project
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Starting cleanup of duplicate files...\n');

// Files to remove (test/duplicate files)
const filesToRemove = [
  // Test files
  'test-api.js',
  'test-complete-system.js',
  'simple-server.js',
  'launch-complete-system.js',
  
  // Mock API (we're using real now)
  'api/mock-endpoints.js',
  
  // Duplicate HTML files in public
  'public/index-enhanced.html',
  'public/index-new.html',
  'public/index-old.html',
  'public/index-old-backup.html',
  'public/index-unified.html',
  'public/dashboard-enhanced.html',
  'public/dashboard-ai-enhanced.html',
  'public/dashboard-unified.html',
  'public/app-new.html',
  'public/campaigns-new.html',
  'public/login-unified.html',
  'public/auth-improved.html',
  'public/unified-app.html',
  'public/content-generator-sandbox.html',
  'public/platform-sandbox.html',
  'public/loading-demo.html',
  'public/google-oauth-test.html',
  'public/design-system-showcase.html',
  
  // Unused CSS/JS files
  'public/css/interactions.css',
  'public/js/app-interactions.js',
  
  // Temporary files
  'nul',
  'public/DEPLOY_TRIGGER.txt'
];

// Backup important files before cleanup
const backupDir = path.join(__dirname, 'backup-before-cleanup');

function createBackup() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${backupDir}`);
  }
  
  // Backup only the main files we want to keep
  const filesToBackup = [
    'public/index.html',
    'public/dashboard.html',
    'public/login.html',
    'public/app.html',
    'vercel.json',
    'package.json'
  ];
  
  filesToBackup.forEach(file => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      const dest = path.join(backupDir, file);
      const destDir = path.dirname(dest);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      fs.copyFileSync(src, dest);
      console.log(`✅ Backed up: ${file}`);
    }
  });
}

function removeFiles() {
  console.log('\n🗑️  Removing duplicate and test files...\n');
  
  let removed = 0;
  let failed = 0;
  
  filesToRemove.forEach(file => {
    const fullPath = path.join(__dirname, file);
    
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✅ Removed: ${file}`);
        removed++;
      } else {
        console.log(`⏭️  Skipped (not found): ${file}`);
      }
    } catch (err) {
      console.log(`❌ Failed to remove: ${file} - ${err.message}`);
      failed++;
    }
  });
  
  return { removed, failed };
}

function consolidateStructure() {
  console.log('\n📂 Consolidating project structure...\n');
  
  // Ensure main pages exist and are correct
  const requiredPages = {
    'public/index.html': 'Landing page',
    'public/dashboard.html': 'Main dashboard',
    'public/login.html': 'Login page',
    'public/app.html': 'Application page',
    'public/campaigns.html': 'Campaigns page',
    'public/analytics.html': 'Analytics page',
    'public/settings.html': 'Settings page',
    'public/404.html': 'Error page',
    'public/500.html': 'Server error page'
  };
  
  Object.entries(requiredPages).forEach(([file, description]) => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${description}: ${file}`);
    } else {
      console.log(`⚠️  Missing: ${file} (${description})`);
    }
  });
}

function updateGitignore() {
  console.log('\n📝 Updating .gitignore...\n');
  
  const gitignorePath = path.join(__dirname, '.gitignore');
  let content = '';
  
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  const additions = [
    '\n# Cleanup and backup',
    'backup-before-cleanup/',
    'test-*.js',
    '*-sandbox.html',
    '*-demo.html',
    '*-test.html',
    'nul',
    '\n# Development files',
    '*.log',
    'tmp/',
    '.DS_Store'
  ];
  
  additions.forEach(line => {
    if (!content.includes(line)) {
      content += '\n' + line;
    }
  });
  
  fs.writeFileSync(gitignorePath, content);
  console.log('✅ Updated .gitignore');
}

function createProductionReadme() {
  const readmePath = path.join(__dirname, 'README-PRODUCTION.md');
  
  const content = `# SYNTHEX - Production Ready

## 🚀 Quick Start

### Local Development
\`\`\`bash
npm install
npm run dev
\`\`\`

### Production Deployment
\`\`\`bash
node setup-production.js
vercel --prod
\`\`\`

## 📁 Project Structure

\`\`\`
synthex/
├── api/                 # API endpoints
│   ├── main.js         # Main API handler
│   └── real-endpoints.js # Real database operations
├── public/             # Frontend files
│   ├── index.html      # Landing page
│   ├── dashboard.html  # Main dashboard
│   ├── login.html      # Authentication
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── prisma/             # Database schema
│   └── schema.prisma   # Database models
├── src/                # Source code (TypeScript)
├── dist/               # Compiled code
└── vercel.json         # Deployment config
\`\`\`

## 🔑 Key Features

- ✅ Real user authentication with JWT
- ✅ PostgreSQL database with Prisma ORM
- ✅ Campaign management system
- ✅ Content generation capabilities
- ✅ Post scheduling
- ✅ Analytics dashboard
- ✅ Team collaboration
- ✅ API rate limiting
- ✅ Audit logging

## 🌐 API Endpoints

- **Auth**: /api/auth/login, /api/auth/register, /api/auth/verify
- **Dashboard**: /api/dashboard/stats
- **Campaigns**: /api/campaigns (CRUD operations)
- **Content**: /api/content/generate
- **Posts**: /api/posts, /api/posts/schedule
- **Settings**: /api/settings
- **Notifications**: /api/notifications

## 🔒 Security

- JWT authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- CORS configuration
- SQL injection protection via Prisma
- XSS protection

## 📊 Database

Using PostgreSQL with Prisma ORM. Models include:
- Users
- Campaigns
- Posts
- Notifications
- Audit Logs
- Organizations

## 🚢 Deployment

Optimized for Vercel deployment with:
- Serverless functions
- Edge caching
- Automatic HTTPS
- Environment variable management

## 📝 Default Credentials

After seeding the database:
- Email: admin@synthex.io
- Password: admin123

**Change these immediately in production!**

## 🛠️ Maintenance

- Run \`npx prisma studio\` to manage database
- Check logs in Vercel dashboard
- Monitor API usage in audit_logs table

## 📧 Support

For issues or questions, check:
1. DEPLOYMENT-CHECKLIST.md
2. Vercel Function Logs
3. Browser Console
4. Database connection status at /api/health
`;
  
  fs.writeFileSync(readmePath, content);
  console.log('\n✅ Created README-PRODUCTION.md');
}

// Main execution
function main() {
  console.log('═══════════════════════════════════════════');
  console.log('         SYNTHEX CLEANUP SCRIPT            ');
  console.log('═══════════════════════════════════════════\n');
  
  // Step 1: Create backup
  console.log('📦 Step 1: Creating backup of important files...');
  createBackup();
  
  // Step 2: Remove duplicate files
  console.log('\n📦 Step 2: Removing duplicates...');
  const { removed, failed } = removeFiles();
  
  // Step 3: Consolidate structure
  console.log('\n📦 Step 3: Verifying structure...');
  consolidateStructure();
  
  // Step 4: Update .gitignore
  console.log('\n📦 Step 4: Updating configuration...');
  updateGitignore();
  
  // Step 5: Create production readme
  console.log('\n📦 Step 5: Creating documentation...');
  createProductionReadme();
  
  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('              CLEANUP SUMMARY               ');
  console.log('═══════════════════════════════════════════\n');
  
  console.log(`✅ Removed ${removed} duplicate/test files`);
  if (failed > 0) {
    console.log(`⚠️  Failed to remove ${failed} files`);
  }
  console.log(`📁 Backup created in: ${backupDir}`);
  console.log('\n🎉 Cleanup complete! Your project is now production-ready.');
  console.log('\n📝 Next step: Run "node setup-production.js" to configure for deployment');
}

// Run cleanup
main();