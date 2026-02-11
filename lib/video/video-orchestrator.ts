/**
 * SYNTHEX Video Orchestrator
 *
 * Coordinates the entire video production pipeline:
 * Capture → Process → Upload → Integrate
 *
 * NO MOCK DATA - All videos use real application UI and data.
 */

import { CaptureService, SYNTHEX_WORKFLOWS, CaptureWorkflow } from './capture-service';
import { VideoProcessor, TextOverlay } from './video-processor';
import { YouTubeUploader, SYNTHEX_VIDEO_METADATA, UploadResult, VideoMetadata } from './youtube-uploader';
import * as path from 'path';
import * as fs from 'fs';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { logger } from '@/lib/logger';

export interface VideoScript {
  workflow: CaptureWorkflow;
  voiceoverScript: string;
  overlays: TextOverlay[];
  metadata: Partial<VideoMetadata>;
}

export interface ProductionResult {
  workflowName: string;
  rawVideoPath: string;
  processedVideoPath: string;
  youtubeResult?: UploadResult;
  thumbnailPath?: string;
  success: boolean;
  error?: string;
}

export class VideoOrchestrator {
  private captureService: CaptureService;
  private videoProcessor: VideoProcessor;
  private youtubeUploader: YouTubeUploader;
  private outputDir: string;

  constructor() {
    this.outputDir = './output';
    this.captureService = new CaptureService({
      outputDir: path.join(this.outputDir, 'raw'),
    });
    this.videoProcessor = new VideoProcessor({
      inputDir: path.join(this.outputDir, 'raw'),
      outputDir: path.join(this.outputDir, 'processed'),
    });
    this.youtubeUploader = new YouTubeUploader();

    // Ensure directories exist
    ['raw', 'processed', 'final', 'thumbnails'].forEach((dir) => {
      const dirPath = path.join(this.outputDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * Check system readiness
   */
  async checkReadiness(): Promise<{ ready: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check YouTube credentials
    if (!this.youtubeUploader.isConfigured()) {
      issues.push('YouTube API credentials not configured (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN)');
    }

    // Check ElevenLabs
    if (!process.env.ELEVENLABS_API_KEY) {
      issues.push('ElevenLabs API key not configured (ELEVENLABS_API_KEY)');
    }

    // Check FFmpeg
    try {
      if (!ffmpegInstaller.path || !fs.existsSync(ffmpegInstaller.path)) {
        issues.push('FFmpeg not found');
      }
    } catch (e) {
      issues.push(`FFmpeg check failed: ${e}`);
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }

  /**
   * Produce a single video
   */
  async produceVideo(
    workflowName: keyof typeof SYNTHEX_WORKFLOWS,
    options: {
      login?: { email: string; password: string };
      voiceoverPath?: string;
      skipUpload?: boolean;
    } = {}
  ): Promise<ProductionResult> {
    const workflow = SYNTHEX_WORKFLOWS[workflowName];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    logger.info('Orchestrator starting production', { workflowName: workflow.name });

    const result: ProductionResult = {
      workflowName: workflow.name,
      rawVideoPath: '',
      processedVideoPath: '',
      success: false,
    };

    try {
      // Phase 1: Capture
      logger.info('Orchestrator Phase 1: Capture');
      await this.captureService.init();

      if (options.login) {
        await this.captureService.login(options.login.email, options.login.password);
      }

      result.rawVideoPath = (await this.captureService.captureWorkflow(workflow)) || '';
      await this.captureService.close();

      if (!result.rawVideoPath || !fs.existsSync(result.rawVideoPath)) {
        throw new Error('Capture failed - no output file');
      }

      logger.info('Orchestrator raw capture saved', { path: result.rawVideoPath });

      // Phase 2: Process
      logger.info('Orchestrator Phase 2: Process');
      const finalFilename = `synthex_${workflowName.toLowerCase()}.mp4`;

      result.processedVideoPath = await this.videoProcessor.processVideo(
        result.rawVideoPath,
        finalFilename,
        {
          fadeIn: 0.5,
          fadeOut: 0.5,
          audioTrack: options.voiceoverPath,
        }
      );

      // Generate thumbnail
      const thumbnailFilename = `thumb_${workflowName.toLowerCase()}.jpg`;
      result.thumbnailPath = await this.videoProcessor.generateThumbnail(
        result.processedVideoPath,
        thumbnailFilename,
        5 // 5 seconds into video
      );

      logger.info('Orchestrator processed video', { path: result.processedVideoPath });

      // Phase 3: Upload to YouTube
      if (!options.skipUpload && this.youtubeUploader.isConfigured()) {
        logger.info('Orchestrator Phase 3: Upload to YouTube');

        const metadata = SYNTHEX_VIDEO_METADATA[workflowName] as VideoMetadata;
        if (metadata) {
          metadata.thumbnailPath = result.thumbnailPath;
          result.youtubeResult = await this.youtubeUploader.uploadVideo(
            result.processedVideoPath,
            metadata
          );
          logger.info('Orchestrator YouTube upload complete', { url: result.youtubeResult.videoUrl });
        }
      } else if (options.skipUpload) {
        logger.info('Orchestrator Phase 3: Upload skipped', { reason: 'skipUpload=true' });
      } else {
        logger.info('Orchestrator Phase 3: Upload skipped', { reason: 'YouTube not configured' });
      }

      result.success = true;
      logger.info('Orchestrator production complete', { workflowName: workflow.name });

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] Production failed: ${result.error}`);

      // Clean up on error
      try {
        await this.captureService.close();
      } catch (cleanupError) {
        console.warn('[VideoOrchestrator] Failed to close capture service:', cleanupError);
      }
    }

    return result;
  }

  /**
   * Produce all videos
   */
  async produceAll(
    options: {
      login?: { email: string; password: string };
      skipUpload?: boolean;
    } = {}
  ): Promise<ProductionResult[]> {
    const results: ProductionResult[] = [];

    const workflows = Object.keys(SYNTHEX_WORKFLOWS) as Array<keyof typeof SYNTHEX_WORKFLOWS>;

    for (const workflowName of workflows) {
      const result = await this.produceVideo(workflowName, options);
      results.push(result);

      // Pause between videos
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    logger.info('Production summary', {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
    });

    if (successful.length > 0) {
      logger.info('Successful videos', {
        videos: successful.map((r) => ({
          name: r.workflowName,
          url: r.youtubeResult?.videoUrl || r.processedVideoPath,
        })),
      });
    }

    if (failed.length > 0) {
      logger.warn('Failed videos', {
        videos: failed.map((r) => ({
          name: r.workflowName,
          error: r.error,
        })),
      });
    }

    return results;
  }

  /**
   * Generate website embed code
   */
  generateEmbedCode(result: UploadResult, width: number = 560, height: number = 315): string {
    return `<iframe
  width="${width}"
  height="${height}"
  src="${result.embedUrl}"
  title="Synthex Video"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>`;
  }

  /**
   * Export results for website integration
   */
  exportResults(results: ProductionResult[]): void {
    const exportPath = path.join(this.outputDir, 'production_results.json');

    const exportData = results.map((r) => ({
      name: r.workflowName,
      success: r.success,
      localPath: r.processedVideoPath,
      youtube: r.youtubeResult
        ? {
            videoId: r.youtubeResult.videoId,
            url: r.youtubeResult.videoUrl,
            embedUrl: r.youtubeResult.embedUrl,
            thumbnail: r.youtubeResult.thumbnailUrl,
            embedCode: this.generateEmbedCode(r.youtubeResult),
          }
        : null,
      error: r.error,
    }));

    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    logger.info('Orchestrator results exported', { path: exportPath });
  }
}

export default VideoOrchestrator;
