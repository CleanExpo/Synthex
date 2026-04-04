import { EnvAgent, EnvVariable, AgentResult, AgentOptions } from './base-env-agent';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface DiscoveredVariable {
  name: string;
  files: string[];
  usages: VariableUsage[];
  defined: boolean;
  value?: string;
  type?: string;
  required: boolean;
  description?: string;
}

export interface VariableUsage {
  file: string;
  line: number;
  context: string;
  accessPattern: string;
}

export class EnvDiscovery extends EnvAgent {
  private discoveredVariables: Map<string, DiscoveredVariable> = new Map();
  private fileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java', '.php'];
  private ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

  constructor(options: AgentOptions) {
    super(options);
  }

  async discoverVariables(): Promise<Map<string, DiscoveredVariable>> {
    this.discoveredVariables.clear();

    await this.scanDefinedVariables();
    await this.scanCodebaseForUsage();
    await this.analyzeVariableTypes();
    await this.generateDescriptions();

    this.emit('discovery-complete', {
      totalVariables: this.discoveredVariables.size,
      definedCount: Array.from(this.discoveredVariables.values()).filter(v => v.defined).length,
      undefinedCount: Array.from(this.discoveredVariables.values()).filter(v => !v.defined).length
    });

    return this.discoveredVariables;
  }

  private async scanDefinedVariables(): Promise<void> {
    const envFiles = await this.findEnvFiles();
    
    for (const file of envFiles) {
      const vars = await this.loadEnvFile(file);
      const fileName = path.basename(file);
      
      for (const [name, value] of vars) {
        if (!this.discoveredVariables.has(name)) {
          this.discoveredVariables.set(name, {
            name,
            files: [fileName],
            usages: [],
            defined: true,
            value: this.maskSensitiveValue(name, value),
            type: this.inferType(value),
            required: false
          });
        } else {
          const variable = this.discoveredVariables.get(name)!;
          variable.defined = true;
          variable.value = this.maskSensitiveValue(name, value);
          variable.type = this.inferType(value);
          if (!variable.files.includes(fileName)) {
            variable.files.push(fileName);
          }
        }
      }
    }
  }

  private async scanCodebaseForUsage(): Promise<void> {
    const patterns = [
      'process.env.',
      'process.env[',
      'os.environ.get',
      'os.environ[',
      'ENV[',
      'getenv(',
      '$_ENV[',
      'System.getenv('
    ];

    const files = await this.findSourceFiles();
    
    for (const file of files) {
      await this.scanFileForVariables(file, patterns);
    }
  }

  private async findSourceFiles(): Promise<string[]> {
    const patterns = this.fileExtensions.map(ext => `**/*${ext}`);
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.projectPath,
          ignore: this.ignorePatterns,
          absolute: true
        } as any);
        if (Array.isArray(files)) {
          allFiles.push(...files);
        }
      } catch (error) {
        this.log('debug', `Failed to glob pattern ${pattern}`, error);
      }
    }

    return allFiles;
  }

  private async scanFileForVariables(filePath: string, patterns: string[]): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.projectPath, filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const pattern of patterns) {
          if (line.includes(pattern)) {
            const variables = this.extractVariables(line, pattern);
            
            for (const varName of variables) {
              const usage: VariableUsage = {
                file: relativePath,
                line: i + 1,
                context: line.trim(),
                accessPattern: pattern
              };

              if (!this.discoveredVariables.has(varName)) {
                this.discoveredVariables.set(varName, {
                  name: varName,
                  files: [],
                  usages: [usage],
                  defined: false,
                  required: true
                });
              } else {
                this.discoveredVariables.get(varName)!.usages.push(usage);
              }
            }
          }
        }
      }
    } catch (error) {
      this.log('debug', `Failed to scan file ${filePath}`, error);
    }
  }

  private extractVariables(line: string, pattern: string): string[] {
    const variables: string[] = [];
    
    const regexPatterns: Record<string, RegExp> = {
      'process.env.': /process\.env\.([A-Z_][A-Z0-9_]*)/g,
      'process.env[': /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
      'os.environ.get': /os\.environ\.get\(['"`]([A-Z_][A-Z0-9_]*)['"`]/g,
      'os.environ[': /os\.environ\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
      'ENV[': /ENV\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
      'getenv(': /getenv\(['"`]([A-Z_][A-Z0-9_]*)['"`]\)/g,
      '$_ENV[': /\$_ENV\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
      'System.getenv(': /System\.getenv\(['"`]([A-Z_][A-Z0-9_]*)['"`]\)/g
    };

    const regex = regexPatterns[pattern];
    if (regex) {
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match[1] && !variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
    }

    return variables;
  }

  private inferType(value: string): string {
    if (!isNaN(Number(value))) return 'number';
    if (['true', 'false'].includes(value.toLowerCase())) return 'boolean';
    
    try {
      new URL(value);
      return 'url';
    } catch {
      // Not a valid URL, continue type detection
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';

    try {
      JSON.parse(value);
      return 'json';
    } catch {
      // Not valid JSON, continue type detection
    }
    
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length > 20) return 'base64';
    
    return 'string';
  }

  private maskSensitiveValue(name: string, value: string): string {
    const sensitivePatterns = [
      /key/i, /secret/i, /password/i, /token/i, /auth/i,
      /credential/i, /private/i, /api/i
    ];

    const isSensitive = sensitivePatterns.some(pattern => pattern.test(name));
    
    if (isSensitive) {
      if (value.length <= 4) return '*'.repeat(value.length);
      return value.substring(0, 2) + '*'.repeat(Math.min(value.length - 4, 20)) + value.substring(value.length - 2);
    }
    
    return value;
  }

  private async analyzeVariableTypes(): Promise<void> {
    for (const [name, variable] of this.discoveredVariables) {
      if (variable.usages.length > 0 && !variable.type) {
        variable.type = this.inferTypeFromUsage(variable.usages);
      }
      
      variable.required = this.determineIfRequired(variable);
    }
  }

  private inferTypeFromUsage(usages: VariableUsage[]): string {
    const typeHints: Record<string, number> = {
      string: 0,
      number: 0,
      boolean: 0,
      url: 0,
      port: 0
    };

    for (const usage of usages) {
      const context = usage.context.toLowerCase();
      
      if (context.includes('port') || context.includes(':parseInt')) {
        typeHints.port++;
        typeHints.number++;
      }
      if (context.includes('url') || context.includes('endpoint') || context.includes('host')) {
        typeHints.url++;
      }
      if (context.includes('=== true') || context.includes('=== false') || context.includes('!!')) {
        typeHints.boolean++;
      }
      if (context.includes('parseInt') || context.includes('Number(')) {
        typeHints.number++;
      }
    }

    const maxType = Object.entries(typeHints).reduce((a, b) => 
      typeHints[a[0]] > typeHints[b[0]] ? a : b
    );

    return maxType[1] > 0 ? maxType[0] : 'string';
  }

  private determineIfRequired(variable: DiscoveredVariable): boolean {
    if (variable.usages.length === 0) return false;
    
    const hasConditionalAccess = variable.usages.some(usage => {
      const context = usage.context;
      return context.includes('||') || 
             context.includes('??') || 
             context.includes('if (') ||
             context.includes('? ');
    });

    return !hasConditionalAccess;
  }

  private async generateDescriptions(): Promise<void> {
    const commonDescriptions: Record<string, string> = {
      NODE_ENV: 'Node.js environment (development, production, test)',
      PORT: 'Server port number',
      DATABASE_URL: 'Database connection string',
      API_KEY: 'API authentication key',
      API_URL: 'API endpoint URL',
      JWT_SECRET: 'Secret key for JWT token generation',
      REDIS_URL: 'Redis connection string',
      LOG_LEVEL: 'Logging verbosity level',
      DEBUG: 'Enable debug mode',
      HOST: 'Server host address',
      SMTP_HOST: 'SMTP server hostname',
      SMTP_PORT: 'SMTP server port',
      SMTP_USER: 'SMTP authentication username',
      SMTP_PASS: 'SMTP authentication password',
      AWS_ACCESS_KEY_ID: 'AWS access key identifier',
      AWS_SECRET_ACCESS_KEY: 'AWS secret access key',
      AWS_REGION: 'AWS region',
      STRIPE_KEY: 'Stripe payment API key',
      GOOGLE_CLIENT_ID: 'Google OAuth client ID',
      GOOGLE_CLIENT_SECRET: 'Google OAuth client secret'
    };

    for (const [name, variable] of this.discoveredVariables) {
      if (!variable.description) {
        variable.description = commonDescriptions[name] || this.generateDescription(name, variable);
      }
    }
  }

  private generateDescription(name: string, variable: DiscoveredVariable): string {
    const parts = name.toLowerCase().split('_');
    let description = 'Environment variable';

    if (parts.includes('url') || parts.includes('uri')) {
      description = 'URL endpoint';
    } else if (parts.includes('key') || parts.includes('secret')) {
      description = 'Authentication credential';
    } else if (parts.includes('port')) {
      description = 'Network port';
    } else if (parts.includes('host')) {
      description = 'Server hostname';
    } else if (parts.includes('path')) {
      description = 'File system path';
    } else if (parts.includes('enable') || parts.includes('disable')) {
      description = 'Feature toggle';
    }

    if (variable.type) {
      description += ` (${variable.type})`;
    }

    if (variable.required) {
      description += ' - Required';
    }

    return description;
  }

  async generateEnvTemplate(): Promise<string> {
    await this.discoverVariables();
    
    const lines: string[] = ['# Auto-generated environment template', '# Generated on ' + new Date().toISOString(), ''];
    
    const categorized = this.categorizeVariables();
    
    for (const [category, variables] of Object.entries(categorized)) {
      if (variables.length === 0) continue;
      
      lines.push(`# ${category}`);
      lines.push('#' + '='.repeat(50));
      
      for (const variable of variables) {
        if (variable.description) {
          lines.push(`# ${variable.description}`);
        }
        
        if (variable.type && variable.type !== 'string') {
          lines.push(`# Type: ${variable.type}`);
        }
        
        if (variable.required) {
          lines.push('# Required: true');
        }
        
        const exampleValue = this.getExampleValue(variable);
        lines.push(`${variable.name}=${exampleValue}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private categorizeVariables(): Record<string, DiscoveredVariable[]> {
    const categories: Record<string, DiscoveredVariable[]> = {
      'Core Configuration': [],
      'Database': [],
      'API & Authentication': [],
      'AWS Services': [],
      'Third-party Services': [],
      'Email Configuration': [],
      'Feature Flags': [],
      'Other': []
    };

    for (const variable of this.discoveredVariables.values()) {
      const name = variable.name.toLowerCase();
      
      if (name.includes('node_env') || name.includes('port') || name.includes('host')) {
        categories['Core Configuration'].push(variable);
      } else if (name.includes('database') || name.includes('db_') || name.includes('postgres') || name.includes('mysql') || name.includes('mongo')) {
        categories['Database'].push(variable);
      } else if (name.includes('api') || name.includes('auth') || name.includes('jwt') || name.includes('token') || name.includes('secret')) {
        categories['API & Authentication'].push(variable);
      } else if (name.includes('aws') || name.includes('s3_') || name.includes('lambda')) {
        categories['AWS Services'].push(variable);
      } else if (name.includes('stripe') || name.includes('google') || name.includes('facebook') || name.includes('github')) {
        categories['Third-party Services'].push(variable);
      } else if (name.includes('smtp') || name.includes('mail') || name.includes('sendgrid')) {
        categories['Email Configuration'].push(variable);
      } else if (name.includes('enable') || name.includes('disable') || name.includes('feature')) {
        categories['Feature Flags'].push(variable);
      } else {
        categories['Other'].push(variable);
      }
    }

    return categories;
  }

  private getExampleValue(variable: DiscoveredVariable): string {
    if (variable.value && !variable.value.includes('*')) {
      return variable.value;
    }

    const exampleValues: Record<string, string> = {
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/dbname',
      API_KEY: 'your-api-key-here',
      JWT_SECRET: 'your-secret-key-here',
      REDIS_URL: 'redis://localhost:6379',
      LOG_LEVEL: 'info',
      DEBUG: 'false',
      HOST: 'localhost'
    };

    if (exampleValues[variable.name]) {
      return exampleValues[variable.name];
    }

    switch (variable.type) {
      case 'number': return '0';
      case 'boolean': return 'false';
      case 'url': return 'https://example.com';
      case 'email': return 'user@example.com';
      case 'port': return '8080';
      default: return '';
    }
  }

  async execute(): Promise<AgentResult> {
    try {
      const variables = await this.discoverVariables();
      const template = await this.generateEnvTemplate();
      
      const undefinedVars = Array.from(variables.values()).filter(v => !v.defined);
      const unusedVars = Array.from(variables.values()).filter(v => v.defined && v.usages.length === 0);

      return {
        success: true,
        message: `Discovered ${variables.size} environment variables`,
        data: {
          totalVariables: variables.size,
          defined: Array.from(variables.values()).filter(v => v.defined).length,
          undefined: undefinedVars.length,
          unused: unusedVars.length,
          template,
          variables: Array.from(variables.values())
        },
        warnings: [
          ...undefinedVars.map(v => `Undefined variable: ${v.name}`),
          ...unusedVars.map(v => `Unused variable: ${v.name}`)
        ],
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: `Discovery failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  async validate(): Promise<boolean> {
    return true;
  }
}