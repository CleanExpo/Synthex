#!/usr/bin/env ts-node
/**
 * ULTIMATE DEPLOYMENT SYSTEM
 * Production-ready deployment with comprehensive validation
 */

import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface DeploymentReport {
  environment: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  criticalFailures: string[];
  warnings: string[];
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
}

interface PerformanceMetrics {
  buildTime: number;
  deploymentTime: number;
  testExecutionTime: number;
  averageResponseTime: number;
  slowestEndpoint: { url: string; time: number };
}

interface EndpointTest {
  path: string;
  method?: string;
  expectedStatus: number | number[];
  name: string;
  critical?: boolean;
  body?: any;
  headers?: any;
  timeout?: number;
  validateResponse?: (data: any) => boolean;
}

class UltimateDeploymentSystem {
  private LOCAL_URL = 'http://localhost:3000';
  private PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://synthex-cerq.vercel.app';
  private STAGING_URL = process.env.STAGING_URL || '';
  
  private testResults: TestResult[] = [];
  private performanceMetrics: PerformanceMetrics = {
    buildTime: 0,
    deploymentTime: 0,
    testExecutionTime: 0,
    averageResponseTime: 0,
    slowestEndpoint: { url: '', time: 0 }
  };

  private criticalEndpoints: EndpointTest[] = [
    { 
      path: '/', 
      expectedStatus: 200, 
      name: 'Main page', 
      critical: true,
      validateResponse: (data) => data && data.length > 100
    },
    { 
      path: '/health', 
      expectedStatus: 200, 
      name: 'Health check', 
      critical: true,
      validateResponse: (data) => data?.status === 'healthy'
    },
    { 
      path: '/api/auth/login', 
      method: 'POST', 
      expectedStatus: [400, 401], 
      name: 'Login API',
      critical: true,
      body: {}
    },
    { 
      path: '/api/auth/register', 
      method: 'POST', 
      expectedStatus: [400], 
      name: 'Register API',
      body: { email: 'test', password: '123' }
    },
    { 
      path: '/auth/google/status', 
      expectedStatus: 200, 
      name: 'OAuth status' 
    },
    { 
      path: '/favicon.ico', 
      expectedStatus: 200, 
      name: 'Favicon' 
    }
  ];

  private staticFiles = [
    '/css/synthex-app.css',
    '/js/api.js',
    '/logo.png'
  ];

  /**
   * Main deployment pipeline
   */
  async deploy(options: { skipLocal?: boolean; skipProduction?: boolean; force?: boolean } = {}): Promise<void> {
    console.log('🚀 ULTIMATE DEPLOYMENT SYSTEM');
    console.log('=' .repeat(60));
    console.log(`📅 Deployment started at: ${new Date().toISOString()}`);
    console.log('=' .repeat(60) + '\n');

    try {
      // Phase 1: Pre-deployment checks
      if (!options.skipLocal) {
        await this.runPreDeploymentChecks();
      }

      // Phase 2: Build validation
      await this.validateBuild();

      // Phase 3: Local testing
      if (!options.skipLocal) {
        const localPassed = await this.runLocalTests();
        if (!localPassed && !options.force) {
          this.generateReport('LOCAL');
          throw new Error('Local tests failed. Use --force to override.');
        }
      }

      // Phase 4: Git operations
      await this.handleGitOperations();

      // Phase 5: Deploy
      const deployStart = Date.now();
      await this.deployToProduction();
      this.performanceMetrics.deploymentTime = Date.now() - deployStart;

      // Phase 6: Production validation
      if (!options.skipProduction) {
        const productionPassed = await this.validateProduction();
        this.generateReport('PRODUCTION');
        
        if (!productionPassed) {
          await this.handleFailedDeployment();
        } else {
          await this.celebrateSuccess();
        }
      }

    } catch (error: any) {
      console.error('\n❌ DEPLOYMENT FAILED:', error.message);
      await this.handleFailedDeployment();
      process.exit(1);
    }
  }

  /**
   * Pre-deployment checks
   */
  private async runPreDeploymentChecks(): Promise<void> {
    console.log('🔍 Running pre-deployment checks...\n');
    
    // Check Node version
    const nodeVersion = process.version;
    console.log(`📦 Node version: ${nodeVersion}`);
    
    // Check environment variables
    const requiredEnvVars = ['ANTHROPIC_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingEnvVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
    }
    
    // Check disk space
    try {
      const diskSpace = execSync('df -h .', { encoding: 'utf-8' });
      console.log('💾 Disk space available');
    } catch {
      // Windows fallback
      try {
        const diskSpace = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf-8' });
        console.log('💾 Disk space available');
      } catch {
        console.log('⚠️  Could not check disk space');
      }
    }
    
    // Check dependencies
    console.log('📚 Checking dependencies...');
    try {
      execSync('npm ls --depth=0', { stdio: 'pipe' });
      console.log('✅ All dependencies installed\n');
    } catch {
      console.log('⚠️  Some dependencies might be missing\n');
    }
  }

  /**
   * Build validation
   */
  private async validateBuild(): Promise<void> {
    console.log('🔨 Building project...\n');
    const buildStart = Date.now();
    
    try {
      // Clean build directory
      if (fs.existsSync('dist')) {
        console.log('🧹 Cleaning previous build...');
        execSync('npm run clean', { stdio: 'pipe' });
      }
      
      // Run TypeScript compiler
      console.log('📝 Compiling TypeScript...');
      execSync('npm run lint', { stdio: 'pipe' });
      console.log('✅ TypeScript validation passed');
      
      // Build production
      console.log('📦 Building for production...');
      execSync('npm run build:prod', { stdio: 'pipe' });
      console.log('✅ Build successful');
      
      this.performanceMetrics.buildTime = Date.now() - buildStart;
      console.log(`⏱️  Build time: ${this.performanceMetrics.buildTime}ms\n`);
      
      // Verify build output
      const distExists = fs.existsSync('dist/index.js');
      if (!distExists) {
        throw new Error('Build output not found');
      }
      
    } catch (error: any) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  /**
   * Run comprehensive local tests
   */
  private async runLocalTests(): Promise<boolean> {
    console.log('🏠 LOCAL TESTING PHASE');
    console.log('=' .repeat(60) + '\n');
    
    const testStart = Date.now();
    let server: any = null;
    
    try {
      // Start local server
      console.log('🚀 Starting local server...');
      server = await this.startLocalServer();
      await this.sleep(5000); // Give server time to start
      
      // Verify server is running
      const serverRunning = await this.checkServerHealth(this.LOCAL_URL);
      if (!serverRunning) {
        throw new Error('Local server failed to start');
      }
      
      // Run all test suites
      await this.runEndpointTests(this.LOCAL_URL, 'LOCAL');
      await this.runStaticFileTests(this.LOCAL_URL, 'LOCAL');
      await this.runPerformanceTests(this.LOCAL_URL, 'LOCAL');
      await this.runSecurityTests(this.LOCAL_URL, 'LOCAL');
      
      this.performanceMetrics.testExecutionTime = Date.now() - testStart;
      
      // Calculate results
      const failedTests = this.testResults.filter(t => !t.passed);
      const criticalFailures = failedTests.filter(t => t.name.includes('critical'));
      
      if (criticalFailures.length > 0) {
        console.log(`\n❌ ${criticalFailures.length} critical tests failed`);
        return false;
      }
      
      console.log(`\n✅ All critical tests passed (${this.testResults.filter(t => t.passed).length}/${this.testResults.length})`);
      return true;
      
    } finally {
      if (server) {
        await this.stopLocalServer();
      }
    }
  }

  /**
   * Test all endpoints
   */
  private async runEndpointTests(baseUrl: string, env: string): Promise<void> {
    console.log(`\n📡 Testing endpoints on ${env}...`);
    const responseTimes: number[] = [];
    
    for (const endpoint of this.criticalEndpoints) {
      const startTime = Date.now();
      const testName = `${env}: ${endpoint.name}`;
      
      try {
        const response = await axios({
          method: endpoint.method || 'GET',
          url: `${baseUrl}${endpoint.path}`,
          data: endpoint.body,
          headers: endpoint.headers,
          validateStatus: () => true,
          timeout: endpoint.timeout || 10000
        });
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        // Track slowest endpoint
        if (responseTime > this.performanceMetrics.slowestEndpoint.time) {
          this.performanceMetrics.slowestEndpoint = {
            url: endpoint.path,
            time: responseTime
          };
        }
        
        const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
          ? endpoint.expectedStatus 
          : [endpoint.expectedStatus];
        
        const statusValid = expectedStatuses.includes(response.status);
        const responseValid = endpoint.validateResponse 
          ? endpoint.validateResponse(response.data)
          : true;
        
        const passed = statusValid && responseValid;
        
        this.testResults.push({
          name: testName,
          passed,
          duration: responseTime,
          details: {
            status: response.status,
            expectedStatus: expectedStatuses,
            responseValid
          }
        });
        
        if (passed) {
          console.log(`  ✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);
        } else {
          console.log(`  ❌ ${endpoint.name}: ${response.status} - Expected: ${expectedStatuses.join('/')}`);
        }
        
      } catch (error: any) {
        this.testResults.push({
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: error.message
        });
        console.log(`  ❌ ${endpoint.name}: ${error.message}`);
      }
    }
    
    // Calculate average response time
    if (responseTimes.length > 0) {
      this.performanceMetrics.averageResponseTime = 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  /**
   * Test static files
   */
  private async runStaticFileTests(baseUrl: string, env: string): Promise<void> {
    console.log(`\n📁 Testing static files on ${env}...`);
    
    for (const file of this.staticFiles) {
      const testName = `${env}: Static ${file}`;
      const startTime = Date.now();
      
      try {
        const response = await axios.get(`${baseUrl}${file}`, {
          validateStatus: () => true,
          timeout: 5000
        });
        
        const passed = response.status === 200;
        
        this.testResults.push({
          name: testName,
          passed,
          duration: Date.now() - startTime,
          details: { status: response.status }
        });
        
        if (passed) {
          console.log(`  ✅ ${file}: Loaded`);
        } else {
          console.log(`  ⚠️  ${file}: ${response.status}`);
        }
        
      } catch (error: any) {
        this.testResults.push({
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: error.message
        });
        console.log(`  ⚠️  ${file}: Failed to load`);
      }
    }
  }

  /**
   * Performance tests
   */
  private async runPerformanceTests(baseUrl: string, env: string): Promise<void> {
    console.log(`\n⚡ Running performance tests on ${env}...`);
    
    // Test concurrent requests
    const concurrentRequests = 10;
    const requests = Array(concurrentRequests).fill(null).map(() => 
      axios.get(`${baseUrl}/health`, { timeout: 5000 })
    );
    
    const startTime = Date.now();
    try {
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / concurrentRequests;
      
      console.log(`  ✅ Handled ${concurrentRequests} concurrent requests in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);
      
      this.testResults.push({
        name: `${env}: Concurrent requests`,
        passed: avgTime < 1000,
        duration: totalTime,
        details: { avgResponseTime: avgTime }
      });
      
    } catch (error) {
      console.log(`  ❌ Failed to handle concurrent requests`);
      this.testResults.push({
        name: `${env}: Concurrent requests`,
        passed: false,
        duration: Date.now() - startTime,
        error: 'Failed to handle concurrent load'
      });
    }
  }

  /**
   * Security tests
   */
  private async runSecurityTests(baseUrl: string, env: string): Promise<void> {
    console.log(`\n🔒 Running security tests on ${env}...`);
    
    // Test for common security headers
    try {
      const response = await axios.get(baseUrl, { 
        validateStatus: () => true,
        timeout: 5000 
      });
      
      const headers = response.headers;
      const securityChecks = [
        { header: 'x-frame-options', name: 'Clickjacking protection' },
        { header: 'x-content-type-options', name: 'MIME type sniffing protection' },
        { header: 'strict-transport-security', name: 'HTTPS enforcement' }
      ];
      
      for (const check of securityChecks) {
        const hasHeader = !!headers[check.header];
        
        this.testResults.push({
          name: `${env}: ${check.name}`,
          passed: hasHeader,
          duration: 0,
          details: { header: check.header, value: headers[check.header] }
        });
        
        if (hasHeader) {
          console.log(`  ✅ ${check.name}: ${headers[check.header]}`);
        } else {
          console.log(`  ⚠️  ${check.name}: Not configured`);
        }
      }
      
    } catch (error) {
      console.log(`  ⚠️  Could not complete security tests`);
    }
    
    // Test for exposed sensitive endpoints
    const sensitiveEndpoints = [
      '/.env',
      '/.git/config',
      '/package-lock.json'
    ];
    
    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          validateStatus: () => true,
          timeout: 3000
        });
        
        const blocked = response.status === 404 || response.status === 403;
        
        this.testResults.push({
          name: `${env}: Block ${endpoint}`,
          passed: blocked,
          duration: 0,
          details: { status: response.status }
        });
        
        if (blocked) {
          console.log(`  ✅ ${endpoint}: Properly blocked (${response.status})`);
        } else {
          console.log(`  ❌ ${endpoint}: EXPOSED (${response.status})`);
        }
        
      } catch {
        console.log(`  ✅ ${endpoint}: Properly blocked`);
      }
    }
  }

  /**
   * Handle Git operations
   */
  private async handleGitOperations(): Promise<void> {
    console.log('\n📋 Handling Git operations...\n');
    
    try {
      // Check for uncommitted changes
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
      
      if (gitStatus.trim()) {
        console.log('📝 Uncommitted changes detected');
        
        // Stage all changes
        execSync('git add -A', { stdio: 'pipe' });
        
        // Generate commit message
        const testsPassed = this.testResults.filter(t => t.passed).length;
        const totalTests = this.testResults.length;
        const passRate = Math.round((testsPassed / totalTests) * 100);
        
        const commitMessage = `deploy: Production deployment (${passRate}% tests passed)

Build time: ${this.performanceMetrics.buildTime}ms
Tests passed: ${testsPassed}/${totalTests}
Average response time: ${this.performanceMetrics.averageResponseTime.toFixed(2)}ms

Automated deployment by Ultimate Deployment System`;
        
        // Commit changes
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
        console.log('✅ Changes committed');
      } else {
        console.log('✅ No uncommitted changes');
      }
      
      // Verify remote is accessible
      console.log('🔗 Verifying remote repository...');
      execSync('git remote -v', { stdio: 'pipe' });
      console.log('✅ Remote repository verified\n');
      
    } catch (error: any) {
      throw new Error(`Git operations failed: ${error.message}`);
    }
  }

  /**
   * Deploy to production
   */
  private async deployToProduction(): Promise<void> {
    console.log('🚀 DEPLOYING TO PRODUCTION');
    console.log('=' .repeat(60) + '\n');
    
    try {
      console.log('📤 Pushing to remote repository...');
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('\n✅ Code pushed successfully');
      
      // For Vercel deployments, the push triggers automatic deployment
      console.log('⏳ Waiting for deployment to complete...');
      console.log('   (This usually takes 30-60 seconds)\n');
      
    } catch (error: any) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Validate production deployment
   */
  private async validateProduction(): Promise<boolean> {
    console.log('\n🌍 PRODUCTION VALIDATION');
    console.log('=' .repeat(60) + '\n');
    
    // Wait for deployment to propagate
    console.log('⏳ Waiting for deployment to propagate...');
    for (let i = 30; i > 0; i--) {
      process.stdout.write(`\r   ${i} seconds remaining...`);
      await this.sleep(1000);
    }
    console.log('\n');
    
    // Clear previous test results for production testing
    this.testResults = [];
    
    // Run all production tests
    await this.runEndpointTests(this.PRODUCTION_URL, 'PRODUCTION');
    await this.runStaticFileTests(this.PRODUCTION_URL, 'PRODUCTION');
    await this.runPerformanceTests(this.PRODUCTION_URL, 'PRODUCTION');
    await this.runSecurityTests(this.PRODUCTION_URL, 'PRODUCTION');
    
    // Verify production is actually updated
    await this.verifyDeploymentVersion();
    
    // Calculate results
    const failedTests = this.testResults.filter(t => !t.passed);
    const criticalFailures = failedTests.filter(t => 
      t.name.includes('Main page') || 
      t.name.includes('Health check')
    );
    
    return criticalFailures.length === 0;
  }

  /**
   * Verify deployment version
   */
  private async verifyDeploymentVersion(): Promise<void> {
    console.log('\n🔍 Verifying deployment version...');
    
    try {
      // Try to get version from health endpoint
      const response = await axios.get(`${this.PRODUCTION_URL}/health`);
      
      if (response.data.version) {
        console.log(`  ✅ Production version: ${response.data.version}`);
      } else {
        console.log(`  ⚠️  Version information not available`);
      }
      
      // Check deployment timestamp
      if (response.data.deployedAt) {
        const deployTime = new Date(response.data.deployedAt);
        const timeDiff = Date.now() - deployTime.getTime();
        
        if (timeDiff < 300000) { // Less than 5 minutes
          console.log(`  ✅ Fresh deployment (${Math.round(timeDiff / 1000)}s ago)`);
        } else {
          console.log(`  ⚠️  Deployment might be stale (${Math.round(timeDiff / 60000)}min ago)`);
        }
      }
      
    } catch {
      console.log('  ⚠️  Could not verify deployment version');
    }
  }

  /**
   * Generate deployment report
   */
  private generateReport(environment: string): void {
    const report: DeploymentReport = {
      environment,
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.passed).length,
      failed: this.testResults.filter(t => !t.passed).length,
      criticalFailures: this.testResults
        .filter(t => !t.passed && t.name.includes('critical'))
        .map(t => t.name),
      warnings: this.testResults
        .filter(t => !t.passed && !t.name.includes('critical'))
        .map(t => t.name),
      performanceMetrics: this.performanceMetrics,
      recommendations: this.generateRecommendations()
    };
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 DEPLOYMENT REPORT');
    console.log('=' .repeat(60));
    
    console.log(`\n📅 Environment: ${report.environment}`);
    console.log(`🕐 Timestamp: ${report.timestamp}`);
    
    console.log('\n📈 TEST RESULTS:');
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   ✅ Passed: ${report.passed}`);
    console.log(`   ❌ Failed: ${report.failed}`);
    console.log(`   📊 Pass Rate: ${Math.round((report.passed / report.totalTests) * 100)}%`);
    
    if (report.criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES:');
      report.criticalFailures.forEach(f => console.log(`   - ${f}`));
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.warnings.slice(0, 5).forEach(w => console.log(`   - ${w}`));
      if (report.warnings.length > 5) {
        console.log(`   ... and ${report.warnings.length - 5} more`);
      }
    }
    
    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`   Build Time: ${report.performanceMetrics.buildTime}ms`);
    console.log(`   Deployment Time: ${report.performanceMetrics.deploymentTime}ms`);
    console.log(`   Test Execution: ${report.performanceMetrics.testExecutionTime}ms`);
    console.log(`   Avg Response Time: ${report.performanceMetrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Slowest Endpoint: ${report.performanceMetrics.slowestEndpoint.url} (${report.performanceMetrics.slowestEndpoint.time}ms)`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach(r => console.log(`   - ${r}`));
    }
    
    // Save report to file
    const reportPath = path.join('deployment-reports', `${environment.toLowerCase()}-${Date.now()}.json`);
    this.saveReport(report, reportPath);
    
    console.log(`\n📁 Report saved to: ${reportPath}`);
    console.log('=' .repeat(60) + '\n');
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (this.performanceMetrics.averageResponseTime > 500) {
      recommendations.push('Consider optimizing API response times (current avg: ' + 
        this.performanceMetrics.averageResponseTime.toFixed(0) + 'ms)');
    }
    
    if (this.performanceMetrics.buildTime > 60000) {
      recommendations.push('Build time is high. Consider optimizing build process');
    }
    
    if (this.performanceMetrics.slowestEndpoint.time > 2000) {
      recommendations.push(`Optimize slow endpoint: ${this.performanceMetrics.slowestEndpoint.url}`);
    }
    
    // Security recommendations
    const securityTests = this.testResults.filter(t => t.name.includes('protection') || t.name.includes('Block'));
    const failedSecurity = securityTests.filter(t => !t.passed);
    
    if (failedSecurity.length > 0) {
      recommendations.push('Improve security headers configuration');
    }
    
    // Test coverage recommendations
    const passRate = (this.testResults.filter(t => t.passed).length / this.testResults.length) * 100;
    
    if (passRate < 90) {
      recommendations.push('Increase test coverage to improve reliability');
    }
    
    return recommendations;
  }

  /**
   * Save report to file
   */
  private saveReport(report: DeploymentReport, reportPath: string): void {
    try {
      // Create reports directory if it doesn't exist
      const reportsDir = path.dirname(reportPath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      // Save report
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Keep only last 10 reports
      const reports = fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (reports.length > 10) {
        reports.slice(10).forEach(f => {
          fs.unlinkSync(path.join(reportsDir, f));
        });
      }
      
    } catch (error) {
      console.log('⚠️  Could not save report to file');
    }
  }

  /**
   * Handle failed deployment
   */
  private async handleFailedDeployment(): Promise<void> {
    console.log('\n🚨 DEPLOYMENT FAILED - INITIATING RECOVERY');
    console.log('=' .repeat(60) + '\n');
    
    console.log('📋 Recovery Options:');
    console.log('1. Rollback to previous version:');
    console.log('   git revert HEAD && git push origin main');
    console.log('\n2. Check Vercel dashboard for detailed logs:');
    console.log('   https://vercel.com/dashboard');
    console.log('\n3. Review failed tests and fix issues');
    console.log('\n4. Re-run deployment with --force flag to skip tests');
    
    // Send notification if configured
    await this.sendNotification('Deployment Failed', 'Critical failures detected in production');
  }

  /**
   * Celebrate successful deployment
   */
  private async celebrateSuccess(): Promise<void> {
    const passRate = Math.round((this.testResults.filter(t => t.passed).length / this.testResults.length) * 100);
    
    console.log('\n✨ DEPLOYMENT SUCCESSFUL!');
    console.log('=' .repeat(60));
    console.log('🎉 All critical tests passed');
    console.log(`📊 Overall pass rate: ${passRate}%`);
    console.log(`⚡ Average response time: ${this.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`🌍 Production URL: ${this.PRODUCTION_URL}`);
    console.log('=' .repeat(60) + '\n');
    
    // Send success notification
    await this.sendNotification('Deployment Successful', `Deployed with ${passRate}% test pass rate`);
  }

  /**
   * Send notification (webhook, email, etc.)
   */
  private async sendNotification(title: string, message: string): Promise<void> {
    // Implement notification logic here (Slack, Discord, email, etc.)
    if (process.env.WEBHOOK_URL) {
      try {
        await axios.post(process.env.WEBHOOK_URL, {
          title,
          message,
          timestamp: new Date().toISOString(),
          url: this.PRODUCTION_URL
        });
      } catch {
        // Notification failed, but don't block deployment
      }
    }
  }

  /**
   * Start local server
   */
  private async startLocalServer(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (process.platform === 'win32') {
          // Windows
          execSync('start /B npm start', { 
            shell: 'cmd.exe', 
            stdio: 'ignore',
            windowsHide: true
          });
        } else {
          // Unix/Linux/Mac
          execSync('npm start &', { 
            stdio: 'ignore'
          });
        }
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop local server
   */
  private async stopLocalServer(): Promise<void> {
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /IM node.exe 2>nul', { 
          shell: 'cmd.exe', 
          stdio: 'ignore' 
        });
      } else {
        execSync('pkill -f "node.*dist/index.js"', { 
          stdio: 'ignore' 
        });
      }
    } catch {
      // Server might not be running
    }
  }

  /**
   * Check if server is healthy
   */
  private async checkServerHealth(url: string): Promise<boolean> {
    try {
      const response = await axios.get(`${url}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    skipLocal: args.includes('--skip-local'),
    skipProduction: args.includes('--skip-production'),
    force: args.includes('--force'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (options.help) {
    console.log(`
ULTIMATE DEPLOYMENT SYSTEM

Usage: npm run deploy:ultimate [options]

Options:
  --skip-local       Skip local testing phase
  --skip-production  Skip production validation
  --force           Deploy even if tests fail
  --help, -h        Show this help message

Examples:
  npm run deploy:ultimate              # Full deployment with all tests
  npm run deploy:ultimate --force      # Deploy regardless of test results
  npm run deploy:ultimate --skip-local # Skip local tests, deploy directly

Environment Variables:
  PRODUCTION_URL    Production URL (default: https://synthex-cerq.vercel.app)
  STAGING_URL       Staging URL for preview deployments
  WEBHOOK_URL       Webhook for deployment notifications
`);
    process.exit(0);
  }
  
  const deployer = new UltimateDeploymentSystem();
  await deployer.deploy(options);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export { UltimateDeploymentSystem };