#!/usr/bin/env node

/**
 * Production Environment Setup Script
 * This script helps you securely configure environment variables for production
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

interface EnvVariable {
  name: string;
  value?: string;
  required: boolean;
  description: string;
  generateMethod?: () => string;
  validate?: (value: string) => boolean;
}

class ProductionEnvSetup {
  private requiredVars: EnvVariable[] = [
    {
      name: 'NODE_ENV',
      value: 'production',
      required: true,
      description: 'Environment mode'
    },
    {
      name: 'JWT_SECRET',
      required: true,
      description: 'JWT signing secret (64+ characters)',
      generateMethod: () => crypto.randomBytes(64).toString('base64'),
      validate: (v) => v.length >= 64
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      description: 'Supabase project URL (https://[PROJECT-REF].supabase.co)',
      validate: (v) => v.startsWith('https://') && v.includes('.supabase.co')
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      description: 'Supabase anonymous key',
      validate: (v) => v.startsWith('eyJ') && v.length > 100
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      required: true,
      description: 'Supabase service role key (keep secret!)',
      validate: (v) => v.startsWith('eyJ') && v.length > 100
    },
    {
      name: 'DATABASE_URL',
      required: true,
      description: 'Prisma Accelerate connection string',
      validate: (v) => v.includes('accelerate.prisma-data.net') || v.startsWith('postgresql://')
    },
    {
      name: 'OPENROUTER_API_KEY',
      required: true,
      description: 'OpenRouter API key',
      validate: (v) => v.startsWith('sk-or-') && v.length > 20
    },
    {
      name: 'WEBHOOK_SECRET',
      required: false,
      description: 'Webhook validation secret',
      generateMethod: () => crypto.randomBytes(32).toString('hex')
    }
  ];

  async checkExistingEnv(): Promise<void> {
    console.log('🔍 Checking for exposed secrets in existing files...\n');
    
    const envFiles = ['.env', '.env.local', '.env.production'];
    const exposedSecrets: string[] = [];
    
    for (const file of envFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for exposed API keys
        const patterns = [
          /sk-[a-zA-Z0-9]{20,}/g,  // OpenAI style keys
          /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
          /ghp_[0-9a-zA-Z]{36}/g,   // GitHub tokens
          /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g // JWTs
        ];
        
        patterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            exposedSecrets.push(`Found exposed secret in ${file}: ${matches[0].substring(0, 10)}...`);
          }
        });
      }
    }
    
    if (exposedSecrets.length > 0) {
      console.log('⚠️  WARNING: Found exposed secrets:');
      exposedSecrets.forEach(s => console.log(`   - ${s}`));
      console.log('\n❗ These should be rotated immediately!\n');
    } else {
      console.log('✅ No exposed secrets found in env files.\n');
    }
  }

  generateSecureValues(): Map<string, string> {
    const values = new Map<string, string>();
    
    console.log('🔐 Generating secure values...\n');
    
    this.requiredVars.forEach(varDef => {
      if (varDef.generateMethod && !varDef.value) {
        const generated = varDef.generateMethod();
        values.set(varDef.name, generated);
        console.log(`✅ Generated ${varDef.name}: ${generated.substring(0, 20)}...`);
      } else if (varDef.value) {
        values.set(varDef.name, varDef.value);
      }
    });
    
    return values;
  }

  validateConfiguration(envVars: Map<string, string>): boolean {
    console.log('\n📋 Validating configuration...\n');
    
    let isValid = true;
    
    this.requiredVars.forEach(varDef => {
      const value = envVars.get(varDef.name);
      
      if (varDef.required && !value) {
        console.log(`❌ Missing required: ${varDef.name}`);
        console.log(`   ${varDef.description}`);
        isValid = false;
      } else if (value && varDef.validate && !varDef.validate(value)) {
        console.log(`⚠️  Invalid format: ${varDef.name}`);
        console.log(`   ${varDef.description}`);
        isValid = false;
      } else if (value) {
        console.log(`✅ Valid: ${varDef.name}`);
      }
    });
    
    return isValid;
  }

  generateVercelCommand(envVars: Map<string, string>): string {
    const commands: string[] = [];
    
    envVars.forEach((value, key) => {
      // Only show first 10 chars of sensitive values
      const displayValue = value.length > 20 ? `${value.substring(0, 10)}...` : value;
      commands.push(`vercel env add ${key} production`);
    });
    
    return commands.join('\n');
  }

  async createEnvTemplate(): Promise<void> {
    const templatePath = path.join(process.cwd(), '.env.production.template');
    const content: string[] = [
      '# Production Environment Variables Template',
      '# Generated on ' + new Date().toISOString(),
      '# ============================================',
      '# INSTRUCTIONS:',
      '# 1. Copy this file to .env.production',
      '# 2. Fill in all [PLACEHOLDER] values',
      '# 3. Use "npm run setup:production" to validate',
      '# 4. Deploy to Vercel using the dashboard',
      '# ============================================\n'
    ];
    
    this.requiredVars.forEach(varDef => {
      content.push(`# ${varDef.description}`);
      if (varDef.required) {
        content.push('# REQUIRED');
      }
      
      let value = varDef.value || '[PLACEHOLDER]';
      if (varDef.generateMethod && !varDef.value) {
        value = '[GENERATE-WITH-SCRIPT]';
      }
      
      content.push(`${varDef.name}=${value}\n`);
    });
    
    fs.writeFileSync(templatePath, content.join('\n'));
    console.log(`\n📄 Created template: ${templatePath}`);
  }

  async run(): Promise<void> {
    console.log('🚀 SYNTHEX Production Environment Setup\n');
    console.log('=' .repeat(50) + '\n');
    
    // Step 1: Check for exposed secrets
    await this.checkExistingEnv();
    
    // Step 2: Generate secure values
    const secureValues = this.generateSecureValues();
    
    // Step 3: Load existing production env if exists
    const prodEnvPath = path.join(process.cwd(), '.env.production');
    if (fs.existsSync(prodEnvPath)) {
      console.log('\n📂 Loading existing .env.production...');
      const content = fs.readFileSync(prodEnvPath, 'utf-8');
      content.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (!value.includes('[') && !value.includes('YOUR-')) {
              secureValues.set(key.trim(), value);
            }
          }
        }
      });
    }
    
    // Step 4: Validate
    const isValid = this.validateConfiguration(secureValues);
    
    // Step 5: Generate template
    await this.createEnvTemplate();
    
    // Step 6: Generate Vercel commands
    if (isValid) {
      console.log('\n🎯 Vercel Deployment Commands:\n');
      console.log('Run these commands to set environment variables in Vercel:');
      console.log('-'.repeat(50));
      console.log(this.generateVercelCommand(secureValues));
      console.log('-'.repeat(50));
    } else {
      console.log('\n❌ Configuration is incomplete. Please fill in missing values.');
    }
    
    // Step 7: Security recommendations
    console.log('\n🔒 Security Recommendations:');
    console.log('1. Never commit .env files to version control');
    console.log('2. Rotate API keys every 30-90 days');
    console.log('3. Use different keys for dev and production');
    console.log('4. Enable API key restrictions where possible');
    console.log('5. Monitor API usage for unusual activity');
    console.log('6. Use Vercel\'s secret management UI');
    
    console.log('\n✅ Setup script complete!');
  }
}

// Run the setup
const setup = new ProductionEnvSetup();
setup.run().catch(console.error);