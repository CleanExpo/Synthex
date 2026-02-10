/**
 * SYNTHEX Video Production Module
 *
 * Exports all video production services for the Synthex platform.
 */

export { CaptureService, SYNTHEX_WORKFLOWS } from './capture-service';
export type { CaptureConfig, WorkflowStep, CaptureWorkflow } from './capture-service';

export { VideoProcessor } from './video-processor';
export type { VideoProcessConfig, TextOverlay, ProcessingOptions } from './video-processor';

export { YouTubeUploader, YOUTUBE_CATEGORIES, SYNTHEX_VIDEO_METADATA } from './youtube-uploader';
export type { VideoMetadata, UploadResult } from './youtube-uploader';

export { VideoOrchestrator } from './video-orchestrator';
export type { VideoScript, ProductionResult } from './video-orchestrator';
