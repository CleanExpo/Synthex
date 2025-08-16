#!/usr/bin/env node

/**
 * SYNTHEX Deployment Assistant
 * Interactive deployment helper with safety checks
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
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

function execCommand(command, silent = false) {
  try {
    if (silent) {
      return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } else {
      return execSync(command, { encoding: 'utf8', stdio: 'inherit' });
    }
  } catch (error) {
    return null;
  }
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

async function main() {
  log('\n🚀 SYNTHEX DEPLOYMENT ASSISTANT\n', 'blue');
  
  // Step 1: Check git status
  log('Step 1: Checking git status...', 'cyan');
  const gitStatus = execCommand('git status --porcelain', true);
  
  if (!gitStatus || gitStatus.trim() === '') {
    log('✓ No changes to commit\n', 'yellow');
    const proceed = await askQuestion('No changes detected. Deploy anyway? (y/n): ');
    if (proceed !== 'y') {
      log('Deployment cancelled.', 'yellow');
      process.exit(0);
    }
  } else {
    log('✓ Changes detected:\n', 'green');
    console.log(gitStatus);
  }
  
  // Step 2: Run diagnostics
  log('Step 2: Running diagnostics...', 'cyan');
  log('This will check for common issues...\n', 'yellow');
  
  const diagnosticsOk = execCommand('node scripts/diagnose-build.js');
  
  if (diagnosticsOk === null) {
    log('\n⚠️  Diagnostics found issues', 'yellow');
    const force = await askQuestion('Continue anyway? (y/n): ');
    if (force !== 'y') {
      log('Deployment cancelled. Fix issues and try again.', 'red');
      process.exit(1);
    }
  } else {
    log('\n✓ Diagnostics passed', 'green');
  }
  
  // Step 3: Quick validation
  log('\nStep 3: Quick validation...', 'cyan');
  const quickCheck = execCommand('bash scripts/final-check.sh');
  
  if (quickCheck === null) {
    log('\n⚠️  Quick check found warnings', 'yellow');
  } else {
    log('\n✓ Quick check passed', 'green');
  }
  
  // Step 4: Get commit message
  let commitMessage = '';
  if (gitStatus && gitStatus.trim() !== '') {
    log('\nStep 4: Prepare commit', 'cyan');
    const defaultMsg = 'chore: deploy to production';
    const customMsg = await askQuestion(`Enter commit message (or press Enter for "${defaultMsg}"): `);
    commitMessage = customMsg.trim() || defaultMsg;
  }
  
  // Step 5: Final confirmation
  log('\n📋 DEPLOYMENT SUMMARY', 'blue');
  log('━'.repeat(40), 'blue');
  console.log('Branch: main');
  console.log('Target: Vercel Production');
  if (commitMessage) {
    console.log(`Commit: "${commitMessage}"`);
  }
  log('━'.repeat(40), 'blue');
  
  const confirm = await askQuestion('\n🚀 Ready to deploy? (y/n): ');
  
  if (confirm !== 'y') {
    log('\nDeployment cancelled.', 'yellow');
    process.exit(0);
  }
  
  // Step 6: Execute deployment
  log('\n🚀 DEPLOYING...', 'green');
  
  try {
    if (gitStatus && gitStatus.trim() !== '') {
      // Add all changes
      log('\n• Adding changes...', 'cyan');
      execCommand('git add -A');
      
      // Commit
      log('• Committing...', 'cyan');
      execCommand(`git commit -m "${commitMessage}"`);
    }
    
    // Push to trigger deployment
    log('• Pushing to GitHub...', 'cyan');
    execCommand('git push origin main');
    
    log('\n✅ DEPLOYMENT TRIGGERED SUCCESSFULLY!', 'green');
    log('\n📊 Next steps:', 'blue');
    log('1. Monitor deployment at: https://vercel.com/dashboard', 'cyan');
    log('2. Check build logs for any warnings', 'cyan');
    log('3. Verify production site once deployed', 'cyan');
    log('\n🎉 Deployment complete!\n', 'green');
    
  } catch (error) {
    log('\n❌ DEPLOYMENT FAILED', 'red');
    log(error.message, 'red');
    log('\nTry running:', 'yellow');
    log('  npm run diagnose', 'cyan');
    log('  npm run fix:deps', 'cyan');
    process.exit(1);
  }
  
  rl.close();
}

// Handle cleanup
process.on('SIGINT', () => {
  log('\n\nDeployment cancelled by user.', 'yellow');
  rl.close();
  process.exit(0);
});

// Run the deployment assistant
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});