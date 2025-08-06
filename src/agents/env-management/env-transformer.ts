import { EnvAgent, EnvVariable, AgentResult, AgentOptions } from './base-env-agent';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type EnvFormat = 'dotenv' | 'json' | 'yaml' | 'ini' | 'xml' | 'toml' | 'shell' | 'docker' | 'kubernetes';

export interface TransformOptions {
  sourceFormat: EnvFormat;
  targetFormat: EnvFormat;
  platform?: 'vercel' | 'netlify' | 'heroku' | 'aws' | 'azure' | 'gcp' | 'docker';
  expandVariables?: boolean;
  includeComments?: boolean;
  groupByCategory?: boolean;
  encryptSensitive?: boolean;
}

export interface PlatformConfig {
  vercel: { projectId?: string; token?: string };
  netlify: { siteId?: string; token?: string };
  heroku: { appName?: string; apiKey?: string };
  aws: { region?: string; profile?: string };
  azure: { resourceGroup?: string; appName?: string };
  gcp: { projectId?: string; keyFile?: string };
  docker: { imageName?: string; tag?: string };
}

export class EnvTransformer extends EnvAgent {
  private platformConfig: Partial<PlatformConfig> = {};

  constructor(options: AgentOptions & { platformConfig?: Partial<PlatformConfig> }) {
    super(options);
    if (options.platformConfig) {
      this.platformConfig = options.platformConfig;
    }
  }

  async transform(
    inputPath: string,
    outputPath: string,
    options: TransformOptions
  ): Promise<AgentResult> {
    try {
      const variables = await this.loadFromFormat(inputPath, options.sourceFormat);
      
      if (options.expandVariables) {
        this.expandVariables(variables);
      }

      if (options.encryptSensitive) {
        await this.encryptSensitiveValues(variables);
      }

      const output = await this.saveToFormat(
        variables,
        outputPath,
        options.targetFormat,
        options
      );

      this.emit('transform-complete', {
        sourceFormat: options.sourceFormat,
        targetFormat: options.targetFormat,
        variableCount: variables.size
      });

      return {
        success: true,
        message: `Transformed ${variables.size} variables from ${options.sourceFormat} to ${options.targetFormat}`,
        data: {
          inputPath,
          outputPath,
          variables: Array.from(variables.entries()),
          format: options.targetFormat
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: `Transformation failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  private async loadFromFormat(
    filePath: string,
    format: EnvFormat
  ): Promise<Map<string, string>> {
    const content = await fs.readFile(filePath, 'utf-8');

    switch (format) {
      case 'dotenv':
        return this.loadEnvFile(filePath);
      
      case 'json':
        return this.parseJson(content);
      
      case 'yaml':
        return this.parseYaml(content);
      
      case 'ini':
        return this.parseIni(content);
      
      case 'xml':
        return this.parseXml(content);
      
      case 'toml':
        return this.parseToml(content);
      
      case 'shell':
        return this.parseShell(content);
      
      case 'docker':
        return this.parseDockerEnv(content);
      
      case 'kubernetes':
        return this.parseKubernetesConfigMap(content);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async saveToFormat(
    variables: Map<string, string>,
    outputPath: string,
    format: EnvFormat,
    options: TransformOptions
  ): Promise<void> {
    let content: string;

    switch (format) {
      case 'dotenv':
        content = this.toDotenv(variables, options);
        break;
      
      case 'json':
        content = this.toJson(variables, options);
        break;
      
      case 'yaml':
        content = this.toYaml(variables, options);
        break;
      
      case 'ini':
        content = this.toIni(variables, options);
        break;
      
      case 'xml':
        content = this.toXml(variables, options);
        break;
      
      case 'toml':
        content = this.toToml(variables, options);
        break;
      
      case 'shell':
        content = this.toShell(variables, options);
        break;
      
      case 'docker':
        content = this.toDockerEnv(variables, options);
        break;
      
      case 'kubernetes':
        content = this.toKubernetesConfigMap(variables, options);
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    this.log('info', `Saved transformed variables to ${outputPath}`);
  }

  private parseJson(content: string): Map<string, string> {
    const json = JSON.parse(content);
    const variables = new Map<string, string>();

    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey.toUpperCase());
        } else {
          variables.set(newKey.toUpperCase(), String(value));
        }
      }
    };

    flatten(json);
    return variables;
  }

  private parseYaml(content: string): Map<string, string> {
    const yamlData = yaml.load(content) as any;
    const variables = new Map<string, string>();

    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flatten(value, newKey.toUpperCase());
        } else {
          variables.set(newKey.toUpperCase(), String(value));
        }
      }
    };

    flatten(yamlData);
    return variables;
  }

  private parseIni(content: string): Map<string, string> {
    const variables = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1).toUpperCase();
      } else if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const fullKey = currentSection ? `${currentSection}_${key.trim()}` : key.trim();
        variables.set(fullKey.toUpperCase(), valueParts.join('=').trim());
      }
    }

    return variables;
  }

  private parseXml(content: string): Map<string, string> {
    const variables = new Map<string, string>();
    const envVarRegex = /<variable\s+name="([^"]+)"\s+value="([^"]+)"\s*\/>/g;
    const configRegex = /<add\s+key="([^"]+)"\s+value="([^"]+)"\s*\/>/g;
    
    let match;
    while ((match = envVarRegex.exec(content)) !== null) {
      variables.set(match[1].toUpperCase(), match[2]);
    }
    
    while ((match = configRegex.exec(content)) !== null) {
      variables.set(match[1].toUpperCase(), match[2]);
    }

    return variables;
  }

  private parseToml(content: string): Map<string, string> {
    const variables = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1).replace(/\./g, '_').toUpperCase();
      } else if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        const fullKey = currentSection ? `${currentSection}_${key.trim()}` : key.trim();
        variables.set(fullKey.toUpperCase(), value);
      }
    }

    return variables;
  }

  private parseShell(content: string): Map<string, string> {
    const variables = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('export ')) {
        const exportLine = trimmed.substring(7);
        const [key, ...valueParts] = exportLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          variables.set(key.trim(), value);
        }
      }
    }

    return variables;
  }

  private parseDockerEnv(content: string): Map<string, string> {
    const variables = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('ENV ')) {
        const envLine = trimmed.substring(4);
        const spaceIndex = envLine.indexOf(' ');
        if (spaceIndex > 0) {
          const key = envLine.substring(0, spaceIndex);
          const value = envLine.substring(spaceIndex + 1).replace(/^["']|["']$/g, '');
          variables.set(key, value);
        }
      } else if (trimmed.includes('=') && !trimmed.startsWith('RUN') && !trimmed.startsWith('CMD')) {
        const [key, ...valueParts] = trimmed.split('=');
        variables.set(key.trim(), valueParts.join('=').replace(/^["']|["']$/g, ''));
      }
    }

    return variables;
  }

  private parseKubernetesConfigMap(content: string): Map<string, string> {
    try {
      const k8sConfig = yaml.load(content) as any;
      const variables = new Map<string, string>();

      if (k8sConfig.data) {
        for (const [key, value] of Object.entries(k8sConfig.data)) {
          variables.set(key, String(value));
        }
      }

      if (k8sConfig.stringData) {
        for (const [key, value] of Object.entries(k8sConfig.stringData)) {
          variables.set(key, String(value));
        }
      }

      return variables;
    } catch {
      return new Map();
    }
  }

  private toDotenv(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = [];
    
    if (options.includeComments) {
      lines.push('# Environment Variables');
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('');
    }

    if (options.groupByCategory) {
      const categorized = this.categorizeVariables(variables);
      
      for (const [category, vars] of Object.entries(categorized)) {
        if (vars.length === 0) continue;
        
        if (options.includeComments) {
          lines.push(`# ${category}`);
          lines.push('#' + '='.repeat(40));
        }
        
        for (const [key, value] of vars) {
          const needsQuotes = value.includes(' ') || value.includes('=');
          const formattedValue = needsQuotes ? `"${value}"` : value;
          lines.push(`${key}=${formattedValue}`);
        }
        
        lines.push('');
      }
    } else {
      for (const [key, value] of variables) {
        const needsQuotes = value.includes(' ') || value.includes('=');
        const formattedValue = needsQuotes ? `"${value}"` : value;
        lines.push(`${key}=${formattedValue}`);
      }
    }

    return lines.join('\n');
  }

  private toJson(variables: Map<string, string>, options: TransformOptions): string {
    const obj: any = {};
    
    if (options.groupByCategory) {
      const categorized = this.categorizeVariables(variables);
      for (const [category, vars] of Object.entries(categorized)) {
        if (vars.length > 0) {
          obj[category] = Object.fromEntries(vars);
        }
      }
    } else {
      for (const [key, value] of variables) {
        obj[key] = value;
      }
    }

    return JSON.stringify(obj, null, 2);
  }

  private toYaml(variables: Map<string, string>, options: TransformOptions): string {
    const obj: any = {};
    
    if (options.groupByCategory) {
      const categorized = this.categorizeVariables(variables);
      for (const [category, vars] of Object.entries(categorized)) {
        if (vars.length > 0) {
          obj[category.toLowerCase().replace(/ /g, '_')] = Object.fromEntries(vars);
        }
      }
    } else {
      for (const [key, value] of variables) {
        obj[key] = value;
      }
    }

    return yaml.dump(obj, { indent: 2 });
  }

  private toIni(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = [];
    
    if (options.groupByCategory) {
      const categorized = this.categorizeVariables(variables);
      
      for (const [category, vars] of Object.entries(categorized)) {
        if (vars.length === 0) continue;
        
        lines.push(`[${category.toLowerCase().replace(/ /g, '_')}]`);
        
        for (const [key, value] of vars) {
          lines.push(`${key} = ${value}`);
        }
        
        lines.push('');
      }
    } else {
      lines.push('[environment]');
      for (const [key, value] of variables) {
        lines.push(`${key} = ${value}`);
      }
    }

    return lines.join('\n');
  }

  private toXml(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<configuration>',
      '  <appSettings>'
    ];

    for (const [key, value] of variables) {
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      lines.push(`    <add key="${key}" value="${escapedValue}" />`);
    }

    lines.push('  </appSettings>', '</configuration>');
    return lines.join('\n');
  }

  private toToml(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = [];
    
    if (options.includeComments) {
      lines.push('# Environment Configuration');
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('');
    }

    if (options.groupByCategory) {
      const categorized = this.categorizeVariables(variables);
      
      for (const [category, vars] of Object.entries(categorized)) {
        if (vars.length === 0) continue;
        
        lines.push(`[${category.toLowerCase().replace(/ /g, '_')}]`);
        
        for (const [key, value] of vars) {
          const formattedValue = value.includes('"') ? `'${value}'` : `"${value}"`;
          lines.push(`${key} = ${formattedValue}`);
        }
        
        lines.push('');
      }
    } else {
      lines.push('[env]');
      for (const [key, value] of variables) {
        const formattedValue = value.includes('"') ? `'${value}'` : `"${value}"`;
        lines.push(`${key} = ${formattedValue}`);
      }
    }

    return lines.join('\n');
  }

  private toShell(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = ['#!/bin/bash'];
    
    if (options.includeComments) {
      lines.push('# Environment Variables Export Script');
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('');
    }

    for (const [key, value] of variables) {
      const escapedValue = value.replace(/"/g, '\\"');
      lines.push(`export ${key}="${escapedValue}"`);
    }

    return lines.join('\n');
  }

  private toDockerEnv(variables: Map<string, string>, options: TransformOptions): string {
    const lines: string[] = [];
    
    if (options.includeComments) {
      lines.push('# Docker Environment Variables');
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('');
    }

    for (const [key, value] of variables) {
      if (value.includes(' ') || value.includes('"')) {
        lines.push(`ENV ${key} "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`ENV ${key} ${value}`);
      }
    }

    return lines.join('\n');
  }

  private toKubernetesConfigMap(variables: Map<string, string>, options: TransformOptions): string {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'app-config',
        namespace: 'default'
      },
      data: Object.fromEntries(variables)
    };

    return yaml.dump(configMap, { indent: 2 });
  }

  private expandVariables(variables: Map<string, string>): void {
    const maxIterations = 10;
    let iteration = 0;
    let hasChanges = true;

    while (hasChanges && iteration < maxIterations) {
      hasChanges = false;
      iteration++;

      for (const [key, value] of variables) {
        const expandedValue = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          const replacement = variables.get(varName) || process.env[varName] || match;
          if (replacement !== match) {
            hasChanges = true;
          }
          return replacement;
        });

        if (expandedValue !== value) {
          variables.set(key, expandedValue);
        }
      }
    }
  }

  private async encryptSensitiveValues(variables: Map<string, string>): Promise<void> {
    const sensitivePatterns = [
      /key/i, /secret/i, /password/i, /token/i,
      /credential/i, /private/i
    ];

    for (const [key, value] of variables) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitive && !value.startsWith('enc[')) {
        const algorithm = 'aes-256-gcm';
        const keyBuffer = Buffer.from(this.generateChecksum(key).substring(0, 32));
        const iv = Buffer.from(this.generateChecksum(value).substring(0, 16));
        
        try {
          const cipher = require('crypto').createCipheriv(algorithm, keyBuffer, iv);
          let encrypted = cipher.update(value, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          const authTag = cipher.getAuthTag();
          
          variables.set(key, `enc[${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}]`);
        } catch (error) {
          this.log('warn', `Failed to encrypt ${key}`, error);
        }
      }
    }
  }

  private categorizeVariables(variables: Map<string, string>): Record<string, Array<[string, string]>> {
    const categories: Record<string, Array<[string, string]>> = {
      'Core': [],
      'Database': [],
      'API': [],
      'Security': [],
      'Features': [],
      'Other': []
    };

    for (const [key, value] of variables) {
      const lowerKey = key.toLowerCase();
      
      if (lowerKey.includes('node_env') || lowerKey.includes('port') || lowerKey.includes('host')) {
        categories['Core'].push([key, value]);
      } else if (lowerKey.includes('db') || lowerKey.includes('database') || lowerKey.includes('postgres') || lowerKey.includes('mysql')) {
        categories['Database'].push([key, value]);
      } else if (lowerKey.includes('api') || lowerKey.includes('endpoint') || lowerKey.includes('url')) {
        categories['API'].push([key, value]);
      } else if (lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('auth')) {
        categories['Security'].push([key, value]);
      } else if (lowerKey.includes('enable') || lowerKey.includes('feature') || lowerKey.includes('flag')) {
        categories['Features'].push([key, value]);
      } else {
        categories['Other'].push([key, value]);
      }
    }

    return categories;
  }

  async convertToPlatform(
    inputPath: string,
    platform: string,
    deploy: boolean = false
  ): Promise<AgentResult> {
    try {
      const variables = await this.loadEnvFile(inputPath);
      
      switch (platform) {
        case 'vercel':
          return this.deployToVercel(variables, deploy);
        case 'netlify':
          return this.deployToNetlify(variables, deploy);
        case 'heroku':
          return this.deployToHeroku(variables, deploy);
        case 'aws':
          return this.deployToAWS(variables, deploy);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      return {
        success: false,
        message: `Platform conversion failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  private async deployToVercel(variables: Map<string, string>, deploy: boolean): Promise<AgentResult> {
    const vercelEnv = {
      env: Object.fromEntries(variables),
      build: {
        env: Object.fromEntries(
          Array.from(variables).filter(([k]) => k.startsWith('BUILD_'))
        )
      }
    };

    const outputPath = path.join(this.projectPath, 'vercel.json');
    await fs.writeFile(outputPath, JSON.stringify(vercelEnv, null, 2), 'utf-8');

    if (deploy && this.platformConfig.vercel?.token) {
      this.log('info', 'Deploying to Vercel...');
    }

    return {
      success: true,
      message: 'Converted to Vercel format',
      data: { outputPath, variables: vercelEnv },
      timestamp: new Date()
    };
  }

  private async deployToNetlify(variables: Map<string, string>, deploy: boolean): Promise<AgentResult> {
    const netlifyToml = `[build.environment]\n` +
      Array.from(variables)
        .map(([k, v]) => `  ${k} = "${v}"`)
        .join('\n');

    const outputPath = path.join(this.projectPath, 'netlify.toml');
    await fs.writeFile(outputPath, netlifyToml, 'utf-8');

    return {
      success: true,
      message: 'Converted to Netlify format',
      data: { outputPath },
      timestamp: new Date()
    };
  }

  private async deployToHeroku(variables: Map<string, string>, deploy: boolean): Promise<AgentResult> {
    const herokuConfig = Array.from(variables)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');

    const outputPath = path.join(this.projectPath, '.env.heroku');
    await fs.writeFile(outputPath, herokuConfig, 'utf-8');

    return {
      success: true,
      message: 'Converted to Heroku format',
      data: { outputPath },
      timestamp: new Date()
    };
  }

  private async deployToAWS(variables: Map<string, string>, deploy: boolean): Promise<AgentResult> {
    const awsParams = Array.from(variables).map(([k, v]) => ({
      Name: `/${this.environment}/${k}`,
      Value: v,
      Type: 'SecureString'
    }));

    const outputPath = path.join(this.projectPath, 'aws-parameters.json');
    await fs.writeFile(outputPath, JSON.stringify(awsParams, null, 2), 'utf-8');

    return {
      success: true,
      message: 'Converted to AWS Parameter Store format',
      data: { outputPath, parameters: awsParams },
      timestamp: new Date()
    };
  }

  async execute(): Promise<AgentResult> {
    const envFile = path.join(this.projectPath, '.env');
    const outputFile = path.join(this.projectPath, '.env.json');
    
    return this.transform(envFile, outputFile, {
      sourceFormat: 'dotenv',
      targetFormat: 'json',
      expandVariables: true,
      includeComments: true,
      groupByCategory: true
    });
  }

  async validate(): Promise<boolean> {
    return true;
  }
}