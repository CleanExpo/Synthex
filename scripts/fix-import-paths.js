#!/usr/bin/env node

/**
 * Fix all import path issues in the codebase
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Map of incorrect imports to correct imports
const importMappings = [
  // Redis imports
  { from: "@/lib/redis-unified", to: "@/src/lib/redis-unified" },
  { from: "@/lib/redis-client", to: "@/lib/redis-client" }, // This one is correct
  { from: "@/lib/redis", to: "@/src/lib/redis" },
  
  // Auth imports  
  { from: "@/lib/auth/signInFlow", to: "@/src/lib/auth/signInFlow" },
  { from: "@/lib/auth/monitoring", to: "@/src/lib/auth/monitoring" },
  { from: "@/lib/auth/api-key-manager", to: "@/src/lib/auth/api-key-manager" },
  { from: "@/lib/auth/oauth-testing", to: "@/src/lib/auth/oauth-testing" },
  
  // AI imports
  { from: "@/lib/ai/content-generator", to: "@/src/lib/ai/content-generator" },
  { from: "@/lib/ai/agents/strategic-marketing/brand-orchestrator", to: "@/src/lib/ai/agents/strategic-marketing/brand-orchestrator" },
  { from: "@/lib/ai/openrouter", to: "@/src/lib/ai/openrouter" },
  
  // Supabase imports
  { from: "@/lib/supabase-server", to: "@/src/lib/supabase-server" },
  { from: "@/lib/supabase-client", to: "@/src/lib/supabase-client" },
  { from: "@/lib/supabase", to: "@/src/lib/supabase" },
  
  // Other lib imports
  { from: "@/lib/security/", to: "@/src/lib/security/" },
  { from: "@/lib/ux/", to: "@/src/lib/ux/" },
  { from: "@/lib/marketing/", to: "@/src/lib/marketing/" },
  { from: "@/lib/viral-patterns", to: "@/src/lib/viral-patterns" },
  { from: "@/lib/constants", to: "@/src/lib/constants" },
  { from: "@/lib/utils", to: "@/src/lib/utils" }
];

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    importMappings.forEach(mapping => {
      // Check for both import and require statements
      const importRegex = new RegExp(`from ['"]${mapping.from}['"]`, 'g');
      const requireRegex = new RegExp(`require\\(['"]${mapping.from}['"]\\)`, 'g');
      
      if (content.match(importRegex) || content.match(requireRegex)) {
        content = content.replace(importRegex, `from '${mapping.to}'`);
        content = content.replace(requireRegex, `require('${mapping.to}')`);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    
    return false;
  } catch (error) {
    log(`  Error processing ${filePath}: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  log('🔧 Fixing Import Paths', 'blue');
  log('=' .repeat(50), 'cyan');
  
  // Find all TypeScript and JavaScript files
  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    ignore: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'out/**',
      'coverage/**',
      '.vercel/**'
    ]
  });
  
  log(`Found ${files.length} files to check`, 'yellow');
  
  let fixedCount = 0;
  
  files.forEach(file => {
    if (fixImportsInFile(file)) {
      fixedCount++;
    }
  });
  
  log('=' .repeat(50), 'cyan');
  log(`✅ Fixed ${fixedCount} files`, 'green');
  
  // Also update tsconfig paths
  log('Updating tsconfig.json paths...', 'cyan');
  
  try {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    
    // Ensure both @/lib and @/src/lib paths are mapped
    tsConfig.compilerOptions.paths = {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*", "./src/lib/*"],
      "@/src/*": ["./src/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/utils/*": ["./utils/*"],
      "@/types/*": ["./types/*"],
      "@/app/*": ["./app/*"],
      "@/styles/*": ["./styles/*"],
      "@/public/*": ["./public/*"]
    };
    
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsConfig, null, 2));
    log('✅ Updated tsconfig.json', 'green');
  } catch (error) {
    log(`Error updating tsconfig.json: ${error.message}`, 'red');
  }
  
  log('', 'reset');
  log('Import paths have been fixed!', 'green');
  log('Now run:', 'yellow');
  log('  npm run build', 'cyan');
}

main();