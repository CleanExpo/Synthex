/**
 * PlaywrightCaptureService — lib/video/playwright-capture-service.ts
 *
 * Replaces the broken Puppeteer-based CaptureService (puppeteer-screen-recorder
 * was removed in Phase 120). Uses Playwright's native `recordVideo` context
 * option to capture real dashboard workflows as WebM files.
 *
 * Key differences from old CaptureService:
 *  - Playwright native video recording (no external recorder dependency)
 *  - Output format: WebM (Playwright default) — FFmpeg converts to MP4 downstream
 *  - Preserves the WorkflowStep/CaptureWorkflow interfaces for compatibility
 *  - Imports SYNTHEX_WORKFLOWS from capture-service.ts
 *  - Adds CLIENT-series workflows for feature demonstrations
 *
 * @task SYN-575
 */

import * as path from 'path';
import * as fs from 'fs';
import { logger } from '@/lib/logger';
import type {
  CaptureConfig,
  WorkflowStep,
  CaptureWorkflow,
} from './capture-service';
import { SYNTHEX_WORKFLOWS } from './capture-service';

// Re-export the shared types + legacy workflows
export type { CaptureConfig, WorkflowStep, CaptureWorkflow };
export { SYNTHEX_WORKFLOWS };

// ── Playwright types (lazy-loaded for serverless safety) ────────────────────

type PlaywrightBrowser = import('playwright').Browser;
type PlaywrightBrowserContext = import('playwright').BrowserContext;
type PlaywrightPage = import('playwright').Page;

// ── Additional CLIENT-series workflows ──────────────────────────────────────

export const CLIENT_WORKFLOWS: Record<string, CaptureWorkflow> = {
  contentCalendarWalkthrough: {
    name: 'Content Calendar Walkthrough',
    description:
      'Navigate the weekly content calendar showing AI-generated slots and market opportunity cards',
    duration: 50,
    steps: [
      {
        action: 'navigate',
        target: '/dashboard/schedule',
        description: 'Open content calendar',
      },
      { action: 'wait', value: 3, description: 'Show weekly calendar view' },
      { action: 'scroll', value: 300, description: 'Scroll through days' },
      { action: 'wait', value: 2, description: 'Show slot details' },
      { action: 'scroll', value: 300, description: 'Scroll to market slots' },
      {
        action: 'wait',
        value: 3,
        description: 'Show market opportunity cards',
      },
    ],
  },

  analyticsDeepDive: {
    name: 'Analytics Deep Dive',
    description:
      'Walk through the analytics dashboard with platform-level drill-downs',
    duration: 55,
    steps: [
      {
        action: 'navigate',
        target: '/dashboard/analytics',
        description: 'Open analytics',
      },
      { action: 'wait', value: 3, description: 'Show overview metrics' },
      { action: 'scroll', value: 400, description: 'Scroll to engagement' },
      { action: 'wait', value: 2, description: 'Show engagement charts' },
      {
        action: 'scroll',
        value: 400,
        description: 'Scroll to platform breakdown',
      },
      { action: 'wait', value: 3, description: 'Show per-platform stats' },
      {
        action: 'scroll',
        value: 300,
        description: 'Scroll to content performance',
      },
      { action: 'wait', value: 2, description: 'Show top performing posts' },
    ],
  },

  brandDNASetup: {
    name: 'Brand DNA Setup',
    description:
      'Demonstrate the Brand DNA configuration and voice tone selection',
    duration: 45,
    steps: [
      {
        action: 'navigate',
        target: '/dashboard/brand',
        description: 'Open Brand DNA',
      },
      { action: 'wait', value: 3, description: 'Show brand configuration' },
      { action: 'scroll', value: 300, description: 'Scroll to voice tone' },
      { action: 'wait', value: 2, description: 'Show voice settings' },
      { action: 'scroll', value: 300, description: 'Scroll to preview' },
      { action: 'wait', value: 3, description: 'Show brand voice preview' },
    ],
  },

  campaignCreation: {
    name: 'Campaign Creation',
    description: 'Walk through creating a new content campaign from scratch',
    duration: 50,
    steps: [
      {
        action: 'navigate',
        target: '/dashboard/campaigns',
        description: 'Open campaigns',
      },
      { action: 'wait', value: 3, description: 'Show campaign list' },
      {
        action: 'navigate',
        target: '/dashboard/campaigns/new',
        description: 'Start new campaign',
      },
      { action: 'wait', value: 3, description: 'Show campaign form' },
      { action: 'scroll', value: 300, description: 'Scroll to settings' },
      { action: 'wait', value: 2, description: 'Show campaign settings' },
      { action: 'scroll', value: 300, description: 'Scroll to platforms' },
      {
        action: 'wait',
        value: 3,
        description: 'Show platform selection',
      },
    ],
  },

  onboardingFlow: {
    name: 'Onboarding Flow',
    description: 'Show the complete onboarding experience for new clients',
    duration: 60,
    steps: [
      {
        action: 'navigate',
        target: '/onboarding',
        description: 'Start onboarding',
      },
      { action: 'wait', value: 3, description: 'Show onboarding step 1' },
      {
        action: 'navigate',
        target: '/onboarding/audit',
        description: 'Website audit step',
      },
      { action: 'wait', value: 3, description: 'Show audit results' },
      {
        action: 'navigate',
        target: '/onboarding/goals',
        description: 'Goals step',
      },
      { action: 'wait', value: 3, description: 'Show goals questionnaire' },
      {
        action: 'navigate',
        target: '/onboarding/socials',
        description: 'Social profiles step',
      },
      { action: 'wait', value: 3, description: 'Show social connection' },
    ],
  },
};

// Merge all workflows into one registry
export const ALL_WORKFLOWS: Record<string, CaptureWorkflow> = {
  ...SYNTHEX_WORKFLOWS,
  ...CLIENT_WORKFLOWS,
};

// ── Default config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: CaptureConfig = {
  outputDir: './output/raw',
  width: 1920,
  height: 1080,
  fps: 30,
  format: 'webm', // Playwright native output
};

// ── Service class ───────────────────────────────────────────────────────────

export class PlaywrightCaptureService {
  private browser: PlaywrightBrowser | null = null;
  private context: PlaywrightBrowserContext | null = null;
  private page: PlaywrightPage | null = null;
  private config: CaptureConfig;
  private appUrl: string;

  constructor(config: Partial<CaptureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.appUrl = process.env.APP_URL || 'http://localhost:3008';

    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Launch browser with video recording enabled.
   * Playwright records from context creation — the video file is finalised
   * when the context is closed.
   */
  async init(): Promise<void> {
    // Dynamic import — Playwright may not be available in all environments
    const { chromium } = await import(/* webpackIgnore: true */ 'playwright');

    logger.info('PlaywrightCaptureService: launching browser');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    // Create context with video recording enabled
    this.context = await this.browser.newContext({
      viewport: { width: this.config.width, height: this.config.height },
      recordVideo: {
        dir: this.config.outputDir,
        size: { width: this.config.width, height: this.config.height },
      },
    });

    this.page = await this.context.newPage();

    logger.info('PlaywrightCaptureService: browser initialised with recording');
  }

  /**
   * Log in to the Synthex dashboard.
   * Uses env vars for demo account credentials by default.
   */
  async login(email?: string, password?: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialised. Call init() first.');
    }

    const loginEmail = email || process.env.DEMO_USER_EMAIL || '';
    const loginPassword = password || process.env.DEMO_USER_PASSWORD || '';

    if (!loginEmail || !loginPassword) {
      throw new Error(
        'Login credentials not provided. Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD.'
      );
    }

    logger.info('PlaywrightCaptureService: logging in');

    await this.page.goto(`${this.appUrl}/login`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    await this.page.fill(
      'input[type="email"], input[name="email"]',
      loginEmail
    );
    await this.page.fill(
      'input[type="password"], input[name="password"]',
      loginPassword
    );
    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await this.page.waitForURL('**/dashboard**', { timeout: 15_000 });

    logger.info('PlaywrightCaptureService: login successful');
  }

  /**
   * Execute a single workflow step.
   * Compatible with the existing WorkflowStep interface from capture-service.ts.
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialised');
    }

    logger.debug('PlaywrightCaptureService: executing step', {
      description: step.description,
    });

    switch (step.action) {
      case 'navigate':
        await this.page.goto(`${this.appUrl}${step.target || ''}`, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        break;

      case 'click':
        if (step.target) {
          await this.page.waitForSelector(step.target, { timeout: 10_000 });
          await this.page.click(step.target);
        }
        break;

      case 'type':
        if (step.target && step.value) {
          await this.page.waitForSelector(step.target, { timeout: 10_000 });
          await this.page.fill(step.target, String(step.value));
        }
        break;

      case 'wait':
        await this.page.waitForTimeout(((step.value as number) || 1) * 1_000);
        break;

      case 'scroll':
        await this.page.evaluate(
          (amount: number) => window.scrollBy(0, amount),
          (step.value as number) || 300
        );
        break;

      case 'hover':
        if (step.target) {
          await this.page.waitForSelector(step.target, { timeout: 10_000 });
          await this.page.hover(step.target);
        }
        break;
    }

    // Small delay between steps for smooth video
    await this.page.waitForTimeout(500);
  }

  /**
   * Execute a complete workflow and return the video file path.
   *
   * Playwright records the entire browser context. To get a per-workflow
   * file, we close the current context (which finalises the video) and
   * re-create a fresh one for the next workflow.
   */
  async captureWorkflow(workflow: CaptureWorkflow): Promise<string | null> {
    logger.info('PlaywrightCaptureService: starting workflow', {
      name: workflow.name,
      duration: workflow.duration,
    });

    try {
      for (const step of workflow.steps) {
        await this.executeStep(step);
      }

      // Hold final frame
      await this.page?.waitForTimeout(2_000);
    } catch (error) {
      logger.error('PlaywrightCaptureService: workflow error', { error });
      throw error;
    }

    // Close context to finalise the video file
    const videoPath = await this.finaliseRecording();

    logger.info('PlaywrightCaptureService: workflow captured', {
      name: workflow.name,
      videoPath,
    });

    return videoPath;
  }

  /**
   * Take a single screenshot (useful for thumbnail generation or still frames).
   */
  async captureScreenshot(filename: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialised');
    }

    const screenshotPath = path.join(this.config.outputDir, `${filename}.png`);
    await this.page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    logger.info('PlaywrightCaptureService: screenshot captured', {
      path: screenshotPath,
    });

    return screenshotPath;
  }

  /**
   * Capture a series of screenshots at each workflow step.
   * Alternative to video — useful in serverless environments where
   * video recording may not be available.
   */
  async captureScreenshotSequence(
    workflow: CaptureWorkflow
  ): Promise<string[]> {
    const screenshots: string[] = [];
    const baseName = workflow.name.toLowerCase().replace(/\s+/g, '_');

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      await this.executeStep(step);

      // Capture after 'wait' and 'navigate' steps (meaningful visual states)
      if (step.action === 'wait' || step.action === 'navigate') {
        const filename = `${baseName}_${String(i).padStart(2, '0')}`;
        const screenshotPath = await this.captureScreenshot(filename);
        screenshots.push(screenshotPath);
      }
    }

    logger.info('PlaywrightCaptureService: screenshot sequence captured', {
      name: workflow.name,
      count: screenshots.length,
    });

    return screenshots;
  }

  /**
   * Finalise the current recording by closing the context.
   * Returns the path to the recorded WebM file.
   * Re-creates a fresh context + page for subsequent captures.
   */
  private async finaliseRecording(): Promise<string | null> {
    if (!this.page || !this.context) {
      return null;
    }

    // Get the video path before closing
    const video = this.page.video();
    if (!video) {
      logger.warn('PlaywrightCaptureService: no video attached to page');
      await this.context.close();
      return null;
    }

    // Close context — this finalises and saves the video file
    await this.context.close();
    const videoPath = await video.path();

    // Re-create context + page for next capture
    if (this.browser) {
      this.context = await this.browser.newContext({
        viewport: { width: this.config.width, height: this.config.height },
        recordVideo: {
          dir: this.config.outputDir,
          size: { width: this.config.width, height: this.config.height },
        },
      });
      this.page = await this.context.newPage();
    }

    return videoPath;
  }

  /**
   * Close the browser and release all resources.
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {
        // Context may already be closed from finaliseRecording
      });
      this.context = null;
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('PlaywrightCaptureService: browser closed');
  }
}

export default PlaywrightCaptureService;
