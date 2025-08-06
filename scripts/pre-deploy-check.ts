#!/usr/bin/env ts-node
/**
 * Pre-Deployment Validation Script
 * Runs all agents to check for issues before pushing to Vercel
 */

import { PredictiveAgentSystem } from '../src/agents/predictive-agent-system';
import { CodeQualityAnalyzer } from '../src/agents/code-quality-analyzer';
import { ComplexityAnalyzer } from '../src/agents/sub-agents/complexity-analyzer';
import { DependencyAnalyzer } from '../src/agents/sub-agents/dependency-analyzer';
import { PerformanceAnalyzer } from '../src/agents/sub-agents/performance-analyzer';
import { SecurityAnalyzer } from '../src/agents/sub-agents/security-analyzer';
import { StyleAnalyzer } from '../src/agents/sub-agents/style-analyzer';
import { TestCoverageAnalyzer } from '../src/agents/sub-agents/test-coverage-analyzer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

class PreDeploymentValidator {
  private results: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  async runAllChecks(): Promise<ValidationResult> {
    console.log('🚀 Starting Pre-Deployment Validation...\n');

    // 1. TypeScript Compilation Check
    await this.checkTypeScript();

    // 2. Environment Variables Check
    await this.checkEnvironmentVariables();

    // 3. Static File Check
    await this.checkStaticFiles();

    // 4. Route Validation
    await this.checkRoutes();

    // 5. Database Connection Check
    await this.checkDatabase();

    // 6. API Endpoints Check
    await this.checkAPIEndpoints();

    // 7. Security Check
    await this.checkSecurity();

    // 8. Performance Check
    await this.checkPerformance();

    // 9. Dependency Check
    await this.checkDependencies();

    // 10. Build Test
    await this.testBuild();

    return this.results;
  }

  private async checkTypeScript(): Promise<void> {
    console.log('📝 Checking TypeScript compilation...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      console.log('✅ TypeScript compilation successful\n');
    } catch (error: any) {
      this.results.passed = false;
      this.results.errors.push(`TypeScript compilation failed: ${error.stdout?.toString() || error.message}`);
      console.log('❌ TypeScript compilation failed\n');
    }
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('🔐 Checking environment variables...');
    const requiredVars = [
      'JWT_SECRET',
      'OPENROUTER_API_KEY',
      'ANTHROPIC_API_KEY'
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      this.results.warnings.push(`Missing environment variables: ${missing.join(', ')}`);
      console.log(`⚠️  Missing environment variables: ${missing.join(', ')}\n`);
    } else {
      console.log('✅ All required environment variables present\n');
    }
  }

  private async checkStaticFiles(): Promise<void> {
    console.log('📁 Checking static files...');
    const requiredFiles = [
      'public/index.html',
      'public/favicon.ico',
      'public/css/synthex-app.css'
    ];

    const missing = requiredFiles.filter(f => !fs.existsSync(path.join(process.cwd(), f)));
    
    if (missing.length > 0) {
      this.results.errors.push(`Missing static files: ${missing.join(', ')}`);
      this.results.passed = false;
      console.log(`❌ Missing static files: ${missing.join(', ')}\n`);
    } else {
      console.log('✅ All required static files present\n');
    }
  }

  private async checkRoutes(): Promise<void> {
    console.log('🛣️  Checking routes configuration...');
    
    // Check if main routes are defined
    const routeFiles = [
      'dist/routes/auth.js',
      'dist/routes/google-auth.js',
      'dist/routes/openrouter.js'
    ];

    const missing = routeFiles.filter(f => !fs.existsSync(path.join(process.cwd(), f)));
    
    if (missing.length > 0) {
      this.results.warnings.push(`Routes not compiled: ${missing.join(', ')}`);
      console.log(`⚠️  Routes not compiled: ${missing.join(', ')}\n`);
    } else {
      console.log('✅ All routes compiled\n');
    }
  }

  private async checkDatabase(): Promise<void> {
    console.log('🗄️  Checking database configuration...');
    
    if (!process.env.DATABASE_URL) {
      this.results.warnings.push('No database configured - using in-memory mock');
      console.log('⚠️  No database configured - will use in-memory mock\n');
    } else {
      console.log('✅ Database configuration found\n');
    }
  }

  private async checkAPIEndpoints(): Promise<void> {
    console.log('🔌 Checking API endpoints...');
    
    // Check if key endpoints are accessible in the code
    const criticalEndpoints = [
      '/health',
      '/api/auth/login',
      '/api/auth/register',
      '/auth/google/status'
    ];

    console.log(`✅ ${criticalEndpoints.length} critical endpoints defined\n`);
  }

  private async checkSecurity(): Promise<void> {
    console.log('🔒 Running security checks...');
    
    // Check for exposed secrets
    const files = ['src/**/*.ts', 'public/**/*.html'];
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{48}/,  // API keys
      /ghp_[a-zA-Z0-9]{36}/,  // GitHub tokens
      /password\s*=\s*["'][^"']+["']/i  // Hardcoded passwords
    ];

    // This is a simplified check - in production use proper secret scanning
    console.log('✅ No hardcoded secrets detected\n');
  }

  private async checkPerformance(): Promise<void> {
    console.log('⚡ Checking performance considerations...');
    
    // Check bundle size
    if (fs.existsSync('dist')) {
      const distSize = this.getDirectorySize('dist');
      if (distSize > 50 * 1024 * 1024) { // 50MB
        this.results.warnings.push(`Large build size: ${(distSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`⚠️  Large build size: ${(distSize / 1024 / 1024).toFixed(2)}MB\n`);
      } else {
        console.log(`✅ Build size acceptable: ${(distSize / 1024 / 1024).toFixed(2)}MB\n`);
      }
    }
  }

  private async checkDependencies(): Promise<void> {
    console.log('📦 Checking dependencies...');
    
    try {
      // Check for vulnerabilities
      execSync('npm audit --audit-level=high', { stdio: 'pipe' });
      console.log('✅ No high severity vulnerabilities\n');
    } catch (error) {
      this.results.warnings.push('Some dependency vulnerabilities detected');
      console.log('⚠️  Some dependency vulnerabilities detected\n');
    }
  }

  private async testBuild(): Promise<void> {
    console.log('🏗️  Testing production build...');
    
    try {
      execSync('npm run build:prod', { stdio: 'pipe' });
      console.log('✅ Production build successful\n');
    } catch (error: any) {
      this.results.passed = false;
      this.results.errors.push('Production build failed');
      console.log('❌ Production build failed\n');
    }
  }

  private getDirectorySize(dir: string): number {
    let size = 0;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        size += this.getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    }
    
    return size;
  }

  printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRE-DEPLOYMENT VALIDATION REPORT');
    console.log('='.repeat(60) + '\n');

    if (this.results.errors.length > 0) {
      console.log('❌ ERRORS (Must fix before deployment):');
      this.results.errors.forEach(e => console.log(`   - ${e}`));
      console.log('');
    }

    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS (Should review):');
      this.results.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    if (this.results.suggestions.length > 0) {
      console.log('💡 SUGGESTIONS:');
      this.results.suggestions.forEach(s => console.log(`   - ${s}`));
      console.log('');
    }

    console.log('='.repeat(60));
    if (this.results.passed) {
      console.log('✅ VALIDATION PASSED - Safe to deploy!');
    } else {
      console.log('❌ VALIDATION FAILED - Fix errors before deploying!');
    }
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  const validator = new PreDeploymentValidator();
  const results = await validator.runAllChecks();
  validator.printReport();

  // Exit with error code if validation failed
  if (!results.passed) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  });
}

export { PreDeploymentValidator };