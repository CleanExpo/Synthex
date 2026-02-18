/**
 * SYNTHEX Video Capture Service
 *
 * Uses Puppeteer with screen recording to capture real dashboard workflows.
 * NO MOCK DATA - captures actual application state.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - APP_URL: Application URL (default: http://localhost:3000)
 */

import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@/lib/logger';

// Puppeteer types - using any to avoid webpack resolving the module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

// Dynamic imports for puppeteer (not available in serverless/production)
// webpackIgnore prevents webpack from trying to resolve these modules at build time
let puppeteer: any = null;
let PuppeteerScreenRecorderModule: any = null;
try {
  puppeteer = await import(/* webpackIgnore: true */ 'puppeteer');
  PuppeteerScreenRecorderModule = await import(/* webpackIgnore: true */ 'puppeteer-screen-recorder');
} catch {
  // puppeteer not available in production/serverless
}

export interface CaptureConfig {
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
}

export interface WorkflowStep {
  action: 'navigate' | 'click' | 'type' | 'wait' | 'scroll' | 'hover';
  target?: string;
  value?: string | number;
  description: string;
}

export interface CaptureWorkflow {
  name: string;
  description: string;
  duration: number; // expected duration in seconds
  steps: WorkflowStep[];
}

const DEFAULT_CONFIG: CaptureConfig = {
  outputDir: './output/raw',
  width: 1920,
  height: 1080,
  fps: 30,
  format: 'mp4',
};

export class CaptureService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private recorder: any = null;
  private currentOutputPath: string | null = null;
  private config: CaptureConfig;
  private appUrl: string;

  constructor(config: Partial<CaptureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Initialize browser and page
   */
  async init(): Promise<void> {
    if (!puppeteer) {
      throw new Error('Puppeteer not available in this environment');
    }

    logger.info('CaptureService initializing browser');

    this.browser = await puppeteer.default.launch({
      headless: false, // Show browser for verification
      defaultViewport: {
        width: this.config.width,
        height: this.config.height,
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${this.config.width},${this.config.height}`,
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: this.config.width,
      height: this.config.height,
    });

    logger.info('CaptureService browser initialized');
  }

  /**
   * Start recording the screen
   */
  async startRecording(filename: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }
    if (!PuppeteerScreenRecorderModule) {
      throw new Error('Puppeteer not available in this environment');
    }

    const outputPath = path.join(this.config.outputDir, `${filename}.${this.config.format}`);

    this.recorder = new PuppeteerScreenRecorderModule.PuppeteerScreenRecorder(this.page, {
      followNewTab: false,
      fps: this.config.fps,
      videoFrame: {
        width: this.config.width,
        height: this.config.height,
      },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'ultrafast',
      videoBitrate: 8000,
      aspectRatio: '16:9',
    });

    this.currentOutputPath = outputPath;
    await this.recorder.start(outputPath);
    logger.info('CaptureService recording started', { outputPath });
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<string | null> {
    if (!this.recorder) {
      console.warn('[CaptureService] No active recording to stop');
      return null;
    }

    const outputPath = this.currentOutputPath;
    await this.recorder.stop();
    logger.info('CaptureService recording saved', { outputPath });
    this.recorder = null;
    this.currentOutputPath = null;
    return outputPath;
  }

  /**
   * Execute a workflow step
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.debug('CaptureService executing step', { description: step.description });

    switch (step.action) {
      case 'navigate':
        await this.page.goto(`${this.appUrl}${step.target || ''}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        break;

      case 'click':
        if (step.target) {
          await this.page.waitForSelector(step.target, { timeout: 10000 });
          await this.page.click(step.target);
        }
        break;

      case 'type':
        if (step.target && step.value) {
          await this.page.waitForSelector(step.target, { timeout: 10000 });
          await this.page.type(step.target, String(step.value), { delay: 50 });
        }
        break;

      case 'wait':
        await new Promise(resolve => setTimeout(resolve, (step.value as number) * 1000 || 1000));
        break;

      case 'scroll':
        await this.page.evaluate((amount) => {
          window.scrollBy(0, amount);
        }, step.value as number || 300);
        break;

      case 'hover':
        if (step.target) {
          await this.page.waitForSelector(step.target, { timeout: 10000 });
          await this.page.hover(step.target);
        }
        break;
    }

    // Small delay between steps for smooth video
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Execute a complete workflow with recording
   */
  async captureWorkflow(workflow: CaptureWorkflow): Promise<string | null> {
    logger.info('CaptureService starting workflow', {
      name: workflow.name,
      description: workflow.description,
      expectedDuration: workflow.duration,
    });

    await this.startRecording(workflow.name.toLowerCase().replace(/\s+/g, '_'));

    try {
      for (const step of workflow.steps) {
        await this.executeStep(step);
      }

      // Hold final frame
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`[CaptureService] Error during workflow: ${error}`);
      throw error;
    } finally {
      return await this.stopRecording();
    }
  }

  /**
   * Login to the application
   */
  async login(email: string, password: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.info('CaptureService logging in');

    await this.page.goto(`${this.appUrl}/login`, {
      waitUntil: 'networkidle2',
    });

    await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await this.page.type('input[type="email"], input[name="email"]', email, { delay: 30 });

    await this.page.type('input[type="password"], input[name="password"]', password, { delay: 30 });

    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

    logger.info('CaptureService login successful');
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.recorder) {
      await this.stopRecording();
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    logger.info('CaptureService browser closed');
  }
}

// Pre-defined workflows for Synthex features
// Uses URL navigation for reliability - no element-specific selectors
export const SYNTHEX_WORKFLOWS: Record<string, CaptureWorkflow> = {
  platformOverview: {
    name: 'Platform Overview',
    description: 'Complete tour of Synthex dashboard showing all main features',
    duration: 60,
    steps: [
      { action: 'navigate', target: '/', description: 'Open landing page' },
      { action: 'wait', value: 3, description: 'Show landing page' },
      { action: 'scroll', value: 400, description: 'Scroll down landing' },
      { action: 'wait', value: 2, description: 'Show features section' },
      { action: 'navigate', target: '/dashboard', description: 'Go to dashboard' },
      { action: 'wait', value: 3, description: 'Show dashboard overview' },
      { action: 'scroll', value: 300, description: 'Scroll dashboard' },
      { action: 'wait', value: 2, description: 'Show dashboard stats' },
      { action: 'navigate', target: '/dashboard/content', description: 'Go to Content Generator' },
      { action: 'wait', value: 3, description: 'Show Content Generator' },
      { action: 'navigate', target: '/dashboard/analytics', description: 'Go to Analytics' },
      { action: 'wait', value: 3, description: 'Show Analytics Dashboard' },
      { action: 'navigate', target: '/dashboard/schedule', description: 'Go to Scheduler' },
      { action: 'wait', value: 3, description: 'Show Scheduler' },
    ],
  },

  contentGenerator: {
    name: 'Content Generator',
    description: 'Demonstrate AI content generation for social media posts',
    duration: 45,
    steps: [
      { action: 'navigate', target: '/dashboard/content', description: 'Open Content Generator' },
      { action: 'wait', value: 3, description: 'Show Content Generator page' },
      { action: 'scroll', value: 300, description: 'Scroll to form' },
      { action: 'wait', value: 2, description: 'Show content form' },
      { action: 'scroll', value: 300, description: 'Scroll to options' },
      { action: 'wait', value: 3, description: 'Show generation options' },
    ],
  },

  analyticsDashboard: {
    name: 'Analytics Dashboard',
    description: 'Show real-time analytics and engagement metrics',
    duration: 45,
    steps: [
      { action: 'navigate', target: '/dashboard/analytics', description: 'Open Analytics Dashboard' },
      { action: 'wait', value: 3, description: 'Show analytics overview' },
      { action: 'scroll', value: 400, description: 'Scroll to charts' },
      { action: 'wait', value: 3, description: 'Show engagement charts' },
      { action: 'scroll', value: 400, description: 'Scroll to platform breakdown' },
      { action: 'wait', value: 2, description: 'Show platform metrics' },
    ],
  },

  smartScheduler: {
    name: 'Smart Scheduler',
    description: 'Demonstrate content scheduling with calendar views',
    duration: 45,
    steps: [
      { action: 'navigate', target: '/dashboard/schedule', description: 'Open Scheduler' },
      { action: 'wait', value: 3, description: 'Show scheduler view' },
      { action: 'scroll', value: 300, description: 'Scroll calendar' },
      { action: 'wait', value: 2, description: 'Show calendar details' },
      { action: 'scroll', value: 300, description: 'Scroll to schedule list' },
      { action: 'wait', value: 3, description: 'Show scheduled posts' },
    ],
  },

  viralPatterns: {
    name: 'Viral Patterns',
    description: 'Show viral pattern analysis and insights',
    duration: 45,
    steps: [
      { action: 'navigate', target: '/dashboard/patterns', description: 'Open Viral Patterns' },
      { action: 'wait', value: 3, description: 'Show pattern overview' },
      { action: 'scroll', value: 400, description: 'Scroll to pattern charts' },
      { action: 'wait', value: 3, description: 'Show pattern visualization' },
      { action: 'scroll', value: 300, description: 'Scroll to insights' },
      { action: 'wait', value: 2, description: 'Show pattern insights' },
    ],
  },
};

export default CaptureService;
