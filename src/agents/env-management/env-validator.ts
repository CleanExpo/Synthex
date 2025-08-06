import { EnvAgent, EnvVariable, AgentResult, AgentOptions } from './base-env-agent';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ValidationRule {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json' | 'base64' | 'port' | 'ip';
  required?: boolean;
  pattern?: RegExp | string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
  default?: any;
  transform?: (value: any) => any;
  dependsOn?: string[];
  validate?: (value: any, allVars: Map<string, string>) => boolean | string;
  description?: string;
}

export interface ValidationSchema {
  rules: ValidationRule[];
  allowExtraVars?: boolean;
  strictMode?: boolean;
  environments?: string[];
}

export interface ValidationError {
  variable: string;
  value?: string;
  error: string;
  suggestion?: string;
}

export class EnvValidator extends EnvAgent {
  private schema: ValidationSchema;
  private validationErrors: ValidationError[] = [];
  private validationWarnings: ValidationError[] = [];

  constructor(options: AgentOptions & { schema?: ValidationSchema }) {
    super(options);
    this.schema = options.schema || { rules: [] };
  }

  async loadSchema(schemaPath: string): Promise<void> {
    try {
      const content = await fs.readFile(schemaPath, 'utf-8');
      this.schema = JSON.parse(content);
      this.log('info', `Loaded validation schema from ${schemaPath}`);
    } catch (error) {
      this.log('error', `Failed to load schema from ${schemaPath}`, error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    this.validationErrors = [];
    this.validationWarnings = [];

    const envFiles = await this.findEnvFiles();
    if (envFiles.length === 0) {
      this.log('warn', 'No environment files found');
      return false;
    }

    const envVars = new Map<string, string>();
    for (const file of envFiles) {
      const vars = await this.loadEnvFile(file);
      vars.forEach((value, key) => envVars.set(key, value));
    }

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        envVars.set(key, value);
      }
    }

    for (const rule of this.schema.rules) {
      await this.validateRule(rule, envVars);
    }

    if (!this.schema.allowExtraVars) {
      const definedVars = new Set(this.schema.rules.map(r => r.name));
      for (const varName of envVars.keys()) {
        if (!definedVars.has(varName) && !this.isSystemVar(varName)) {
          this.validationWarnings.push({
            variable: varName,
            error: 'Undefined variable in schema',
            suggestion: 'Add this variable to your validation schema or set allowExtraVars to true'
          });
        }
      }
    }

    this.emit('validation-complete', {
      errors: this.validationErrors,
      warnings: this.validationWarnings,
      valid: this.validationErrors.length === 0
    });

    return this.validationErrors.length === 0;
  }

  private async validateRule(rule: ValidationRule, envVars: Map<string, string>): Promise<void> {
    const value = envVars.get(rule.name);

    if (rule.required && (value === undefined || value === '')) {
      this.validationErrors.push({
        variable: rule.name,
        error: 'Required variable is missing or empty',
        suggestion: `Set ${rule.name} in your environment or .env file`
      });
      return;
    }

    if (value === undefined || value === '') {
      if (rule.default !== undefined) {
        envVars.set(rule.name, String(rule.default));
        this.log('debug', `Applied default value for ${rule.name}`);
      }
      return;
    }

    if (rule.dependsOn) {
      for (const dependency of rule.dependsOn) {
        if (!envVars.has(dependency)) {
          this.validationErrors.push({
            variable: rule.name,
            value,
            error: `Depends on missing variable: ${dependency}`,
            suggestion: `Ensure ${dependency} is defined when ${rule.name} is set`
          });
        }
      }
    }

    if (rule.type && !this.validateType(value, rule.type)) {
      this.validationErrors.push({
        variable: rule.name,
        value,
        error: `Invalid type. Expected ${rule.type}`,
        suggestion: this.getTypeSuggestion(rule.type)
      });
      return;
    }

    if (rule.pattern) {
      const regex = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
      if (!regex.test(value)) {
        this.validationErrors.push({
          variable: rule.name,
          value,
          error: `Value does not match pattern: ${regex}`,
          suggestion: rule.description || 'Check the format requirements'
        });
      }
    }

    if (rule.minLength !== undefined && value.length < rule.minLength) {
      this.validationErrors.push({
        variable: rule.name,
        value,
        error: `Value too short. Minimum length: ${rule.minLength}`,
        suggestion: `Provide at least ${rule.minLength} characters`
      });
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      this.validationErrors.push({
        variable: rule.name,
        value,
        error: `Value too long. Maximum length: ${rule.maxLength}`,
        suggestion: `Limit to ${rule.maxLength} characters`
      });
    }

    if (rule.type === 'number') {
      const numValue = Number(value);
      if (rule.min !== undefined && numValue < rule.min) {
        this.validationErrors.push({
          variable: rule.name,
          value,
          error: `Value below minimum: ${rule.min}`,
          suggestion: `Set value to at least ${rule.min}`
        });
      }
      if (rule.max !== undefined && numValue > rule.max) {
        this.validationErrors.push({
          variable: rule.name,
          value,
          error: `Value above maximum: ${rule.max}`,
          suggestion: `Set value to at most ${rule.max}`
        });
      }
    }

    if (rule.enum && !rule.enum.includes(value)) {
      this.validationErrors.push({
        variable: rule.name,
        value,
        error: `Invalid value. Must be one of: ${rule.enum.join(', ')}`,
        suggestion: `Choose from: ${rule.enum.join(', ')}`
      });
    }

    if (rule.validate) {
      const result = rule.validate(value, envVars);
      if (result !== true) {
        this.validationErrors.push({
          variable: rule.name,
          value,
          error: typeof result === 'string' ? result : 'Custom validation failed',
          suggestion: rule.description
        });
      }
    }
  }

  private validateType(value: string, type: string): boolean {
    switch (type) {
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return ['true', 'false', '1', '0'].includes(value.toLowerCase());
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      case 'base64':
        return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
      case 'port':
        const port = Number(value);
        return !isNaN(port) && port >= 1 && port <= 65535;
      case 'ip':
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || 
               /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/.test(value);
      default:
        return true;
    }
  }

  private getTypeSuggestion(type: string): string {
    const suggestions: Record<string, string> = {
      number: 'Use a numeric value (e.g., 123)',
      boolean: 'Use true or false',
      url: 'Use a valid URL (e.g., https://example.com)',
      email: 'Use a valid email address',
      json: 'Use valid JSON format',
      base64: 'Use base64 encoded string',
      port: 'Use a port number between 1 and 65535',
      ip: 'Use a valid IPv4 or IPv6 address'
    };
    return suggestions[type] || 'Check the format requirements';
  }

  private isSystemVar(name: string): boolean {
    const systemVars = [
      'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD', 'OLDPWD',
      'HOSTNAME', 'HOSTTYPE', 'OSTYPE', 'MACHTYPE', 'SHLVL',
      'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_ENV'
    ];
    return systemVars.includes(name) || name.startsWith('npm_') || name.startsWith('NODE_');
  }

  async execute(): Promise<AgentResult> {
    try {
      const isValid = await this.validate();
      
      return {
        success: isValid,
        message: isValid 
          ? 'Environment validation passed'
          : `Environment validation failed with ${this.validationErrors.length} error(s)`,
        data: {
          errors: this.validationErrors,
          warnings: this.validationWarnings,
          totalVarsChecked: this.schema.rules.length
        },
        errors: this.validationErrors.map(e => `${e.variable}: ${e.error}`),
        warnings: this.validationWarnings.map(w => `${w.variable}: ${w.error}`),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error}`,
        errors: [String(error)],
        timestamp: new Date()
      };
    }
  }

  async generateSchema(outputPath?: string): Promise<ValidationSchema> {
    const envFiles = await this.findEnvFiles();
    const allVars = new Map<string, Set<string>>();

    for (const file of envFiles) {
      const vars = await this.loadEnvFile(file);
      vars.forEach((value, key) => {
        if (!allVars.has(key)) {
          allVars.set(key, new Set());
        }
        allVars.get(key)!.add(value);
      });
    }

    const rules: ValidationRule[] = [];
    for (const [name, values] of allVars) {
      const sampleValue = Array.from(values)[0];
      const rule: ValidationRule = {
        name,
        type: this.inferType(sampleValue),
        required: false,
        description: `Environment variable ${name}`
      };

      if (values.size > 1 && values.size <= 10) {
        rule.enum = Array.from(values);
      }

      rules.push(rule);
    }

    const schema: ValidationSchema = {
      rules,
      allowExtraVars: true,
      strictMode: false,
      environments: [this.environment]
    };

    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(schema, null, 2), 'utf-8');
      this.log('info', `Generated schema saved to ${outputPath}`);
    }

    return schema;
  }

  private inferType(value: string): ValidationRule['type'] {
    if (!isNaN(Number(value))) return 'number';
    if (['true', 'false'].includes(value.toLowerCase())) return 'boolean';
    try {
      new URL(value);
      return 'url';
    } catch {}
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    try {
      JSON.parse(value);
      return 'json';
    } catch {}
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length > 20) return 'base64';
    return 'string';
  }
}