#!/usr/bin/env node

/**
 * SYNTHEX Automated Lint Fixer
 * Automatically fixes common lint issues in the codebase
 */

const fs = require('fs').promises;
const path = require('path');

// Lint issues to fix
const fixes = [
  {
    file: 'app/dashboard/admin/page.tsx',
    line: 57,
    issue: 'missing dependency',
    fix: async (content) => {
      // Add fetchStats to dependency array
      return content.replace(
        /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/,
        (match) => match.replace('[]', '[fetchStats]')
      );
    }
  },
  {
    file: 'app/dashboard/sandbox/page.tsx',
    line: 139,
    issue: 'missing dependency',
    fix: async (content) => {
      // Add validateContent to dependency array
      const lines = content.split('\n');
      if (lines[138] && lines[138].includes('useEffect')) {
        lines[139] = lines[139].replace('[]', '[validateContent]');
      }
      return lines.join('\n');
    }
  },
  {
    file: 'app/dashboard/sandbox/page.tsx',
    lines: [203, 247, 288],
    issue: 'missing alt text',
    fix: async (content) => {
      // Add alt props to images
      return content
        .replace(/<img(?![^>]*alt=)/g, '<img alt=""')
        .replace(/<Image(?![^>]*alt=)/g, '<Image alt=""');
    }
  },
  {
    file: 'app/dashboard/settings/page.tsx',
    line: 96,
    issue: 'missing dependency',
    fix: async (content) => {
      return content.replace(
        /useEffect\(\(\) => \{[\s\S]*?loadUserData[\s\S]*?\}, \[\]\)/,
        (match) => match.replace('[]', '[loadUserData]')
      );
    }
  },
  {
    file: 'components/CustomReportBuilder.tsx',
    line: 128,
    issue: 'missing alt text',
    fix: async (content) => {
      return content.replace(/<Image(?![^>]*alt=)/g, '<Image alt="Report preview"');
    }
  },
  {
    file: 'components/FileUpload.tsx',
    line: 165,
    issue: 'missing alt text',
    fix: async (content) => {
      return content.replace(/<Image(?![^>]*alt=)/g, '<Image alt="Upload preview"');
    }
  },
  {
    file: 'components/RichTextEditor.tsx',
    line: 260,
    issue: 'missing alt text',
    fix: async (content) => {
      return content.replace(/<Image(?![^>]*alt=)/g, '<Image alt="Embedded content"');
    }
  },
  {
    file: 'src/components/PinterestOptimizer.jsx',
    line: 275,
    issue: 'missing alt text',
    fix: async (content) => {
      return content.replace(/<img(?![^>]*alt=)/g, '<img alt="Pin preview"');
    }
  },
  // Fix anonymous default exports
  {
    file: 'lib/i18n/index.ts',
    line: 30,
    issue: 'anonymous default export',
    fix: async (content) => {
      return content.replace(
        /export default \{/,
        'const i18nConfig = {\n// Export configuration\nexport default i18nConfig;'
      );
    }
  },
  {
    file: 'src/config/security.config.ts',
    line: 389,
    issue: 'anonymous default export',
    fix: async (content) => {
      const lines = content.split('\n');
      const exportLine = lines.findIndex(line => line.includes('export default {'));
      if (exportLine !== -1) {
        lines.splice(exportLine, 0, 'const securityConfig = {');
        lines[exportLine + 1] = '};';
        lines.push('export default securityConfig;');
      }
      return lines.join('\n');
    }
  },
  {
    file: 'src/lib/session/session-manager.js',
    line: 427,
    issue: 'anonymous default export',
    fix: async (content) => {
      return content.replace(
        /export default new SessionManager\(\)/,
        'const sessionManager = new SessionManager();\nexport default sessionManager'
      );
    }
  },
  {
    file: 'src/services/emailService.ts',
    line: 513,
    issue: 'anonymous default export',
    fix: async (content) => {
      return content.replace(
        /export default new EmailService\(\)/,
        'const emailService = new EmailService();\nexport default emailService'
      );
    }
  }
];

// Helper to add useCallback wrappers for missing dependencies
function wrapWithUseCallback(content, functionName) {
  const regex = new RegExp(`const ${functionName} = (async )?\\(.*?\\) => \\{`, 'g');
  return content.replace(regex, (match) => {
    const isAsync = match.includes('async');
    return `const ${functionName} = useCallback(${isAsync ? 'async ' : ''}${match.substring(match.indexOf('('))}`;
  });
}

// Main execution
async function fixLintIssues() {
  console.log('🔧 Starting automated lint fixes for SYNTHEX...\n');
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const fix of fixes) {
    try {
      const filePath = path.resolve(process.cwd(), fix.file);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.log(`⚠️  Skipping ${fix.file} (file not found)`);
        continue;
      }
      
      // Read file content
      let content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;
      
      // Apply fix
      if (fix.fix) {
        content = await fix.fix(content);
      }
      
      // Write back if changed
      if (content !== originalContent) {
        await fs.writeFile(filePath, content);
        console.log(`✅ Fixed ${fix.file}:${fix.line || fix.lines} - ${fix.issue}`);
        fixedCount++;
      } else {
        console.log(`ℹ️  No changes needed for ${fix.file}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${fix.file}: ${error.message}`);
      errorCount++;
    }
  }
  
  // Fix React Hook dependencies using a more intelligent approach
  const reactFiles = [
    'components/AIABTesting.tsx',
    'components/AIPersonaManager.tsx',
    'components/CollaborationTools.tsx',
    'components/NotificationBell.tsx',
    'components/PredictiveAnalytics.tsx',
    'components/ProductTour.tsx',
    'components/QuickStats.tsx',
    'components/realtime-notifications.tsx',
    'components/ROICalculator.tsx',
    'components/SearchBar.tsx',
    'components/SentimentAnalysis.tsx',
    'components/SmartSuggestions.tsx'
  ];
  
  for (const file of reactFiles) {
    try {
      const filePath = path.resolve(process.cwd(), file);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        continue;
      }
      
      let content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;
      
      // Add useCallback import if not present
      if (!content.includes('useCallback')) {
        content = content.replace(
          /import \{ (.+?) \} from 'react'/,
          (match, imports) => {
            return `import { ${imports}, useCallback } from 'react'`;
          }
        );
      }
      
      // Fix missing dependencies by wrapping functions with useCallback
      // This is a simplified approach - in production, manual review would be better
      const functionsToWrap = content.match(/const (\w+) = (?:async )?\(.*?\) => \{/g);
      if (functionsToWrap) {
        functionsToWrap.forEach(match => {
          const functionName = match.match(/const (\w+)/)[1];
          if (content.includes(`[${functionName}]`)) {
            content = wrapWithUseCallback(content, functionName);
          }
        });
      }
      
      if (content !== originalContent) {
        await fs.writeFile(filePath, content);
        console.log(`✅ Fixed React hooks in ${file}`);
        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ Error fixing ${file}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Fixed: ${fixedCount} issues`);
  console.log(`   ❌ Errors: ${errorCount} issues`);
  console.log('\n✨ Lint fix automation complete!');
  
  // Run lint again to verify
  console.log('\n🔍 Running lint check to verify fixes...');
  const { exec } = require('child_process');
  exec('npm run lint', (error, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  });
}

// Execute
fixLintIssues().catch(console.error);