/**
 * Agent Integration Service
 * Integrates all agent-generated data into the application
 */

import { agentDataStore } from '../agents/agent-data-store';
import { buildOrchestrator } from '../agents/build-orchestrator';
import * as fs from 'fs';
import * as path from 'path';

export class AgentIntegrationService {
  private static instance: AgentIntegrationService;
  
  private constructor() {
    this.setupEventListeners();
  }
  
  public static getInstance(): AgentIntegrationService {
    if (!AgentIntegrationService.instance) {
      AgentIntegrationService.instance = new AgentIntegrationService();
    }
    return AgentIntegrationService.instance;
  }
  
  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    // Listen for build orchestrator events
    buildOrchestrator.on('task:completed', async (data) => {
      await this.processCompletedTask(data);
    });
    
    buildOrchestrator.on('phase:completed', async (phase) => {
      await this.processCompletedPhase(phase);
    });
    
    // Listen for data store updates
    agentDataStore.on('data:updated', async (update) => {
      await this.propagateDataUpdate(update);
    });
  }
  
  /**
   * Process completed task and store data
   */
  private async processCompletedTask(data: any): Promise<void> {
    const { task, agent, result } = data;
    
    switch (task.type) {
      case 'ux-research':
        await this.integrateResearchData(task, result);
        break;
      case 'content-creation':
        await this.integrateContentData(task, result);
        break;
      case 'visual-design':
        await this.integrateDesignData(task, result);
        break;
      case 'platform-optimization':
        await this.integratePlatformData(task, result);
        break;
      case 'performance-analysis':
        await this.integratePerformanceData(task, result);
        break;
    }
  }
  
  /**
   * Process completed phase
   */
  private async processCompletedPhase(phase: any): Promise<void> {
    console.log(`🎯 Phase completed: ${phase.name}`);
    
    switch (phase.name) {
      case 'Research & Discovery':
        await this.deployResearchData();
        break;
      case 'Content Strategy':
        await this.deployContentStrategy();
        break;
      case 'Visual Design':
        await this.deployDesignSystem();
        break;
      case 'Platform Integration':
        await this.deployPlatformOptimizations();
        break;
      case 'Performance Optimization':
        await this.deployPerformanceEnhancements();
        break;
    }
  }
  
  /**
   * Integrate Research Data
   */
  private async integrateResearchData(task: any, result: any): Promise<void> {
    const currentData = agentDataStore.researchData || {
      targetAudience: { demographics: {}, psychographics: {} },
      personas: [],
      customerJourney: { stages: [], touchpoints: [], opportunities: [] },
      competitors: { companies: [], strengths: [], differentiators: [] }
    };
    
    switch (task.data.action) {
      case 'analyze-target-audience':
        currentData.targetAudience = result;
        break;
      case 'create-user-personas':
        currentData.personas = result;
        break;
      case 'map-customer-journey':
        currentData.customerJourney = result;
        break;
      case 'competitive-analysis':
        currentData.competitors = result;
        break;
    }
    
    agentDataStore.storeResearchData(currentData as any);
  }
  
  /**
   * Integrate Content Data
   */
  private async integrateContentData(task: any, result: any): Promise<void> {
    const currentData = agentDataStore.contentData || {
      hooks: [],
      formulas: [],
      storyboards: [],
      contentCalendar: {}
    };
    
    switch (task.data.action) {
      case 'generate-hooks':
        currentData.hooks = result.hooks;
        currentData.formulas = result.formulas;
        break;
      case 'develop-storyboards':
        currentData.storyboards = result.templates;
        break;
      case 'create-content-calendar':
        currentData.contentCalendar = result.schedule;
        break;
    }
    
    agentDataStore.storeContentData(currentData);
  }
  
  /**
   * Integrate Design Data
   */
  private async integrateDesignData(task: any, result: any): Promise<void> {
    const currentData = agentDataStore.designData || {
      designSystem: { colors: {}, typography: {}, spacing: [], components: [] },
      uiComponents: [],
      workspace: { layout: '', panels: [], features: [], themes: [] }
    };
    
    switch (task.data.action) {
      case 'create-design-system':
        currentData.designSystem = result;
        break;
      case 'design-ui-components':
        currentData.uiComponents = result.components;
        break;
      case 'setup-workspace':
        currentData.workspace = result.workspace;
        break;
    }
    
    agentDataStore.storeDesignData(currentData as any);
  }
  
  /**
   * Integrate Platform Data
   */
  private async integratePlatformData(task: any, result: any): Promise<void> {
    const currentData = agentDataStore.platformData || {
      platforms: {},
      automation: { scheduling: false, crossPosting: false, adaptation: false, optimization: false }
    };
    
    switch (task.data.action) {
      case 'optimize-for-platforms':
        // Merge platform optimizations with posting strategies
        const platforms = task.data.platforms || [];
        platforms.forEach((platform: string) => {
          if (result[platform]) {
            currentData.platforms[platform] = {
              ...result[platform],
              postingStrategy: currentData.platforms[platform]?.postingStrategy || { times: [], frequency: '' }
            };
          }
        });
        break;
      case 'implement-posting-strategy':
        // Update posting strategies for each platform
        if (result.strategies) {
          Object.keys(result.strategies).forEach(platform => {
            if (!currentData.platforms[platform]) {
              currentData.platforms[platform] = {
                contentFormats: [],
                bestPractices: [],
                algorithm: { signals: [], optimization: [] },
                features: [],
                postingStrategy: result.strategies[platform]
              };
            } else {
              currentData.platforms[platform].postingStrategy = result.strategies[platform];
            }
          });
        }
        if (result.automation) {
          currentData.automation = result.automation;
        }
        break;
    }
    
    agentDataStore.storePlatformData(currentData);
  }
  
  /**
   * Integrate Performance Data
   */
  private async integratePerformanceData(task: any, result: any): Promise<void> {
    const currentData = agentDataStore.performanceData || {
      analytics: { tracking: { events: [], metrics: [], attribution: [], integrations: [] } },
      dashboards: [],
      reports: [],
      exports: [],
      optimizations: {},
      improvements: {}
    };
    
    switch (task.data.action) {
      case 'setup-analytics':
        currentData.analytics = result;
        break;
      case 'create-dashboards':
        currentData.dashboards = result.dashboards;
        currentData.reports = result.reports;
        currentData.exports = result.exports;
        break;
      case 'optimize-performance':
        currentData.optimizations = result.optimizations;
        currentData.improvements = result.improvements;
        break;
    }
    
    agentDataStore.storePerformanceData(currentData as any);
  }
  
  /**
   * Deploy Research Data to Application
   */
  private async deployResearchData(): Promise<void> {
    const data = agentDataStore.researchData;
    if (!data) return;
    
    // Update personas in the application
    const personasPath = path.join(process.cwd(), 'data', 'personas.json');
    fs.writeFileSync(personasPath, JSON.stringify(data.personas, null, 2));
    
    // Update target audience configuration
    const audiencePath = path.join(process.cwd(), 'data', 'target-audience.json');
    fs.writeFileSync(audiencePath, JSON.stringify(data.targetAudience, null, 2));
    
    console.log('✅ Research data deployed to application');
  }
  
  /**
   * Deploy Content Strategy
   */
  private async deployContentStrategy(): Promise<void> {
    const data = agentDataStore.contentData;
    if (!data) return;
    
    // Update content templates
    const templatesPath = path.join(process.cwd(), 'templates', 'content-hooks.json');
    fs.writeFileSync(templatesPath, JSON.stringify({
      hooks: data.hooks,
      formulas: data.formulas,
      storyboards: data.storyboards
    }, null, 2));
    
    // Update content calendar
    const calendarPath = path.join(process.cwd(), 'data', 'content-calendar.json');
    fs.writeFileSync(calendarPath, JSON.stringify(data.contentCalendar, null, 2));
    
    console.log('✅ Content strategy deployed to application');
  }
  
  /**
   * Deploy Design System
   */
  private async deployDesignSystem(): Promise<void> {
    const data = agentDataStore.designData;
    if (!data) return;
    
    // CSS is already updated by the data store
    // Update component registry
    const componentsPath = path.join(process.cwd(), 'src', 'components', 'registry.json');
    fs.writeFileSync(componentsPath, JSON.stringify({
      components: data.uiComponents,
      designSystem: data.designSystem,
      workspace: data.workspace
    }, null, 2));
    
    // Update theme configuration
    const themePath = path.join(process.cwd(), 'config', 'theme.json');
    fs.writeFileSync(themePath, JSON.stringify({
      colors: data.designSystem.colors,
      typography: data.designSystem.typography,
      spacing: data.designSystem.spacing
    }, null, 2));
    
    console.log('✅ Design system deployed to application');
  }
  
  /**
   * Deploy Platform Optimizations
   */
  private async deployPlatformOptimizations(): Promise<void> {
    const data = agentDataStore.platformData;
    if (!data) return;
    
    // Update platform configurations
    Object.keys(data.platforms).forEach(platform => {
      const platformPath = path.join(process.cwd(), 'config', 'platforms', `${platform}.json`);
      const dir = path.dirname(platformPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(platformPath, JSON.stringify(data.platforms[platform], null, 2));
    });
    
    // Update automation settings
    const automationPath = path.join(process.cwd(), 'config', 'automation.json');
    fs.writeFileSync(automationPath, JSON.stringify(data.automation, null, 2));
    
    console.log('✅ Platform optimizations deployed to application');
  }
  
  /**
   * Deploy Performance Enhancements
   */
  private async deployPerformanceEnhancements(): Promise<void> {
    const data = agentDataStore.performanceData;
    if (!data) return;
    
    // Update analytics configuration
    const analyticsPath = path.join(process.cwd(), 'config', 'analytics.json');
    fs.writeFileSync(analyticsPath, JSON.stringify(data.analytics, null, 2));
    
    // Update dashboard configurations
    const dashboardsPath = path.join(process.cwd(), 'data', 'dashboards.json');
    fs.writeFileSync(dashboardsPath, JSON.stringify(data.dashboards, null, 2));
    
    // Create performance report
    const reportPath = path.join(process.cwd(), 'data', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      optimizations: data.optimizations,
      improvements: data.improvements,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log('✅ Performance enhancements deployed to application');
  }
  
  /**
   * Propagate data updates to the application
   */
  private async propagateDataUpdate(update: any): Promise<void> {
    const { type, data } = update;
    
    // Emit events for UI updates
    // Using global event emitter pattern for cross-module communication
    if ((globalThis as any).eventEmitter) {
      (globalThis as any).eventEmitter.emit('agent:data:update', { type, data });
    }
    
    // Log the update
    console.log(`🔄 ${type} data updated in application`);
  }
  
  /**
   * Execute full integration
   */
  public async executeFullIntegration(): Promise<void> {
    console.log('\n🚀 Starting full agent data integration...');
    
    // Deploy all existing data
    await this.deployResearchData();
    await this.deployContentStrategy();
    await this.deployDesignSystem();
    await this.deployPlatformOptimizations();
    await this.deployPerformanceEnhancements();
    
    // Generate and save application configuration
    const appConfig = agentDataStore.generateAppConfig();
    const configPath = path.join(process.cwd(), 'config', 'app-config.json');
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    
    // Create API endpoints data
    const apiData = agentDataStore.exportForAPI();
    const apiPath = path.join(process.cwd(), 'data', 'api-data.json');
    fs.writeFileSync(apiPath, JSON.stringify(apiData, null, 2));
    
    console.log('\n✅ Full integration completed successfully!');
    console.log('\n📊 Integration Summary:');
    console.log('  • Research data deployed');
    console.log('  • Content strategy activated');
    console.log('  • Design system implemented');
    console.log('  • Platform optimizations configured');
    console.log('  • Performance enhancements applied');
    console.log('  • Application configuration updated');
    console.log('  • API data prepared');
  }
  
  /**
   * Get integration status
   */
  public getIntegrationStatus(): any {
    const allData = agentDataStore.getAllData();
    
    return {
      research: {
        available: !!allData.research,
        personas: allData.research?.personas?.length || 0,
        audienceSegments: allData.research?.targetAudience ? 1 : 0
      },
      content: {
        available: !!allData.content,
        hooks: allData.content?.hooks?.length || 0,
        storyboards: allData.content?.storyboards?.length || 0
      },
      design: {
        available: !!allData.design,
        components: allData.design?.uiComponents?.length || 0,
        themes: allData.design?.workspace?.themes?.length || 0
      },
      platform: {
        available: !!allData.platform,
        platforms: Object.keys(allData.platform?.platforms || {}).length,
        automationEnabled: allData.platform?.automation?.scheduling || false
      },
      performance: {
        available: !!allData.performance,
        dashboards: allData.performance?.dashboards?.length || 0,
        trackingEvents: allData.performance?.analytics?.tracking?.events?.length || 0
      }
    };
  }
}

export const agentIntegration = AgentIntegrationService.getInstance();