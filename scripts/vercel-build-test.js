#!/usr/bin/env node

/**
 * Vercel Build Test Script
 * Simulates Vercel's build process locally to catch issues before deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n🔧 VERCEL BUILD TEST - Simulating Production Build\n'));

let errors = [];
let warnings = [];

// Step 1: Clean previous builds
console.log(chalk.yellow('Step 1: Cleaning previous builds...'));
try {
  execSync('rm -rf .next out dist', { stdio: 'inherit' });
  console.log(chalk.green('✓ Build directories cleaned'));
} catch (error) {
  console.log(chalk.yellow('⚠ Could not clean build directories (may not exist)'));
}

// Step 2: Check Node version
console.log(chalk.yellow('\nStep 2: Checking Node version...'));
try {
  const nodeVersion = process.version;
  console.log(`Current Node version: ${nodeVersion}`);
  if (!nodeVersion.startsWith('v22')) {
    warnings.push('Node version should be 22.x for Vercel compatibility');
  }
  console.log(chalk.green('✓ Node version checked'));
} catch (error) {
  errors.push(`Node version check failed: ${error.message}`);
}

// Step 3: Install dependencies (simulating Vercel's npm ci)
console.log(chalk.yellow('\nStep 3: Installing dependencies with npm ci...'));
try {
  execSync('npm ci --legacy-peer-deps', { stdio: 'inherit' });
  console.log(chalk.green('✓ Dependencies installed'));
} catch (error) {
  errors.push(`Dependency installation failed: ${error.message}`);
  console.log(chalk.red('✗ Failed to install dependencies'));
}

// Step 4: Generate Prisma Client
console.log(chalk.yellow('\nStep 4: Generating Prisma Client...'));
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log(chalk.green('✓ Prisma Client generated'));
} catch (error) {
  errors.push(`Prisma generation failed: ${error.message}`);
  console.log(chalk.red('✗ Failed to generate Prisma Client'));
}

// Step 5: Type checking
console.log(chalk.yellow('\nStep 5: Running TypeScript type checking...'));
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log(chalk.green('✓ TypeScript types valid'));
} catch (error) {
  warnings.push(`TypeScript errors found: ${error.message}`);
  console.log(chalk.yellow('⚠ TypeScript type errors (non-blocking)'));
}

// Step 6: Check environment variables
console.log(chalk.yellow('\nStep 6: Checking environment variables...'));
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  warnings.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.log(chalk.yellow(`⚠ Missing ${missingEnvVars.length} environment variables`));
} else {
  console.log(chalk.green('✓ All critical environment variables present'));
}

// Step 7: Build the application
console.log(chalk.yellow('\nStep 7: Building Next.js application...'));
console.log(chalk.cyan('This may take a few minutes...'));
try {
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Run the actual build
  execSync('next build', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log(chalk.green('✓ Next.js build successful'));
} catch (error) {
  errors.push(`Next.js build failed: ${error.message}`);
  console.log(chalk.red('✗ Next.js build failed'));
}

// Step 8: Check build output
console.log(chalk.yellow('\nStep 8: Checking build output...'));
const buildOutputExists = fs.existsSync(path.join(process.cwd(), '.next'));
if (buildOutputExists) {
  console.log(chalk.green('✓ Build output generated'));
  
  // Check for static pages
  const staticDir = path.join(process.cwd(), '.next', 'static');
  if (fs.existsSync(staticDir)) {
    console.log(chalk.green('✓ Static assets generated'));
  } else {
    warnings.push('No static assets found in build output');
  }
} else {
  errors.push('No .next directory found after build');
}

// Step 9: Test API routes
console.log(chalk.yellow('\nStep 9: Checking API routes...'));
const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
if (fs.existsSync(apiDir)) {
  const apiRoutes = [];
  function scanDir(dir, prefix = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, path.join(prefix, file));
      } else if (file === 'route.ts' || file === 'route.js') {
        apiRoutes.push(prefix);
      }
    });
  }
  scanDir(apiDir, '/api');
  console.log(chalk.green(`✓ Found ${apiRoutes.length} API routes`));
} else {
  warnings.push('No API directory found');
}

// Final Report
console.log(chalk.blue.bold('\n📊 BUILD TEST REPORT\n'));

if (errors.length === 0 && warnings.length === 0) {
  console.log(chalk.green.bold('✅ BUILD TEST PASSED - Ready for Vercel deployment!\n'));
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(chalk.red.bold(`❌ ${errors.length} ERRORS (must fix before deployment):`));
    errors.forEach((error, i) => {
      console.log(chalk.red(`  ${i + 1}. ${error}`));
    });
  }
  
  if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`\n⚠️  ${warnings.length} WARNINGS (should review):`));
    warnings.forEach((warning, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${warning}`));
    });
  }
  
  console.log(chalk.red.bold('\n❌ BUILD TEST FAILED - Fix issues before deployment\n'));
  process.exit(1);
}
