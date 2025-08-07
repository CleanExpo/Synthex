#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Building SYNTHEX...');

try {
    // Clean dist directory
    console.log('Cleaning dist directory...');
    execSync('npx rimraf dist', { stdio: 'inherit' });
    
    // Run TypeScript compiler
    console.log('Compiling TypeScript...');
    const tscPath = path.join(__dirname, 'node_modules', '.bin', 'tsc');
    
    // Use the TypeScript compiler directly without any extra arguments
    execSync(`node "${path.join(__dirname, 'node_modules', 'typescript', 'lib', 'tsc.js')}"`, { 
        stdio: 'inherit',
        cwd: __dirname
    });
    
    console.log('✓ Build completed successfully!');
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}