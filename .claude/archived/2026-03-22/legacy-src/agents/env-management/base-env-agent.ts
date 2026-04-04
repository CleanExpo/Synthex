import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface EnvVariable {
  name: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'json' | 'base64';
  required?: boolean;
  description?: string;
  example?: string;
  encrypted?: boolean;
  source?: string;
  environment?: string[];
}

export interface EnvConfig {
  variables: EnvVariable[];
  environment: string;
  timestamp: Date;
  checksum?: string;
}

export interface AgentResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
  timestamp: Date;
}

export interface AgentOptions {
  projectPath: string;
  environment: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableCache?: boolean;
  cacheTimeout?: number;
}

export abstract class EnvAgent extends EventEmitter {
  protected projectPath: string;
  protected environment: string;
  protected logLevel: string;
  protected cache: Map<string, { data: any; timestamp: number }>;
  protected cacheTimeout: number;
  protected enableCache: boolean;

  constructor(options: AgentOptions) {
    super();
    this.projectPath = options.projectPath;
    this.environment = options.environment;
    this.logLevel = options.logLevel || 'info';
    this.enableCache = options.enableCache ?? true;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.cache = new Map();
  }

  protected log(level: string, message: string, data?: any): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        agent: this.constructor.name,
        environment: this.environment,
        message,
        data
      };

      console.log(JSON.stringify(logEntry));
      this.emit('log', logEntry);
    }
  }

  protected async loadEnvFile(filePath: string): Promise<Map<string, string>> {
    const envMap = new Map<string, string>();
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            envMap.set(key.trim(), value);
          }
        }
      }
    } catch (error) {
      this.log('error', `Failed to load env file: ${filePath}`, error);
      throw error;
    }

    return envMap;
  }

  protected async saveEnvFile(filePath: string, variables: Map<string, string>): Promise<void> {
    const lines: string[] = [];
    
    for (const [key, value] of variables) {
      const needsQuotes = value.includes(' ') || value.includes('=');
      const formattedValue = needsQuotes ? `"${value}"` : value;
      lines.push(`${key}=${formattedValue}`);
    }

    try {
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      this.log('info', `Saved env file: ${filePath}`);
    } catch (error) {
      this.log('error', `Failed to save env file: ${filePath}`, error);
      throw error;
    }
  }

  protected generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  protected getCached<T>(key: string): T | null {
    if (!this.enableCache) return null;

    const cached = this.cache.get(key);
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.cacheTimeout) {
        this.log('debug', `Cache hit for key: ${key}`);
        return cached.data as T;
      } else {
        this.cache.delete(key);
        this.log('debug', `Cache expired for key: ${key}`);
      }
    }
    return null;
  }

  protected setCache(key: string, data: any): void {
    if (!this.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    this.log('debug', `Cached data for key: ${key}`);
  }

  protected clearCache(): void {
    this.cache.clear();
    this.log('debug', 'Cache cleared');
  }

  protected async findEnvFiles(): Promise<string[]> {
    const envFiles: string[] = [];
    const patterns = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.staging',
      '.env.test',
      `env.${this.environment}`,
      `config/.env`,
      `config/.env.${this.environment}`
    ];

    for (const pattern of patterns) {
      const filePath = path.join(this.projectPath, pattern);
      try {
        await fs.access(filePath);
        envFiles.push(filePath);
      } catch {
        // File doesn't exist, continue
      }
    }

    return envFiles;
  }

  protected parseValue(value: string, type?: string): any {
    if (!type) return value;

    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'base64':
        return Buffer.from(value, 'base64').toString('utf-8');
      default:
        return value;
    }
  }

  protected formatValue(value: any, type?: string): string {
    if (!type) return String(value);

    switch (type) {
      case 'json':
        return JSON.stringify(value);
      case 'base64':
        return Buffer.from(String(value)).toString('base64');
      default:
        return String(value);
    }
  }

  abstract execute(): Promise<AgentResult>;
  
  abstract validate(): Promise<boolean>;
}
