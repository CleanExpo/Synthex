#!/usr/bin/env node
/**
 * Fix PrismaClient Import Script
 *
 * @task UNI-436 - Database Connection Pooling
 *
 * This script fixes duplicate PrismaClient instantiations across the codebase
 * by replacing them with imports from the singleton in @/lib/prisma
 */

const fs = require('fs');
const path = require('path');

// Files to fix (exclude test files, documentation, and the main prisma.ts file)
const filesToFix = [
  'app/api/auth/login/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/auth/request-reset/route.ts',
  'app/api/auth/unified/route.ts',
  'app/api/auth/user/route.ts',
  'app/api/onboarding/route.ts',
  'app/api/social/post/route.ts',
  'app/api/stats/route.ts',
  'src/services/analytics.service.ts',
  'src/services/emailService.ts',
  'src/services/oauth.ts',
  'src/services/team-collaboration.service.ts',
  'lib/analytics/analytics-tracker.ts',
  'lib/email/email-service.ts',
];

// Patterns to replace
const replacements = [
  {
    // Pattern 1: import { PrismaClient } from '@prisma/client'; ... const prisma = new PrismaClient();
    search: /import\s*\{\s*PrismaClient\s*\}\s*from\s*['"]@prisma\/client['"];?\s*\n+(?:.*\n)*?const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\);?/g,
    replace: "import { prisma } from '@/lib/prisma';"
  },
  {
    // Pattern 2: Just the PrismaClient import when prisma is already declared elsewhere
    search: /import\s*\{\s*PrismaClient\s*\}\s*from\s*['"]@prisma\/client['"];?\n/g,
    replace: "import { prisma } from '@/lib/prisma';\n"
  },
  {
    // Pattern 3: const prisma = new PrismaClient() on its own line
    search: /const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\);?\n/g,
    replace: ''
  }
];

function fixFile(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping (not found): ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Check if already using singleton
  if (content.includes("from '@/lib/prisma'") || content.includes('from "@/lib/prisma"')) {
    console.log(`✅ Already fixed: ${filePath}`);
    return false;
  }

  // Check if file has PrismaClient
  if (!content.includes('PrismaClient') && !content.includes('new PrismaClient')) {
    console.log(`⏭️  No PrismaClient: ${filePath}`);
    return false;
  }

  // Apply replacements
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }

  // Clean up any duplicate empty lines
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`🔧 Fixed: ${filePath}`);
    return true;
  }

  console.log(`⏭️  No changes needed: ${filePath}`);
  return false;
}

function main() {
  console.log('═'.repeat(60));
  console.log('Fixing PrismaClient imports across codebase');
  console.log('═'.repeat(60));
  console.log('');

  let fixedCount = 0;

  for (const file of filesToFix) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`Completed: ${fixedCount} files fixed`);
  console.log('═'.repeat(60));
}

main();
