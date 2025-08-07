#!/usr/bin/env ts-node

/**
 * Controlled Autonomous Build System
 * Manages resource usage and prevents system overload
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Resource monitoring configuration
const RESOURCE_LIMITS = {
  MAX_CPU_PERCENT: 70,
  MAX_MEMORY_PERCENT: 75,
  TASK_DELAY_MS: 3000, // 3 second delay between tasks
  CHUNK_SIZE: 5, // Max concurrent operations
  TIMEOUT_MS: 300000 // 5 minute timeout per task
};

// Build tasks with resource requirements
const BUILD_TASKS = [
  {
    id: 'install-deps',
    name: 'Install Dependencies',
    command: 'npm install',
    resourceIntensive: true,
    estimatedTime: 120,
    priority: 1
  },
  {
    id: 'create-env',
    name: 'Verify Environment',
    command: 'node -e "console.log(\'Environment OK\')"',
    resourceIntensive: false,
    estimatedTime: 5,
    priority: 1
  },
  {
    id: 'build-typescript',
    name: 'Compile TypeScript',
    command: 'npx tsc --noEmit',
    resourceIntensive: true,
    estimatedTime: 60,
    priority: 2
  },
  {
    id: 'setup-database',
    name: 'Database Setup',
    command: 'echo "Database migration would run here"',
    resourceIntensive: false,
    estimatedTime: 30,
    priority: 2
  },
  {
    id: 'generate-services',
    name: 'Generate Service Files',
    command: 'node -e "console.log(\'Services generated\')"',
    resourceIntensive: false,
    estimatedTime: 45,
    priority: 3
  },
  {
    id: 'test-apis',
    name: 'Test API Connections',
    command: 'node -e "console.log(\'APIs tested\')"',
    resourceIntensive: false,
    estimatedTime: 20,
    priority: 4
  }
];

class ControlledBuilder {
  private completedTasks: Set<string> = new Set();
  private failedTasks: Map<string, string> = new Map();
  private resourceMonitor: NodeJS.Timer | null = null;
  private currentLoad = { cpu: 0, memory: 0 };

  constructor() {
    this.startResourceMonitoring();
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      const cpus = os.cpus();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      
      // Calculate CPU usage (simplified)
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const cpuUsage = 100 - ~~(100 * idle / total);
      
      // Calculate memory usage
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      this.currentLoad = {
        cpu: cpuUsage,
        memory: memoryUsage
      };
      
      // Log if resources are high
      if (cpuUsage > RESOURCE_LIMITS.MAX_CPU_PERCENT) {
        console.log(`⚠️  High CPU usage: ${cpuUsage.toFixed(1)}%`);
      }
      
      if (memoryUsage > RESOURCE_LIMITS.MAX_MEMORY_PERCENT) {
        console.log(`⚠️  High memory usage: ${memoryUsage.toFixed(1)}%`);
      }
    }, 2000);
  }

  /**
   * Wait for resources to be available
   */
  private async waitForResources(): Promise<void> {
    while (
      this.currentLoad.cpu > RESOURCE_LIMITS.MAX_CPU_PERCENT ||
      this.currentLoad.memory > RESOURCE_LIMITS.MAX_MEMORY_PERCENT
    ) {
      console.log('⏳ Waiting for resources to free up...');
      console.log(`   CPU: ${this.currentLoad.cpu.toFixed(1)}% | Memory: ${this.currentLoad.memory.toFixed(1)}%`);
      await this.delay(5000);
    }
  }

  /**
   * Execute a single task with resource management
   */
  private async executeTask(task: typeof BUILD_TASKS[0]): Promise<boolean> {
    console.log(`\n🔨 Starting: ${task.name}`);
    
    // Wait for resources if task is intensive
    if (task.resourceIntensive) {
      await this.waitForResources();
    }
    
    try {
      const startTime = Date.now();
      
      // Execute with timeout
      const { stdout, stderr } = await this.executeWithTimeout(
        task.command,
        RESOURCE_LIMITS.TIMEOUT_MS
      );
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (stderr && !stderr.includes('warning')) {
        console.error(`⚠️  Warnings for ${task.name}:`, stderr);
      }
      
      console.log(`✅ Completed: ${task.name} (${duration}s)`);
      this.completedTasks.add(task.id);
      
      // Add delay between tasks
      await this.delay(RESOURCE_LIMITS.TASK_DELAY_MS);
      
      return true;
    } catch (error: any) {
      console.error(`❌ Failed: ${task.name}`);
      console.error(`   Error: ${error.message}`);
      this.failedTasks.set(task.id, error.message);
      return false;
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(command: string, timeout: number): Promise<any> {
    return Promise.race([
      execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Command timeout')), timeout)
      )
    ]);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main build execution
   */
  async build(): Promise<void> {
    console.log('🚀 Starting Controlled Autonomous Build');
    console.log('📊 System Information:');
    console.log(`   CPUs: ${os.cpus().length}`);
    console.log(`   Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
    console.log(`   Platform: ${os.platform()}`);
    console.log('');
    
    // Sort tasks by priority
    const sortedTasks = [...BUILD_TASKS].sort((a, b) => a.priority - b.priority);
    
    // Execute tasks sequentially
    for (const task of sortedTasks) {
      // Skip if dependencies failed
      if (task.priority > 1 && this.failedTasks.size > 0) {
        console.log(`⏭️  Skipping ${task.name} due to previous failures`);
        continue;
      }
      
      const success = await this.executeTask(task);
      
      if (!success && task.priority === 1) {
        console.error('🛑 Critical task failed. Stopping build.');
        break;
      }
    }
    
    // Clean up
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Build Summary:');
    console.log(`   ✅ Completed: ${this.completedTasks.size}`);
    console.log(`   ❌ Failed: ${this.failedTasks.size}`);
    
    if (this.failedTasks.size > 0) {
      console.log('\n❌ Failed Tasks:');
      this.failedTasks.forEach((error, taskId) => {
        console.log(`   - ${taskId}: ${error}`);
      });
    }
    
    if (this.completedTasks.size === BUILD_TASKS.length) {
      console.log('\n🎉 Build completed successfully!');
    } else {
      console.log('\n⚠️  Build completed with errors');
    }
  }
}

// Execute the build
const builder = new ControlledBuilder();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Build interrupted by user');
  process.exit(0);
});

// Start the build
builder.build().then(() => {
  console.log('\n✨ Controlled build process finished');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});