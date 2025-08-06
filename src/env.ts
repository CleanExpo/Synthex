import dotenv from 'dotenv';

// Only load dotenv in development or when not on Vercel
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    dotenv.config();
    console.log('📦 Loaded environment variables from .env file');
}

// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingVars: string[] = [];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        missingVars.push(varName);
    }
}

if (missingVars.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missingVars.join(', ')}`);
    console.warn('Please check your .env file or environment configuration.');
    
    // In production, this is more critical
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        console.error('🚨 Critical: Missing environment variables in production!');
    }
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