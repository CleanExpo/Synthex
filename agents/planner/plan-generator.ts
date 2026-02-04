#!/usr/bin/env ts-node

/**
 * Team Planning Agent - Builder/Validator Pattern
 * Generates structured execution plans with atomic Builder/Validator task pairs
 * 
 * This module implements the plan_w_team() pattern as a TypeScript/Node.js solution
 * integrated with the Synthex agent orchestration framework.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

// Configuration
const CONFIG = {
  SPECS_DIR: path.resolve(process.cwd(), 'specs'),
  TEMPLATES_DIR: path.resolve(__dirname, 'templates'),
  DEFAULT_MODEL: 'anthropic/claude-3.5-sonnet',
  PLAN_FILENAME: 'plan.md',
  ARCHIVE_PREFIX: 'plan-'
};

// Architecture Context - The Constant
const ARCHITECTURE_CONTEXT = `
<team_structure>
    <agent type="builder">
        <role>Implementation</role>
        <responsibility>Write code, update configs, edit files.</responsibility>
        <constraints>
            <item>Follow existing code patterns and conventions</item>
            <item>Implement complete, functional units</item>
            <item>Include error handling and validation</item>
            <item>Write inline documentation</item>
        </constraints>
    </agent>
    <agent type="validator">
        <role>Quality Assurance</role>
        <responsibility>Verify file existence, check syntax, run specific tests, ensure requirements are met.</responsibility>
        <constraints>
            <item>MUST run immediately after a Builder completes a task</item>
            <item>Use ci-verify.js patterns for automated checks</item>
            <item>Report specific failures with remediation steps</item>
            <item>Block progression until validation passes</item>
        </constraints>
    </agent>
</team_structure>

<execution_rules>
    <rule>Maximum 2 agents working concurrently (per CLAUDE.md)</rule>
    <rule>Each Builder task MUST be followed by a Validator task</rule>
    <rule>Tasks must be atomic and independently verifiable</rule>
    <rule>Failed validations trigger Builder re-execution</rule>
</execution_rules>
`;

// Template Instruction - The Constraints
const TEMPLATE_INSTRUCTION = `
You are the Lead Architect. Generate an execution plan following the strict Builder/Validator pattern.

CRITICAL RULES:
1. Break ALL work into atomic units
2. Every unit MUST follow this strict sequence:
   - [Task N] Builder: <Specific Implementation Step>
   - [Task N+1] Validator: <Specific Verification Step for Task N>
3. NO free-form text - only structured task lists
4. Tasks must reference specific files, functions, or components
5. Include file paths in task descriptions
6. Validation must be automated and verifiable

OUTPUT FORMAT (Strict Markdown):
# Execution Plan: {TASK_TITLE}

## Metadata
- Generated: {TIMESTAMP}
- Task: {FULL_TASK_DESCRIPTION}
- Estimated Duration: {DURATION}
- Complexity: {LOW|MEDIUM|HIGH}

## Phase 1: Setup & Foundation
- [ ] **Task 1 (Builder)**: {Specific implementation with file paths}
- [ ] **Task 2 (Validator)**: Verify {Task 1 result} by checking {specific files/tests}

## Phase 2: Core Implementation
- [ ] **Task 3 (Builder)**: {Next implementation step}
- [ ] **Task 4 (Validator)**: {Validation for Task 3}

## Phase 3: Integration & Testing
- [ ] **Task N (Builder)**: {Integration implementation}
- [ ] **Task N+1 (Validator)**: {Integration testing}

## Phase 4: Documentation & Final Validation
- [ ] **Task N+2 (Builder)**: Update documentation
- [ ] **Task N+3 (Validator)**: Verify documentation reflects changes

## Validation Checklist
- [ ] All files created/modified exist
- [ ] Syntax checks pass
- [ ] Type checking passes
- [ ] Tests run successfully
- [ ] No breaking changes introduced
`;

interface PlanOptions {
  task: string;
  model?: string;
  archive?: boolean;
  verbose?: boolean;
}

/**
 * Generate a timestamp string for file naming
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Archive existing plan if it exists
 */
function archiveExistingPlan(): void {
  const planPath = path.join(CONFIG.SPECS_DIR, CONFIG.PLAN_FILENAME);
  
  if (fs.existsSync(planPath)) {
    const timestamp = getTimestamp();
    const archiveName = `${CONFIG.ARCHIVE_PREFIX}${timestamp}-${Date.now()}.md`;
    const archivePath = path.join(CONFIG.SPECS_DIR, 'archive', archiveName);
    
    // Ensure archive directory exists
    const archiveDir = path.dirname(archivePath);
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    fs.renameSync(planPath, archivePath);
    console.log(`📁 Archived existing plan to: specs/archive/${archiveName}`);
  }
}

/**
 * Call AI to generate the execution plan
 */
async function generatePlanWithAI(task: string, model: string): Promise<string> {
  const systemPrompt = `${ARCHITECTURE_CONTEXT}\n\n${TEMPLATE_INSTRUCTION}`;
  const userPrompt = `Generate an execution plan for the following task:\n\n"${task}"\n\nRequirements:\n- Break into atomic Builder/Validator pairs\n- Include specific file paths\n- Make validation steps automated\n- Follow Synthex project structure\n- Consider existing agent patterns\n- Include error handling considerations`;

  try {
    console.log('🤖 Calling AI to generate plan...');
    
    // Use OpenRouter with Claude model
    const { text } = await generateText({
      model: openai(model, {
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://synthex.social',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'SYNTHEX',
        },
      }),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4000,
      temperature: 0.3,
    });

    return text;
  } catch (error: any) {
    console.error('❌ AI generation failed:', error.message);
    throw error;
  }
}

/**
 * Write plan to file
 */
function writePlanToFile(planContent: string, task: string): string {
  const planPath = path.join(CONFIG.SPECS_DIR, CONFIG.PLAN_FILENAME);
  
  // Add header with generation metadata
  const header = `<!--
Generated: ${new Date().toISOString()}
Task: ${task}
Generator: Team Planning Agent (Builder/Validator Pattern)
Framework: Synthex Agent Orchestration
-->

`;

  const fullContent = header + planContent;
  
  fs.writeFileSync(planPath, fullContent, 'utf-8');
  return planPath;
}

/**
 * Main planning function - implements plan_w_team()
 */
export async function planWithTeam(options: PlanOptions): Promise<void> {
  const { task, model = CONFIG.DEFAULT_MODEL, archive = true, verbose = false } = options;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🤖 Team Planning Agent - Builder/Validator           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`📝 Task: ${task}`);
  console.log(`🤖 Model: ${model}`);
  console.log();

  try {
    // Archive existing plan if requested
    if (archive) {
      archiveExistingPlan();
    }

    // Generate plan with AI
    console.log('🔨 Architecting strict Builder/Validator plan...');
    const planContent = await generatePlanWithAI(task, model);

    if (verbose) {
      console.log('\n📋 Generated Plan Preview:');
      console.log('─'.repeat(60));
      console.log(planContent.substring(0, 500) + '...');
      console.log('─'.repeat(60));
      console.log();
    }

    // Write plan to file
    const planPath = writePlanToFile(planContent, task);

    console.log('✅ Plan generated successfully!');
    console.log(`📄 Written to: ${path.relative(process.cwd(), planPath)}`);
    console.log();
    console.log('Next steps:');
    console.log('  1. Review the plan: code specs/plan.md');
    console.log('  2. Execute tasks following Builder → Validator pattern');
    console.log('  3. Update checkboxes as tasks complete');
    console.log('  4. Run validators after each builder task');

  } catch (error: any) {
    console.error('\n❌ Plan generation failed:', error.message);
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: tsx plan-generator.ts "Your task description here" [options]');
    console.log();
    console.log('Options:');
    console.log('  --model <model>     AI model to use (default: anthropic/claude-3.5-sonnet)');
    console.log('  --no-archive        Don\'t archive existing plan');
    console.log('  --verbose           Show plan preview in console');
    console.log();
    console.log('Examples:');
    console.log('  tsx plan-generator.ts "Implement user authentication"');
    console.log('  tsx plan-generator.ts "Create dashboard analytics" --verbose');
    process.exit(1);
  }

  // Parse arguments
  const taskParts: string[] = [];
  let model = CONFIG.DEFAULT_MODEL;
  let archive = true;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--model' && i + 1 < args.length) {
      model = args[++i];
    } else if (arg === '--no-archive') {
      archive = false;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('--')) {
      taskParts.push(arg);
    }
  }

  const task = taskParts.join(' ');

  if (!task.trim()) {
    console.error('❌ Error: Task description is required');
    process.exit(1);
  }

  // Run the planner
  planWithTeam({ task, model, archive, verbose }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

// Run if called directly
if (require.main === module) {
  main();
}
