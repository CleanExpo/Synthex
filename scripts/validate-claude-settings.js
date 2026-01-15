#!/usr/bin/env node
/**
 * Validates Claude Code settings.json for common errors
 * Prevents invalid hook configurations and other validation issues
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(process.cwd(), '.claude', 'settings.json');

function validateSettings() {
  console.log('🔍 Validating Claude Code settings...\n');

  let hasErrors = false;

  // Check if settings file exists
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log('ℹ️  No .claude/settings.json found (optional)');
    return true;
  }

  // Read and parse settings
  let settings;
  try {
    const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
    settings = JSON.parse(content);
    console.log('✅ Valid JSON syntax');
  } catch (error) {
    console.error('❌ Invalid JSON syntax:', error.message);
    return false;
  }

  // Check for invalid hooks section
  if (settings.hooks) {
    console.error('\n❌ INVALID: "hooks" section found in settings.json');
    console.error('   Hooks must be defined in .claude/hooks/*.hook.md files');
    console.error('   Found:', JSON.stringify(settings.hooks, null, 2));
    console.error('\n   To fix: Remove the "hooks" section from settings.json');
    hasErrors = true;
  } else {
    console.log('✅ No invalid hooks section');
  }

  // Check for other common issues
  const invalidKeys = [
    'onMigration',
    'preCommit',
    'prePush',
    'postCommit',
    'postDeploy'
  ];

  const foundInvalidKeys = invalidKeys.filter(key =>
    key in settings ||
    (settings.hooks && key in settings.hooks)
  );

  if (foundInvalidKeys.length > 0) {
    console.error('\n❌ Found invalid top-level keys:', foundInvalidKeys.join(', '));
    hasErrors = true;
  }

  // Validate hook files exist if referenced
  const hooksDir = path.join(process.cwd(), '.claude', 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.hook.md'));
    console.log(`\n✅ Found ${hookFiles.length} hook files in .claude/hooks/`);
    hookFiles.forEach(file => console.log(`   - ${file}`));
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.error('❌ VALIDATION FAILED - Settings contain errors');
    console.error('   See: .claude/HOOKS-README.md for guidance');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - Settings are valid');
  }

  return !hasErrors;
}

// Run validation
validateSettings();
