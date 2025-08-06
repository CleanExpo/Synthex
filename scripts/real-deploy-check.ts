#!/usr/bin/env ts-node
/**
 * REAL Deployment Validation
 * This actually tests if the site works, not just if it compiles
 */

import * as dotenv from 'dotenv';
import axios from 'axios';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface RealValidationResult {
  passed: boolean;
  criticalErrors: string[];
  failures: TestFailure[];
  warnings: string[];
  successfulTests: string[];
}

interface TestFailure {
  test: string;
  expected: any;
  actual: any;
  error?: string;
}

class RealDeploymentValidator {
  private LOCAL_URL = 'http://localhost:3000';
  private STAGING_URL = process.env.STAGING_URL || 'https://synthex-staging.vercel.app';
  private PRODUCTION_URL = 'https://synthex-cerq.vercel.app';
  
  private results: RealValidationResult = {
    passed: true,
    criticalErrors: [],
    failures: [],
    warnings: [],
    successfulTests: []
  };

  /**
   * Run LOCAL tests before deployment
   */
  async validateLocal(): Promise<boolean> {
    console.log('\n🏠 LOCAL VALIDATION\n' + '='.repeat(60) + '\n');
    
    // Start local server
    console.log('🚀 Starting local server...');
    const server = this.startLocalServer();
    
    // Wait for server to start
    await this.sleep(3000);
    
    try {
      // Test all endpoints locally
      await this.testEndpoints(this.LOCAL_URL, 'LOCAL');
      await this.testStaticFiles(this.LOCAL_URL, 'LOCAL');
      await this.testAuthentication(this.LOCAL_URL, 'LOCAL');
      await this.testAPIResponses(this.LOCAL_URL, 'LOCAL');
      
      return this.results.criticalErrors.length === 0;
    } finally {
      // Kill local server
      this.stopLocalServer(server);
    }
  }

  /**
   * Test STAGING deployment (preview URL)
   */
  async validateStaging(): Promise<boolean> {
    console.log('\n🔧 STAGING VALIDATION\n' + '='.repeat(60) + '\n');
    
    // Get latest preview URL from Vercel
    const previewUrl = await this.getLatestPreviewUrl();
    if (!previewUrl) {
      console.log('⚠️  No staging URL available');
      return true; // Don't block if no staging
    }
    
    await this.testEndpoints(previewUrl, 'STAGING');
    await this.testStaticFiles(previewUrl, 'STAGING');
    
    return this.results.criticalErrors.length === 0;
  }

  /**
   * Test PRODUCTION after deployment
   */
  async validateProduction(): Promise<boolean> {
    console.log('\n🌍 PRODUCTION VALIDATION\n' + '='.repeat(60) + '\n');
    
    // Wait for deployment to propagate
    console.log('⏳ Waiting for deployment to propagate (30s)...');
    await this.sleep(30000);
    
    await this.testEndpoints(this.PRODUCTION_URL, 'PRODUCTION');
    await this.testStaticFiles(this.PRODUCTION_URL, 'PRODUCTION');
    await this.testAuthentication(this.PRODUCTION_URL, 'PRODUCTION');
    await this.testAPIResponses(this.PRODUCTION_URL, 'PRODUCTION');
    
    return this.results.criticalErrors.length === 0;
  }

  /**
   * Test all critical endpoints
   */
  private async testEndpoints(baseUrl: string, env: string): Promise<void> {
    console.log(`📡 Testing endpoints on ${env}...`);
    
    const criticalEndpoints = [
      { path: '/', expectedStatus: 200, name: 'Main page' },
      { path: '/health', expectedStatus: 200, name: 'Health check' },
      { path: '/api/auth/login', method: 'POST', expectedStatus: [400, 401], name: 'Login endpoint' },
      { path: '/api/auth/register', method: 'POST', expectedStatus: [400], name: 'Register endpoint' },
      { path: '/auth/google/status', expectedStatus: 200, name: 'Google OAuth status' },
      { path: '/favicon.ico', expectedStatus: 200, name: 'Favicon' }
    ];
    
    for (const endpoint of criticalEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method || 'GET',
          url: `${baseUrl}${endpoint.path}`,
          validateStatus: () => true,
          timeout: 10000
        });
        
        const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
          ? endpoint.expectedStatus 
          : [endpoint.expectedStatus];
        
        if (expectedStatuses.includes(response.status)) {
          console.log(`  ✅ ${endpoint.name}: ${response.status}`);
          this.results.successfulTests.push(`${env}: ${endpoint.name}`);
        } else {
          console.log(`  ❌ ${endpoint.name}: Got ${response.status}, expected ${expectedStatuses.join(' or ')}`);
          this.results.failures.push({
            test: `${env}: ${endpoint.name}`,
            expected: expectedStatuses,
            actual: response.status
          });
          
          if (endpoint.path === '/' || endpoint.path === '/health') {
            this.results.criticalErrors.push(`${env}: Critical endpoint ${endpoint.path} returned ${response.status}`);
          }
        }
      } catch (error: any) {
        console.log(`  ❌ ${endpoint.name}: ${error.message}`);
        this.results.criticalErrors.push(`${env}: ${endpoint.name} failed - ${error.message}`);
      }
    }
  }

  /**
   * Test static file serving
   */
  private async testStaticFiles(baseUrl: string, env: string): Promise<void> {
    console.log(`📁 Testing static files on ${env}...`);
    
    const staticFiles = [
      '/css/synthex-app.css',
      '/js/api.js',
      '/logo.png'
    ];
    
    for (const file of staticFiles) {
      try {
        const response = await axios.get(`${baseUrl}${file}`, {
          validateStatus: () => true,
          timeout: 10000
        });
        
        if (response.status === 200) {
          console.log(`  ✅ ${file}: Loaded`);
          this.results.successfulTests.push(`${env}: Static file ${file}`);
        } else {
          console.log(`  ⚠️  ${file}: ${response.status}`);
          this.results.warnings.push(`${env}: Static file ${file} returned ${response.status}`);
        }
      } catch (error: any) {
        console.log(`  ❌ ${file}: Failed to load`);
        this.results.warnings.push(`${env}: Static file ${file} failed to load`);
      }
    }
  }

  /**
   * Test authentication flow
   */
  private async testAuthentication(baseUrl: string, env: string): Promise<void> {
    console.log(`🔐 Testing authentication on ${env}...`);
    
    // Test registration with invalid data (should fail gracefully)
    try {
      const response = await axios.post(`${baseUrl}/api/auth/register`, {
        email: 'test',
        password: '123'
      }, {
        validateStatus: () => true
      });
      
      if (response.status === 400 && response.data.error) {
        console.log(`  ✅ Registration validation: Working`);
        this.results.successfulTests.push(`${env}: Registration validation`);
      } else {
        console.log(`  ⚠️  Registration validation: Unexpected response`);
        this.results.warnings.push(`${env}: Registration validation returned unexpected response`);
      }
    } catch (error) {
      console.log(`  ❌ Registration endpoint: Failed`);
      this.results.criticalErrors.push(`${env}: Registration endpoint not responding`);
    }
  }

  /**
   * Test API response formats
   */
  private async testAPIResponses(baseUrl: string, env: string): Promise<void> {
    console.log(`🔌 Testing API responses on ${env}...`);
    
    try {
      const response = await axios.get(`${baseUrl}/health`);
      
      if (response.data && response.data.status) {
        console.log(`  ✅ Health API: Valid JSON response`);
        this.results.successfulTests.push(`${env}: Health API format`);
      } else {
        console.log(`  ❌ Health API: Invalid response format`);
        this.results.failures.push({
          test: `${env}: Health API format`,
          expected: 'JSON with status field',
          actual: response.data
        });
      }
    } catch (error) {
      console.log(`  ❌ Health API: Failed`);
    }
  }

  /**
   * Start local server for testing
   */
  private startLocalServer(): any {
    try {
      const server = execSync('npm start', {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      return server;
    } catch (error) {
      console.log('Local server start attempted');
      return null;
    }
  }

  /**
   * Stop local server
   */
  private stopLocalServer(server: any): void {
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /IM node.exe', { stdio: 'ignore' });
      } else {
        execSync('pkill -f "node.*dist/index.js"', { stdio: 'ignore' });
      }
    } catch (error) {
      // Server might not be running
    }
  }

  /**
   * Get latest Vercel preview URL
   */
  private async getLatestPreviewUrl(): Promise<string | null> {
    try {
      // This would use Vercel API in production
      // For now, return null to skip staging tests
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate final report
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REAL DEPLOYMENT VALIDATION REPORT');
    console.log('='.repeat(60) + '\n');

    if (this.results.criticalErrors.length > 0) {
      console.log('🚨 CRITICAL ERRORS (Deployment will fail):');
      this.results.criticalErrors.forEach(e => console.log(`   ❌ ${e}`));
      console.log('');
    }

    if (this.results.failures.length > 0) {
      console.log('❌ FAILURES:');
      this.results.failures.forEach(f => {
        console.log(`   - ${f.test}`);
        console.log(`     Expected: ${JSON.stringify(f.expected)}`);
        console.log(`     Got: ${JSON.stringify(f.actual)}`);
      });
      console.log('');
    }

    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }

    console.log('✅ SUCCESSFUL TESTS:');
    this.results.successfulTests.forEach(s => console.log(`   - ${s}`));
    console.log('');

    console.log('='.repeat(60));
    
    const totalTests = this.results.successfulTests.length + this.results.failures.length;
    const passRate = totalTests > 0 
      ? Math.round((this.results.successfulTests.length / totalTests) * 100) 
      : 0;
    
    console.log(`📈 PASS RATE: ${passRate}% (${this.results.successfulTests.length}/${totalTests})`);
    
    if (this.results.criticalErrors.length === 0 && passRate >= 90) {
      console.log('✅ DEPLOYMENT VALIDATED - Safe to use!');
    } else {
      console.log('❌ DEPLOYMENT FAILED VALIDATION - Contains errors!');
    }
    
    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Main deployment flow with REAL validation
 */
async function deployWithRealValidation() {
  const validator = new RealDeploymentValidator();
  
  console.log('🚀 REAL DEPLOYMENT VALIDATION SYSTEM');
  console.log('=====================================\n');
  
  // STEP 1: Local validation
  console.log('STEP 1: Validating locally...');
  const localValid = await validator.validateLocal();
  
  if (!localValid) {
    console.log('\n❌ Local validation failed! Fix issues before deploying.\n');
    validator.generateReport();
    process.exit(1);
  }
  
  // STEP 2: Deploy to staging/preview
  console.log('\nSTEP 2: Deploying to staging...');
  execSync('git push origin main', { stdio: 'inherit' });
  
  // STEP 3: Validate staging (if available)
  const stagingValid = await validator.validateStaging();
  
  if (!stagingValid) {
    console.log('\n⚠️  Staging validation failed!\n');
  }
  
  // STEP 4: Validate production
  console.log('\nSTEP 3: Validating production deployment...');
  const productionValid = await validator.validateProduction();
  
  // Generate final report
  validator.generateReport();
  
  if (!productionValid) {
    console.log('🚨 PRODUCTION VALIDATION FAILED!');
    console.log('Consider rolling back the deployment.');
    process.exit(1);
  }
  
  console.log('✅ Deployment successfully validated!');
}

// Run if executed directly
if (require.main === module) {
  deployWithRealValidation().catch(error => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  });
}

export { RealDeploymentValidator };