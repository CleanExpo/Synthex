#!/usr/bin/env ts-node

/**
 * SYNTHEX Autonomous Build Executor
 * Starts the autonomous agent system to complete all remaining implementation tasks
 */

import { autonomousBuilder } from './src/agents/autonomous-builder-agent';
import { marketingOrchestrator } from './src/agents/marketing-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     🤖 SYNTHEX AUTONOMOUS BUILDER SYSTEM 🤖                     ║
║                                                                  ║
║     Initializing self-building agent network...                 ║
║     All tasks will be completed autonomously.                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`));

// Progress tracking
let spinner: any;
const startTime = Date.now();
const logs: string[] = [];

// Setup event listeners
autonomousBuilder.on('build-plan-loaded', (tasks: any[]) => {
  console.log(chalk.green(`✅ Build plan loaded: ${tasks.length} tasks queued`));
  console.log(chalk.gray('Tasks:'));
  tasks.forEach(task => {
    console.log(chalk.gray(`  • ${task.name} (Priority: ${task.priority})`));
  });
  console.log('');
});

autonomousBuilder.on('progress-update', (progress: any) => {
  if (spinner) spinner.stop();
  
  const progressBar = generateProgressBar(progress.percentage);
  console.log(chalk.yellow(`\n📊 Progress: ${progressBar} ${progress.percentage}%`));
  console.log(chalk.gray(`   Completed: ${progress.completed}/${progress.total}`));
  console.log(chalk.gray(`   In Progress: ${progress.inProgress}`));
  
  if (progress.failed > 0) {
    console.log(chalk.red(`   Failed: ${progress.failed}`));
  }
  
  spinner = ora('Processing tasks...').start();
});

autonomousBuilder.on('code-generated', (code: any) => {
  const log = `📝 Generated: ${code.filepath}`;
  logs.push(log);
  
  // Actually write the file
  const fullPath = path.join(process.cwd(), code.filepath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, code.content);
  
  if (spinner) spinner.text = `Generated ${path.basename(code.filepath)}`;
});

autonomousBuilder.on('test-complete', (result: any) => {
  const status = result.passed ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
  console.log(`\n${status}: ${result.testId}`);
});

autonomousBuilder.on('agent-error', (error: any) => {
  console.error(chalk.red(`\n❌ Error from ${error.agent}: ${error.error.message}`));
});

autonomousBuilder.on('build-complete', () => {
  if (spinner) spinner.stop();
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(chalk.green.bold(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     🎉 BUILD COMPLETE! 🎉                                       ║
║                                                                  ║
║     Duration: ${duration} minutes                               ║
║     Files Generated: ${logs.length}                             ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
  `));
  
  console.log(chalk.cyan('\n📋 Generated Files:'));
  logs.forEach(log => console.log(chalk.gray(`  ${log}`)));
  
  console.log(chalk.yellow('\n🚀 Next Steps:'));
  console.log(chalk.white('  1. Run: npm install'));
  console.log(chalk.white('  2. Run: npm run db:migrate'));
  console.log(chalk.white('  3. Run: npm run dev'));
  console.log(chalk.white('  4. Visit: http://localhost:3001'));
  
  process.exit(0);
});

// Marketing Orchestrator listeners
marketingOrchestrator.on('build-task-complete', (data: any) => {
  console.log(chalk.blue(`\n🔧 Orchestrator: ${data.agent} completed ${data.task.name}`));
});

marketingOrchestrator.on('insight', (data: any) => {
  console.log(chalk.magenta(`\n💡 Insight: ${JSON.stringify(data)}`));
});

marketingOrchestrator.on('strategic-insights', (recommendations: any) => {
  console.log(chalk.cyan(`\n🎯 Strategic Recommendations:`));
  if (recommendations.immediate.length > 0) {
    console.log(chalk.white('  Immediate:'));
    recommendations.immediate.forEach((r: string) => console.log(`    • ${r}`));
  }
});

// Helper function for progress bar
function generateProgressBar(percentage: number): string {
  const width = 30;
  const completed = Math.floor((percentage / 100) * width);
  const remaining = width - completed;
  
  return '[' + 
    chalk.green('█'.repeat(completed)) + 
    chalk.gray('░'.repeat(remaining)) + 
    ']';
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('\n❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Build interrupted by user'));
  if (spinner) spinner.stop();
  process.exit(0);
});

// Display initial system status
console.log(chalk.cyan('📊 System Status:'));
console.log(chalk.gray(`  • Node Version: ${process.version}`));
console.log(chalk.gray(`  • Platform: ${process.platform}`));
console.log(chalk.gray(`  • Working Directory: ${process.cwd()}`));
console.log(chalk.gray(`  • Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`));
console.log('');

// Start the build
spinner = ora('Initializing autonomous agents...').start();

// Give the system a moment to initialize
setTimeout(() => {
  spinner.text = 'Agents initialized. Starting build process...';
}, 2000);

// Monitor memory usage
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  if (heapUsed > heapTotal * 0.9) {
    console.warn(chalk.yellow(`\n⚠️  High memory usage: ${heapUsed}MB / ${heapTotal}MB`));
  }
}, 30000); // Check every 30 seconds

// Export for testing purposes
export { autonomousBuilder, marketingOrchestrator };