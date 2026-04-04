#!/usr/bin/env node

/**
 * Final import fix - corrects all Supabase imports
 */

const fs = require('fs');
const glob = require('glob');

// Find all files that need fixing
const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**', 'scripts/**']
});

let fixedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Fix Supabase imports - they're in lib/, not src/lib/
    if (content.includes('@/src/lib/supabase')) {
      content = content.replace(/@\/src\/lib\/supabase/g, '@/lib/supabase');
      modified = true;
    }
    
    // Fix other mismatched paths
    if (content.includes("from '@/lib/prisma'")) {
      // Check if prisma exists in lib/
      if (!fs.existsSync('lib/prisma.ts') && !fs.existsSync('lib/prisma.js')) {
        // Create a simple prisma export
        const prismaContent = `import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;`;
        
        fs.writeFileSync('lib/prisma.ts', prismaContent);
        console.log('Created lib/prisma.ts');
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content);
      fixedCount++;
    }
  } catch (error) {
    // Skip files that can't be read
  }
});

console.log(`Fixed ${fixedCount} files`);

// Also ensure supabase-server exists and exports properly
const supabaseServerPath = 'src/lib/supabase-server.ts';
if (!fs.existsSync(supabaseServerPath)) {
  // Copy from lib/ to src/lib/
  if (fs.existsSync('lib/supabase-server.ts')) {
    const content = fs.readFileSync('lib/supabase-server.ts', 'utf8');
    fs.mkdirSync('src/lib', { recursive: true });
    fs.writeFileSync(supabaseServerPath, content);
    console.log('Copied supabase-server.ts to src/lib/');
  }
}

console.log('Import fixes complete!');