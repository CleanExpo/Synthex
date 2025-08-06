import dotenv from 'dotenv';

// Load environment variables first, before any other imports
dotenv.config();

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
}

export {};