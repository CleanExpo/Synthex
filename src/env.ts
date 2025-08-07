import dotenv from 'dotenv';

// Only load dotenv in development or when not on Vercel
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    dotenv.config();
    console.log('📦 Loaded environment variables from .env file');
}

// Define environment variable requirements
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const recommendedEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENROUTER_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
];

// Validate required variables
const missingRequired: string[] = [];
const missingRecommended: string[] = [];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        missingRequired.push(varName);
    }
}

for (const varName of recommendedEnvVars) {
    if (!process.env[varName]) {
        missingRecommended.push(varName);
    }
}

// Report missing variables
if (missingRequired.length > 0) {
    console.error(`❌ Missing REQUIRED environment variables: ${missingRequired.join(', ')}`);
    console.error('The application cannot start without these variables.');
    console.error('Please check your .env file or environment configuration.');
    
    // In production, this is critical
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.error('🚨 CRITICAL: Missing required environment variables in production!');
        // Don't exit in Vercel as it might be using different env vars
        if (!process.env.VERCEL) {
            process.exit(1);
        }
    }
}

if (missingRecommended.length > 0) {
    console.warn(`⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`);
    console.warn('Some features may not be available.');
}

// Log environment info for debugging
console.log('🌍 Environment:', {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL: process.env.VERCEL ? 'true' : 'false',
    hasJWT: !!process.env.JWT_SECRET,
    hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY
});

export {};