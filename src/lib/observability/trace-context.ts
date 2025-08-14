/**
 * Distributed Tracing and Observability
 * Implements W3C Trace Context for request correlation
 */

import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentId?: string;
  flags: string;
  timestamp: number;
}

/**
 * Generate a new trace ID (32 hex chars)
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a new span ID (16 hex chars)
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Parse W3C traceparent header
 */
export function parseTraceparent(header: string): TraceContext | null {
  // Format: version-traceId-spanId-flags
  const parts = header.split('-');
  
  if (parts.length !== 4) {
    return null;
  }
  
  return {
    traceId: parts[1],
    spanId: parts[2],
    flags: parts[3],
    timestamp: Date.now()
  };
}

/**
 * Create traceparent header
 */
export function createTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.flags || '01'}`;
}

/**
 * Extract or create trace context from request
 */
export function getTraceContext(request: NextRequest): TraceContext {
  const traceparent = request.headers.get('traceparent');
  
  if (traceparent) {
    const parsed = parseTraceparent(traceparent);
    if (parsed) {
      return {
        ...parsed,
        parentId: parsed.spanId,
        spanId: generateSpanId()
      };
    }
  }
  
  // Create new trace context
  return {
    traceId: request.headers.get('x-request-id') || generateTraceId(),
    spanId: generateSpanId(),
    flags: '01',
    timestamp: Date.now()
  };
}

/**
 * Add trace context to headers
 */
export function addTraceHeaders(
  headers: Headers,
  context: TraceContext
): void {
  headers.set('traceparent', createTraceparent(context));
  headers.set('x-trace-id', context.traceId);
  headers.set('x-span-id', context.spanId);
  
  if (context.parentId) {
    headers.set('x-parent-span-id', context.parentId);
  }
}

/**
 * Create child span
 */
export function createChildSpan(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentId: parent.spanId,
    flags: parent.flags,
    timestamp: Date.now()
  };
}

/**
 * Structured logger with trace context
 */
export class TracedLogger {
  private context: TraceContext;
  private serviceName: string;
  
  constructor(context: TraceContext, serviceName = 'synthex-api') {
    this.context = context;
    this.serviceName = serviceName;
  }
  
  private sanitizePII(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sensitive = [
      'password', 'token', 'secret', 'key', 'auth',
      'credit_card', 'ssn', 'email', 'phone', 'address'
    ];
    
    const sanitized = { ...data };
    
    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      
      if (sensitive.some(s => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizePII(sanitized[key]);
      }
    }
    
    return sanitized;
  }
  
  private format(level: string, message: string, data?: any) {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      trace: {
        trace_id: this.context.traceId,
        span_id: this.context.spanId,
        parent_id: this.context.parentId
      },
      message,
      data: this.sanitizePII(data),
      duration_ms: Date.now() - this.context.timestamp
    };
  }
  
  info(message: string, data?: any): void {
    console.log(JSON.stringify(this.format('info', message, data)));
  }
  
  warn(message: string, data?: any): void {
    console.warn(JSON.stringify(this.format('warn', message, data)));
  }
  
  error(message: string, error?: Error, data?: any): void {
    console.error(JSON.stringify(this.format('error', message, {
      ...data,
      error: {
        name: error?.name,
        message: error?.message,
        stack: process.env.NODE_ENV !== 'production' ? error?.stack : undefined
      }
    })));
  }
  
  metric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    console.log(JSON.stringify({
      ...this.format('metric', `Metric: ${name}`),
      metric: {
        name,
        value,
        unit,
        tags
      }
    }));
  }
}

/**
 * Performance timing helper
 */
export class SpanTimer {
  private startTime: number;
  private context: TraceContext;
  private logger: TracedLogger;
  
  constructor(context: TraceContext, serviceName?: string) {
    this.startTime = Date.now();
    this.context = context;
    this.logger = new TracedLogger(context, serviceName);
  }
  
  end(operation: string, metadata?: any): void {
    const duration = Date.now() - this.startTime;
    this.logger.metric(`operation.duration`, duration, 'ms', {
      operation,
      ...metadata
    });
  }
}