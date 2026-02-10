/**
 * SYNTHEX Video Processor Service
 *
 * Uses FFmpeg to process, trim, and enhance captured videos.
 * Adds voiceover audio tracks and text overlays.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - ELEVENLABS_API_KEY: For generating voiceover narration
 */

import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as ffprobeInstaller from '@ffprobe-installer/ffprobe';
import * as path from 'path';
import * as fs from 'fs';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export interface VideoProcessConfig {
  inputDir: string;
  outputDir: string;
  width: number;
  height: number;
  bitrate: string;
  codec: string;
}

export interface TextOverlay {
  text: string;
  startTime: number;
  duration: number;
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  color: string;
}

export interface ProcessingOptions {
  trimStart?: number;
  trimEnd?: number;
  audioTrack?: string;
  overlays?: TextOverlay[];
  fadeIn?: number;
  fadeOut?: number;
  watermark?: string;
}

const DEFAULT_CONFIG: VideoProcessConfig = {
  inputDir: './output/raw',
  outputDir: './output/processed',
  width: 1920,
  height: 1080,
  bitrate: '8000k',
  codec: 'libx264',
};

export class VideoProcessor {
  private config: VideoProcessConfig;

  constructor(config: Partial<VideoProcessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Get video metadata
   */
  async getMetadata(inputPath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  /**
   * Trim video to specific duration
   */
  async trim(
    inputPath: string,
    outputFilename: string,
    startTime: number,
    duration: number
  ): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .videoCodec(this.config.codec)
        .videoBitrate(this.config.bitrate)
        .size(`${this.config.width}x${this.config.height}`)
        .output(outputPath)
        .on('start', (cmd) => console.log(`[VideoProcessor] Starting trim: ${cmd}`))
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VideoProcessor] Trim progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log(`[VideoProcessor] Trim complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Trim error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Add audio track (voiceover) to video
   */
  async addAudio(
    videoPath: string,
    audioPath: string,
    outputFilename: string,
    options: { mixOriginal?: boolean; audioVolume?: number } = {}
  ): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);
    const { mixOriginal = false, audioVolume = 1.0 } = options;

    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
        .input(audioPath)
        .videoCodec('copy');

      if (mixOriginal) {
        // Mix original audio with voiceover
        command = command
          .complexFilter([
            `[0:a]volume=0.3[original]`,
            `[1:a]volume=${audioVolume}[voice]`,
            `[original][voice]amix=inputs=2:duration=longest[aout]`,
          ])
          .outputOptions(['-map', '0:v', '-map', '[aout]']);
      } else {
        // Replace audio entirely
        command = command
          .outputOptions(['-map', '0:v', '-map', '1:a'])
          .audioCodec('aac')
          .audioBitrate('192k');
      }

      command
        .output(outputPath)
        .on('start', (cmd) => console.log(`[VideoProcessor] Adding audio: ${cmd}`))
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VideoProcessor] Audio progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log(`[VideoProcessor] Audio added: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Audio error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Add text overlay to video
   */
  async addTextOverlay(
    inputPath: string,
    outputFilename: string,
    overlays: TextOverlay[]
  ): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);

    // Build filter complex for text overlays
    const filters = overlays.map((overlay, index) => {
      const yPosition =
        overlay.position === 'top'
          ? 50
          : overlay.position === 'bottom'
          ? this.config.height - 100
          : this.config.height / 2;

      return `drawtext=text='${overlay.text.replace(/'/g, "\\'")}':fontsize=${overlay.fontSize}:fontcolor=${overlay.color}:x=(w-text_w)/2:y=${yPosition}:enable='between(t,${overlay.startTime},${overlay.startTime + overlay.duration})'`;
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filters)
        .videoCodec(this.config.codec)
        .videoBitrate(this.config.bitrate)
        .output(outputPath)
        .on('start', (cmd) => console.log(`[VideoProcessor] Adding overlays: ${cmd}`))
        .on('end', () => {
          console.log(`[VideoProcessor] Overlays added: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Overlay error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Add fade in/out effects
   */
  async addFades(
    inputPath: string,
    outputFilename: string,
    fadeIn: number = 1,
    fadeOut: number = 1
  ): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);
    const metadata = await this.getMetadata(inputPath);
    const duration = metadata.format.duration || 0;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([
          `fade=t=in:st=0:d=${fadeIn}`,
          `fade=t=out:st=${duration - fadeOut}:d=${fadeOut}`,
        ])
        .audioFilters([
          `afade=t=in:st=0:d=${fadeIn}`,
          `afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`,
        ])
        .videoCodec(this.config.codec)
        .videoBitrate(this.config.bitrate)
        .output(outputPath)
        .on('start', (cmd) => console.log(`[VideoProcessor] Adding fades: ${cmd}`))
        .on('end', () => {
          console.log(`[VideoProcessor] Fades added: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Fade error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Concatenate multiple videos
   */
  async concatenate(inputPaths: string[], outputFilename: string): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);

    // Create a file list for FFmpeg
    const listPath = path.join(this.config.outputDir, 'concat_list.txt');
    const listContent = inputPaths.map((p) => `file '${path.resolve(p)}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .videoCodec('copy')
        .audioCodec('copy')
        .output(outputPath)
        .on('start', (cmd) => console.log(`[VideoProcessor] Concatenating: ${cmd}`))
        .on('end', () => {
          // Clean up list file
          fs.unlinkSync(listPath);
          console.log(`[VideoProcessor] Concatenation complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Concat error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    inputPath: string,
    outputFilename: string,
    timestamp: number = 5
  ): Promise<string> {
    const outputPath = path.join(this.config.outputDir, outputFilename);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: outputFilename,
          folder: this.config.outputDir,
          size: `${this.config.width}x${this.config.height}`,
        })
        .on('end', () => {
          console.log(`[VideoProcessor] Thumbnail generated: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VideoProcessor] Thumbnail error: ${err.message}`);
          reject(err);
        });
    });
  }

  /**
   * Full processing pipeline
   */
  async processVideo(
    inputPath: string,
    outputFilename: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    console.log(`[VideoProcessor] Starting full processing pipeline for: ${inputPath}`);

    let currentPath = inputPath;

    // 1. Trim if needed
    if (options.trimStart !== undefined || options.trimEnd !== undefined) {
      const metadata = await this.getMetadata(inputPath);
      const duration = metadata.format.duration || 0;
      const start = options.trimStart || 0;
      const end = options.trimEnd || duration;
      currentPath = await this.trim(currentPath, `trimmed_${Date.now()}.mp4`, start, end - start);
    }

    // 2. Add audio if provided
    if (options.audioTrack) {
      currentPath = await this.addAudio(
        currentPath,
        options.audioTrack,
        `audio_${Date.now()}.mp4`
      );
    }

    // 3. Add text overlays if provided
    if (options.overlays && options.overlays.length > 0) {
      currentPath = await this.addTextOverlay(
        currentPath,
        `overlay_${Date.now()}.mp4`,
        options.overlays
      );
    }

    // 4. Add fades
    if (options.fadeIn || options.fadeOut) {
      currentPath = await this.addFades(
        currentPath,
        outputFilename,
        options.fadeIn || 0,
        options.fadeOut || 0
      );
    } else {
      // Just copy to final output
      const finalPath = path.join(this.config.outputDir, outputFilename);
      fs.copyFileSync(currentPath, finalPath);
      currentPath = finalPath;
    }

    console.log(`[VideoProcessor] Processing complete: ${currentPath}`);
    return currentPath;
  }
}

export default VideoProcessor;
