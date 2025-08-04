// Environment Variables Verification Script
// Run this in Vercel or locally to check if all required env vars are set

console.log('🔍 Environment Variables Verification');
console.log('=====================================\n');

// Required environment variables
const requiredVars = [
  'NODE_ENV',
  'JWT_SECRET',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY'  
];

// Database variables
const databaseVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL'
];

// Optional variables
const optionalVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'GOOGLE_CALLBACK_URL',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_SITE_URL',
  'OPENROUTER_SITE_NAME',
  'POSTGRES_URL_NON_POOLING'
];

let missingRequired = [];
let missingDatabase = [];

console.log('✅ REQUIRED VARIABLES:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = value && value !== '' && value !== 'undefined';
  console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
  if (!isSet) missingRequired.push(varName);
});

console.log('\n🗄️ DATABASE VARIABLES:');
databaseVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = value && value !== '' && value !== 'undefined';
  console.log(`  ${varName}: ${isSet ? '✅ Set' : '❌ Missing'}`);
  if (!isSet) missingDatabase.push(varName);
});

console.log('\n⚙️ OPTIONAL VARIABLES:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const isSet = value && value !== '' && value !== 'undefined';
  console.log(`  ${varName}: ${isSet ? '✅ Set' : '➖ Not set'}`);
});

console.log('\n📊 SUMMARY:');
console.log('===========');

if (missingRequired.length === 0 && missingDatabase.length === 0) {
  console.log('🎉 All critical environment variables are configured!');
  console.log('🚀 Your application should work correctly.');
} else {
  console.log('⚠️ Missing critical environment variables:');
  
  if (missingRequired.length > 0) {
    console.log('\n❌ Required variables:');
    missingRequired.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }
  
  if (missingDatabase.length > 0) {
    console.log('\n❌ Database variables:');
    missingDatabase.forEach(varName => {
      console.log(`  - ${varName}`);
    });
  }
  
  console.log('\n🔧 Add missing variables in Vercel Dashboard:');
  console.log('   https://vercel.com/dashboard/[project]/settings/environment-variables');
  console.log('\n📖 See VERCEL-ENV-VARIABLES.md for detailed setup instructions.');
}

console.log('\n🌐 Environment Info:');
console.log(`  Node.js: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Environment: ${process.env.NODE_ENV || 'not set'}`);

module.exports = { requiredVars, databaseVars, optionalVars };