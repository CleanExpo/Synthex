/**
 * SEO Audit Types
 * Type definitions for SEO audit components
 */

export interface AuditIssue {
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  affectedPages: string[];
}

export interface AuditCategory {
  score: number;
  issues: AuditIssue[];
}

export interface CoreWebVital {
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface CoreWebVitals {
  lcp: CoreWebVital;
  fid: CoreWebVital;
  cls: CoreWebVital;
  inp: CoreWebVital;
}

export interface SchemaInfo {
  detected: string[];
  valid: boolean;
  recommendations: string[];
}

export interface AuditResult {
  url: string;
  domain: string;
  timestamp: string;
  score: number;
  crawledPages: number;
  issues: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  categories: {
    technical: AuditCategory;
    onPage: AuditCategory;
    content: AuditCategory;
    coreWebVitals?: CoreWebVitals;
    schema?: SchemaInfo;
  };
}

export interface SeverityConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}
