import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Vercel Deployment Configuration', () => {
  
  test('vercel.json should be valid', async () => {
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
    
    // Check required fields
    expect(vercelConfig.version).toBe(2);
    expect(vercelConfig.name).toBeTruthy();
    expect(vercelConfig.buildCommand).toBeTruthy();
    
    // Verify no problematic functions property
    if (vercelConfig.functions) {
      console.warn('Warning: functions property found in vercel.json - this may cause deployment issues');
    }
    
    // Check rewrites are properly configured
    expect(vercelConfig.rewrites).toBeTruthy();
    expect(Array.isArray(vercelConfig.rewrites)).toBe(true);
  });
  
  test('build output should be generated correctly', async () => {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Check if dist directory exists after build
    if (fs.existsSync(distPath)) {
      const indexPath = path.join(distPath, 'index.js');
      expect(fs.existsSync(indexPath)).toBe(true);
    }
  });
  
  test('API handler should exist', async () => {
    const apiPath = path.join(process.cwd(), 'api', 'index.js');
    expect(fs.existsSync(apiPath)).toBe(true);
  });
  
  test('environment variables template should exist', async () => {
    const envPath = path.join(process.cwd(), '.env.production');
    expect(fs.existsSync(envPath)).toBe(true);
  });
  
  test('public files should exist', async () => {
    const publicPath = path.join(process.cwd(), 'public');
    expect(fs.existsSync(publicPath)).toBe(true);
    
    const appHtml = path.join(publicPath, 'app.html');
    const indexHtml = path.join(publicPath, 'index.html');
    
    expect(fs.existsSync(appHtml)).toBe(true);
    expect(fs.existsSync(indexHtml)).toBe(true);
  });
});

test.describe('Local Server Tests', () => {
  
  test.beforeAll(async () => {
    // Build the project first
    const { execSync } = require('child_process');
    console.log('Building project...');
    execSync('npm run build', { stdio: 'inherit' });
  });
  
  test('server should start without errors', async ({ page }) => {
    // This test would require the server to be running
    // For CI/CD, you'd typically start the server in a separate process
    
    try {
      // Test if we can import the main file without errors
      const mainModule = require('../dist/index.js');
      expect(mainModule).toBeTruthy();
    } catch (error) {
      console.error('Failed to load main module:', error);
      throw error;
    }
  });
  
  test('API routes should be defined', async () => {
    // Check if route files exist
    const routesPath = path.join(process.cwd(), 'dist', 'routes');
    
    if (fs.existsSync(routesPath)) {
      const routes = fs.readdirSync(routesPath);
      expect(routes.length).toBeGreaterThan(0);
      
      // Check for expected route files
      expect(routes.some(r => r.includes('openrouter'))).toBe(true);
      expect(routes.some(r => r.includes('mcp-ttd'))).toBe(true);
      expect(routes.some(r => r.includes('mle-star'))).toBe(true);
    }
  });
});

test.describe('Deployment Readiness', () => {
  
  test('package.json should have required scripts', async () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    
    expect(packageJson.scripts.build).toBeTruthy();
    expect(packageJson.scripts.start).toBeTruthy();
    expect(packageJson.engines.node).toBeTruthy();
  });
  
  test('TypeScript compilation should succeed', async () => {
    const { execSync } = require('child_process');
    
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      expect(true).toBe(true); // Compilation succeeded
    } catch (error) {
      console.error('TypeScript compilation failed:', error.stdout?.toString());
      throw new Error('TypeScript compilation failed');
    }
  });
  
  test('no sensitive data in repository', async () => {
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/,  // API keys
      /ghp_[a-zA-Z0-9]{36}/,  // GitHub tokens
      /password\s*=\s*["'][^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i
    ];
    
    const filesToCheck = [
      'vercel.json',
      'package.json',
      'README.md'
    ];
    
    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of sensitivePatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    }
  });
});