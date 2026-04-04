/**
 * Launch Build Agent
 * Command-line interface to start the build orchestrator
 */

import { buildOrchestrator } from './build-orchestrator';
import { marketingOrchestrator } from './marketing-orchestrator';
import { masterOrchestrator } from './master-orchestrator';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface BuildCommand {
  command: string;
  description: string;
  handler: () => Promise<void>;
}

const commands: BuildCommand[] = [
  {
    command: 'start',
    description: 'Start the complete build process',
    handler: async () => {
      console.log('\n🚀 Initializing Build Orchestrator...');
      await buildOrchestrator.startBuild();
    }
  },
  {
    command: 'status',
    description: 'Get current build status',
    handler: async () => {
      const status = buildOrchestrator.getBuildStatus();
      console.log('\n📊 Build Status:');
      console.log(JSON.stringify(status, null, 2));
    }
  },
  {
    command: 'pause',
    description: 'Pause the build process',
    handler: async () => {
      buildOrchestrator.pauseBuild();
      console.log('\n⏸️ Build process paused');
    }
  },
  {
    command: 'resume',
    description: 'Resume the build process',
    handler: async () => {
      console.log('\n▶️ Resuming build process...');
      await buildOrchestrator.resumeBuild();
    }
  },
  {
    command: 'agents',
    description: 'Show all agent statuses',
    handler: async () => {
      const status = buildOrchestrator.getBuildStatus();
      console.log('\n🤖 Agent Status:');
      status.agents.details.forEach((agent: any) => {
        console.log(`\n${agent.name}:`);
        console.log(`  Status: ${agent.status}`);
        console.log(`  Completed Tasks: ${agent.completedTasks}`);
        console.log(`  Success Rate: ${agent.successRate}%`);
        if (agent.currentTask) {
          console.log(`  Current Task: ${agent.currentTask}`);
        }
      });
    }
  },
  {
    command: 'phases',
    description: 'Show build phases progress',
    handler: async () => {
      const status = buildOrchestrator.getBuildStatus();
      console.log('\n📋 Build Phases:');
      status.phases.details.forEach((phase: any) => {
        const progressBar = '█'.repeat(Math.floor(phase.progress / 10)) + '░'.repeat(10 - Math.floor(phase.progress / 10));
        console.log(`\n${phase.name}:`);
        console.log(`  Status: ${phase.status}`);
        console.log(`  Progress: [${progressBar}] ${phase.progress}%`);
        console.log(`  Tasks: ${phase.tasks}`);
      });
    }
  },
  {
    command: 'marketing',
    description: 'Show marketing orchestrator status',
    handler: async () => {
      const status = marketingOrchestrator.getComprehensiveStatus();
      console.log('\n📈 Marketing Orchestrator Status:');
      console.log(JSON.stringify(status, null, 2));
    }
  },
  {
    command: 'master',
    description: 'Show master orchestrator status',
    handler: async () => {
      const status = masterOrchestrator.getSystemStatus();
      console.log('\n🎭 Master Orchestrator Status:');
      console.log(JSON.stringify(status, null, 2));
    }
  },
  {
    command: 'help',
    description: 'Show available commands',
    handler: async () => {
      console.log('\n📚 Available Commands:');
      commands.forEach(cmd => {
        console.log(`  ${cmd.command.padEnd(12)} - ${cmd.description}`);
      });
    }
  },
  {
    command: 'exit',
    description: 'Exit the build agent',
    handler: async () => {
      console.log('\n👋 Shutting down Build Agent...');
      process.exit(0);
    }
  }
];

function setupEventListeners() {
  // Build Orchestrator events
  buildOrchestrator.on('build:started', () => {
    console.log('\n🏗️ Build process started!');
  });

  buildOrchestrator.on('build:completed', (data) => {
    console.log('\n✅ Build process completed!');
    console.log(`  Total Tasks: ${data.totalTasks}`);
    console.log(`  Success Rate: ${data.successRate.toFixed(2)}%`);
    console.log(`  Duration: ${(data.duration / 1000 / 60).toFixed(2)} minutes`);
  });

  buildOrchestrator.on('phase:started', (phase) => {
    console.log(`\n🔄 Phase started: ${phase.name}`);
  });

  buildOrchestrator.on('phase:completed', (phase) => {
    console.log(`\n✅ Phase completed: ${phase.name}`);
  });

  buildOrchestrator.on('phase:progress', (data) => {
    const progressBar = '█'.repeat(Math.floor(data.progress / 10)) + '░'.repeat(10 - Math.floor(data.progress / 10));
    process.stdout.write(`\r  ${data.phase}: [${progressBar}] ${data.progress}% (${data.completed}/${data.total})`);
  });

  buildOrchestrator.on('task:started', (data) => {
    console.log(`\n🤖 ${data.agent.name}: ${data.task.data.description}`);
  });

  buildOrchestrator.on('task:completed', (data) => {
    console.log(`  ✅ Completed in ${data.task.estimatedDuration}min`);
  });

  buildOrchestrator.on('task:failed', (data) => {
    console.log(`  ❌ Failed: ${data.error.message}`);
  });
}

async function promptCommand(): Promise<void> {
  rl.question('\nbuild-agent> ', async (input) => {
    const cmd = input.trim().toLowerCase();
    const command = commands.find(c => c.command === cmd);
    
    if (command) {
      try {
        await command.handler();
      } catch (error: any) {
        console.error(`\n❌ Error: ${error.message}`);
      }
    } else if (cmd !== '') {
      console.log(`\n❌ Unknown command: ${cmd}`);
      console.log('Type "help" for available commands');
    }
    
    // Continue prompting
    promptCommand();
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                 🏗️  BUILD ORCHESTRATOR AGENT  🏗️              ║
║                                                              ║
║         Autonomous Marketing Application Builder            ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  This orchestrator coordinates specialized sub-agents to    ║
║  build your complete Auto Marketing application:            ║
║                                                              ║
║  • UX Researcher - Market analysis & user personas          ║
║  • Content Creator - Hooks & viral content strategies       ║
║  • Visual Designer - UI/UX design & workspace setup         ║
║  • Platform Specialist - Cross-platform optimization        ║
║  • Performance Optimizer - Analytics & dashboards           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('\n📋 Type "help" for available commands or "start" to begin building\n');

  // Setup event listeners
  setupEventListeners();

  // Start master orchestrator in the background
  console.log('🎭 Initializing Master Orchestrator...');
  await masterOrchestrator.start();
  console.log('✅ Master Orchestrator ready\n');

  // Start command prompt
  promptCommand();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\n👋 Gracefully shutting down...');
  await masterOrchestrator.stop();
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});