/**
 * Console Logger Implementation
 * Simple logger that outputs to console
 */

export interface ILogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error | any, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export class ConsoleLogger implements ILogger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    return `[${timestamp}] [${level}] ${prefix} ${message}`;
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage('INFO', message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('WARN', message), ...args);
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    console.error(this.formatMessage('ERROR', message), error, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }
}