/**
 * Agent Data Store
 * Central repository for all agent-generated data
 * Integrates with the application to provide real-time updates
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface ResearchData {
  targetAudience: {
    demographics: {
      primary: { age: string; gender: string; location: string };
      secondary: { age: string; gender: string; location: string };
    };
    psychographics: {
      interests: string[];
      values: string[];
      painPoints: string[];
    };
  };
  personas: Array<{
    name: string;
    role: string;
    goals: string[];
    challenges: string[];
    avatar?: string;
  }>;
  customerJourney: {
    stages: string[];
    touchpoints: string[];
    opportunities: string[];
  };
  competitors: {
    companies: string[];
    strengths: string[];
    differentiators: string[];
  };
}

export interface ContentData {
  hooks: string[];
  formulas: string[];
  storyboards: Array<{
    name: string;
    structure: string[];
  }>;
  contentCalendar: {
    [day: string]: {
      theme: string;
      formats: string[];
    };
  };
}

export interface DesignData {
  designSystem: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      success: string;
      warning: string;
      error: string;
      neutral?: string[];
    };
    typography: {
      headings: string;
      body: string;
      sizes: string[];
    };
    spacing: number[];
    components: string[];
  };
  uiComponents: Array<{
    name: string;
    variants: string[];
  }>;
  workspace: {
    layout: string;
    panels: string[];
    features: string[];
    themes: string[];
  };
}

export interface PlatformData {
  platforms: {
    [platform: string]: {
      contentFormats: string[];
      bestPractices: string[];
      algorithm: {
        signals: string[];
        optimization: string[];
      };
      features: string[];
      postingStrategy: {
        times: string[];
        frequency: string;
      };
    };
  };
  automation: {
    scheduling: boolean;
    crossPosting: boolean;
    adaptation: boolean;
    optimization: boolean;
  };
}

export interface PerformanceData {
  analytics: {
    tracking: {
      events: string[];
      metrics: string[];
      attribution: string[];
      integrations: string[];
    };
  };
  dashboards: Array<{
    name: string;
    widgets: string[];
  }>;
  reports: string[];
  exports: string[];
  optimizations: {
    caching: string;
    cdn: string;
    database: string;
    api: string;
    frontend: string;
  };
  improvements: {
    loadTime: string;
    apiResponse: string;
    userExperience: string;
    serverCost: string;
  };
}

export class AgentDataStore extends EventEmitter {
  private static instance: AgentDataStore;
  private dataPath: string;
  
  public researchData: ResearchData | null = null;
  public contentData: ContentData | null = null;
  public designData: DesignData | null = null;
  public platformData: PlatformData | null = null;
  public performanceData: PerformanceData | null = null;
  
  private constructor() {
    super();
    this.dataPath = path.join(process.cwd(), 'data', 'agent-outputs');
    this.ensureDataDirectory();
    this.loadExistingData();
  }
  
  public static getInstance(): AgentDataStore {
    if (!AgentDataStore.instance) {
      AgentDataStore.instance = new AgentDataStore();
    }
    return AgentDataStore.instance;
  }
  
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }
  
  private loadExistingData(): void {
    const files = [
      { name: 'research.json', prop: 'researchData' },
      { name: 'content.json', prop: 'contentData' },
      { name: 'design.json', prop: 'designData' },
      { name: 'platform.json', prop: 'platformData' },
      { name: 'performance.json', prop: 'performanceData' }
    ];
    
    files.forEach(file => {
      const filePath = path.join(this.dataPath, file.name);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          (this as any)[file.prop] = data;
        } catch (error) {
          console.error(`Failed to load ${file.name}:`, error);
        }
      }
    });
  }
  
  /**
   * Store Research & Discovery data
   */
  public storeResearchData(data: ResearchData): void {
    this.researchData = data;
    this.saveToFile('research.json', data);
    this.emit('data:updated', { type: 'research', data });
    console.log('✅ Research data stored successfully');
  }
  
  /**
   * Store Content Strategy data
   */
  public storeContentData(data: ContentData): void {
    this.contentData = data;
    this.saveToFile('content.json', data);
    this.emit('data:updated', { type: 'content', data });
    console.log('✅ Content data stored successfully');
  }
  
  /**
   * Store Visual Design data
   */
  public storeDesignData(data: DesignData): void {
    this.designData = data;
    this.saveToFile('design.json', data);
    this.emit('data:updated', { type: 'design', data });
    
    // Also update CSS files with design system
    this.updateDesignSystemCSS(data.designSystem);
    console.log('✅ Design data stored and CSS updated');
  }
  
  /**
   * Store Platform Integration data
   */
  public storePlatformData(data: PlatformData): void {
    this.platformData = data;
    this.saveToFile('platform.json', data);
    this.emit('data:updated', { type: 'platform', data });
    console.log('✅ Platform data stored successfully');
  }
  
  /**
   * Store Performance Optimization data
   */
  public storePerformanceData(data: PerformanceData): void {
    this.performanceData = data;
    this.saveToFile('performance.json', data);
    this.emit('data:updated', { type: 'performance', data });
    console.log('✅ Performance data stored successfully');
  }
  
  /**
   * Save data to file
   */
  private saveToFile(filename: string, data: any): void {
    const filePath = path.join(this.dataPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Update CSS with design system values
   */
  private updateDesignSystemCSS(designSystem: DesignData['designSystem']): void {
    const cssContent = `
/* Auto-generated Design System Variables */
:root {
  /* Colors */
  --color-primary: ${designSystem.colors.primary};
  --color-secondary: ${designSystem.colors.secondary};
  --color-accent: ${designSystem.colors.accent};
  --color-success: ${designSystem.colors.success};
  --color-warning: ${designSystem.colors.warning};
  --color-error: ${designSystem.colors.error};
  
  /* Typography */
  --font-heading: '${designSystem.typography.headings}', sans-serif;
  --font-body: '${designSystem.typography.body}', sans-serif;
  
  /* Font Sizes */
  ${designSystem.typography.sizes.map((size, i) => 
    `--font-size-${i + 1}: ${size};`
  ).join('\n  ')}
  
  /* Spacing */
  ${designSystem.spacing.map((space, i) => 
    `--spacing-${i}: ${space}px;`
  ).join('\n  ')}
}

/* Component Classes */
${designSystem.components.map(component => `
.${component.toLowerCase()} {
  /* Component styles will be implemented */
}`).join('\n')}
`;
    
    const cssPath = path.join(process.cwd(), 'public', 'css', 'agent-design-system.css');
    fs.writeFileSync(cssPath, cssContent);
  }
  
  /**
   * Get all stored data
   */
  public getAllData(): any {
    return {
      research: this.researchData,
      content: this.contentData,
      design: this.designData,
      platform: this.platformData,
      performance: this.performanceData
    };
  }
  
  /**
   * Export data for API consumption
   */
  public exportForAPI(): any {
    return {
      personas: this.researchData?.personas || [],
      hooks: this.contentData?.hooks || [],
      contentCalendar: this.contentData?.contentCalendar || {},
      designSystem: this.designData?.designSystem || null,
      platforms: Object.keys(this.platformData?.platforms || {}),
      dashboards: this.performanceData?.dashboards || [],
      analytics: this.performanceData?.analytics || null
    };
  }
  
  /**
   * Generate application configuration from agent data
   */
  public generateAppConfig(): any {
    return {
      features: {
        personas: this.researchData?.personas ? true : false,
        contentCalendar: this.contentData?.contentCalendar ? true : false,
        designSystem: this.designData?.designSystem ? true : false,
        platformOptimization: this.platformData?.platforms ? true : false,
        analytics: this.performanceData?.analytics ? true : false
      },
      settings: {
        primaryColor: this.designData?.designSystem?.colors?.primary || '#6366F1',
        font: this.designData?.designSystem?.typography?.body || 'Inter',
        supportedPlatforms: Object.keys(this.platformData?.platforms || {}),
        trackingEvents: this.performanceData?.analytics?.tracking?.events || []
      },
      content: {
        hooks: this.contentData?.hooks || [],
        storyboards: this.contentData?.storyboards || [],
        calendar: this.contentData?.contentCalendar || {}
      },
      optimization: {
        caching: this.performanceData?.optimizations?.caching || 'none',
        cdn: this.performanceData?.optimizations?.cdn || 'none',
        improvements: this.performanceData?.improvements || {}
      }
    };
  }
  
  /**
   * Clear all data
   */
  public clearAllData(): void {
    this.researchData = null;
    this.contentData = null;
    this.designData = null;
    this.platformData = null;
    this.performanceData = null;
    
    // Clear files
    const files = ['research.json', 'content.json', 'design.json', 'platform.json', 'performance.json'];
    files.forEach(file => {
      const filePath = path.join(this.dataPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    this.emit('data:cleared');
    console.log('🗑️ All agent data cleared');
  }
}

export const agentDataStore = AgentDataStore.getInstance();