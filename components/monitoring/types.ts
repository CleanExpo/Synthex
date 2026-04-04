/**
 * Monitoring Types
 * Type definitions for system monitoring
 */

export interface SystemMetrics {
  status: string;
  uptime: string;
  responseTime: number;
  errorRate: number;
  requestCount: number;
  activeUsers: number;
}

export interface DatabaseMetrics {
  connections: number;
  maxConnections: number;
  queryTime: number;
  size: string;
  backupStatus: string;
}

export interface ApiMetrics {
  health: string;
  latency: number;
  throughput: number;
  errorCount: number;
  successRate: number;
}

export interface SecurityMetrics {
  threats: number;
  blockedAttempts: number;
  lastScan: string;
  sslStatus: string;
}

export interface MonitoringMetrics {
  system: SystemMetrics;
  database: DatabaseMetrics;
  api: ApiMetrics;
  security: SecurityMetrics;
}

export interface PerformanceDataPoint {
  time: string;
  responseTime: number;
  requests: number;
}
