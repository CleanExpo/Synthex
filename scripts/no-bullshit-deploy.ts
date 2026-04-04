#!/usr/bin/env ts-node
/**
 * NO BULLSHIT DEPLOYMENT
 * Only deploys if it ACTUALLY works
 */

import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import axios from 'axios';

dotenv.config();

const PRODUCTION_URL = 'https://synthex-cerq.vercel.app';

class NoBullshitDeployment {
  private criticalTests = [
    { url: '/', mustReturn: 200, description: 'Main page loads' },
    { url: '/health', mustReturn: 200, description: 'Health check works' },
    { url: '/favicon.ico', mustReturn: 200, description: 'Favicon exists' },
    { url: '/api/auth/login', method: 'POST', mustReturn: [400, 401], description: 'Login API responds' },
    { url: '/auth/google/status', mustReturn: 200, description: 'OAuth status works' }
  ];

  async runLocalTests(): Promise<boolean> {
    console.log('\n🏠 LOCAL TESTING (The Truth)\n' + '='.repeat(40));
    
    // Build the project
    console.log('📦 Building project...');
    try {
      execSync('npm run build:prod', { stdio: 'pipe' });
      console.log('✅ Build successful');
    } catch (error) {
      console.log('❌ BUILD FAILED - Not deploying broken code!');
      return false;
    }

    // Start local server
    console.log('\n🚀 Starting local server...');
    const server = this.startServer();
    await this.sleep(5000); // Give it time to start

    let allPassed = true;

    // Test each endpoint
    for (const test of this.criticalTests) {
      const result = await this.testEndpoint('http://localhost:3000', test);
      if (!result) {
        allPassed = false;
      }
    }

    // Stop server
    this.stopServer();

    return allPassed;
  }

  async verifyProduction(): Promise<boolean> {
    console.log('\n🌍 PRODUCTION VERIFICATION\n' + '='.repeat(40));
    console.log('⏳ Waiting 60 seconds for deployment...');
    await this.sleep(60000);

    let allPassed = true;

    for (const test of this.criticalTests) {
      const result = await this.testEndpoint(PRODUCTION_URL, test);
      if (!result) {
        allPassed = false;
      }
    }

    return allPassed;
  }

  private async testEndpoint(baseUrl: string, test: any): Promise<boolean> {
    try {
      const response = await axios({
        method: test.method || 'GET',
        url: `${baseUrl}${test.url}`,
        data: test.method === 'POST' ? {} : undefined,
        validateStatus: () => true,
        timeout: 10000
      });

      const expectedStatuses = Array.isArray(test.mustReturn) ? test.mustReturn : [test.mustReturn];
      const passed = expectedStatuses.includes(response.status);

      if (passed) {
        console.log(`✅ ${test.description}: ${response.status}`);
      } else {
        console.log(`❌ ${test.description}: Got ${response.status}, expected ${expectedStatuses.join(' or ')}`);
      }

      return passed;
    } catch (error: any) {
      console.log(`❌ ${test.description}: ${error.message}`);
      return false;
    }
  }

  private startServer(): any {
    try {
      if (process.platform === 'win32') {
        execSync('start /B npm start', { shell: 'cmd.exe', stdio: 'ignore' });
      } else {
        execSync('npm start &', { stdio: 'ignore' });
      }
      return true;
    } catch {
      return null;
    }
  }

  private stopServer(): void {
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /IM node.exe 2>nul', { shell: 'cmd.exe', stdio: 'ignore' });
      } else {
        execSync('pkill -f "node.*dist/index.js"', { stdio: 'ignore' });
      }
    } catch {
      // Server might not be running
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async deploy(): Promise<void> {
    console.log('🚫 NO BULLSHIT DEPLOYMENT SYSTEM');
    console.log('=================================\n');

    // Step 1: Test locally
    const localTestsPassed = await this.runLocalTests();
    
    if (!localTestsPassed) {
      console.log('\n❌ LOCAL TESTS FAILED');
      console.log('🚫 DEPLOYMENT BLOCKED - Fix your shit first!\n');
      process.exit(1);
    }

    console.log('\n✅ Local tests passed\n');

    // Step 2: Check git status
    console.log('📋 Checking git status...');
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    
    if (gitStatus.trim()) {
      console.log('📝 Committing changes...');
      execSync('git add -A', { stdio: 'inherit' });
      execSync(`git commit -m "deploy: Auto-commit after validation\n\nAll tests passed locally"`, { stdio: 'inherit' });
    }

    // Step 3: Deploy
    console.log('\n🚀 Deploying to Vercel...');
    execSync('git push origin main', { stdio: 'inherit' });

    // Step 4: Verify production
    const productionTestsPassed = await this.verifyProduction();

    console.log('\n' + '='.repeat(50));
    if (productionTestsPassed) {
      console.log('✅ DEPLOYMENT SUCCESSFUL AND VERIFIED!');
      console.log('🎉 Your shit actually works!');
    } else {
      console.log('❌ PRODUCTION VERIFICATION FAILED!');
      console.log('🚨 The deployment is broken in production!');
      console.log('\nTo rollback:');
      console.log('  git revert HEAD');
      console.log('  git push origin main');
    }
    console.log('='.repeat(50) + '\n');

    process.exit(productionTestsPassed ? 0 : 1);
  }
}

// Run the deployment
if (require.main === module) {
  const deployer = new NoBullshitDeployment();
  deployer.deploy().catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
}

export { NoBullshitDeployment };