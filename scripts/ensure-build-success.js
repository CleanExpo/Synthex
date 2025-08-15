#!/usr/bin/env node

/**
 * SYNTHEX Build Success Ensurer
 * This script ensures all files exist and imports are correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Ensuring SYNTHEX build success...\n');

// Step 1: Create missing utility files
console.log('Creating missing utility files...');

// Create lib/utils.ts if it doesn't exist
if (!fs.existsSync('lib/utils.ts')) {
  const utilsContent = `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
`;
  fs.writeFileSync('lib/utils.ts', utilsContent);
  console.log('✅ Created lib/utils.ts');
}

// Create src/lib/utils.ts as a re-export
if (!fs.existsSync('src/lib/utils.ts')) {
  fs.mkdirSync('src/lib', { recursive: true });
  const reExportContent = `export * from '@/lib/utils';`;
  fs.writeFileSync('src/lib/utils.ts', reExportContent);
  console.log('✅ Created src/lib/utils.ts re-export');
}

// Step 2: Ensure Prisma client exists
console.log('\nEnsuring Prisma client...');
if (!fs.existsSync('lib/prisma.ts')) {
  const prismaContent = `import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;`;
  
  fs.writeFileSync('lib/prisma.ts', prismaContent);
  console.log('✅ Created lib/prisma.ts');
}

// Step 3: Fix all remaining import issues
console.log('\nFixing remaining imports...');

const glob = require('glob');
const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**', 'scripts/**']
});

let fixedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Fix utils imports
    if (content.includes("from '@/src/lib/utils'") && !content.includes('src/lib/utils.ts')) {
      // Check if the file should use lib/utils directly
      if (fs.existsSync('lib/utils.ts')) {
        content = content.replace(/@\/src\/lib\/utils/g, '@/lib/utils');
        modified = true;
      }
    }
    
    // Fix constants imports
    if (content.includes("from '@/src/lib/constants'")) {
      if (!fs.existsSync('src/lib/constants.ts') && !fs.existsSync('lib/constants.ts')) {
        // Create constants file
        const constantsContent = `export const APP_NAME = 'SYNTHEX';
export const APP_VERSION = '2.0.1';
export const API_VERSION = 'v1';
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de'];`;
        
        fs.writeFileSync('lib/constants.ts', constantsContent);
        content = content.replace(/@\/src\/lib\/constants/g, '@/lib/constants');
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content);
      fixedCount++;
    }
  } catch (error) {
    // Skip errors
  }
});

console.log(`✅ Fixed ${fixedCount} files`);

// Step 4: Generate Prisma client
console.log('\nGenerating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.log('⚠️ Prisma generation skipped (may not be needed)');
}

// Step 5: Clear Next.js cache
console.log('\nClearing Next.js cache...');
try {
  if (fs.existsSync('.next')) {
    fs.rmSync('.next', { recursive: true, force: true });
    console.log('✅ Cleared .next cache');
  }
} catch (error) {
  console.log('⚠️ Could not clear cache');
}

// Step 6: Final build attempt
console.log('\n🏗️ Running final build...\n');
console.log('This may take a few minutes...\n');

try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\n✅ BUILD SUCCESSFUL! 🎉');
  console.log('\nYour application is ready for deployment!');
  console.log('\nNext steps:');
  console.log('1. Commit changes: git add . && git commit -m "fix: complete production deployment fixes"');
  console.log('2. Push to GitHub: git push origin main');
  console.log('3. Deploy to Vercel: vercel --prod --yes');
} catch (error) {
  console.log('\n❌ Build still failing. Manual intervention needed.');
  console.log('Check the errors above and fix them manually.');
}