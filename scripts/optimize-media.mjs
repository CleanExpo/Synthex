#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const MODE = process.argv.includes('--write') ? 'write' : 'check';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const GENERATED_IMAGE_EXTENSIONS = new Set(['.webp', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov']);
const GENERATED_VIDEO_EXTENSIONS = new Set(['.webm']);
const MAX_IMAGE_SOURCE_BYTES = 512 * 1024;
const MAX_VIDEO_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BITRATE = 2_500_000;
const fail = [];
const warn = [];
const writes = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else {
      files.push(absolute);
    }
  }

  return files;
}

function rel(file) {
  return path.relative(ROOT, file);
}

function sidecarPath(file, extension) {
  return file.replace(path.extname(file), extension);
}

async function fileHash(file) {
  const input = await import('node:fs/promises').then(fs => fs.readFile(file));
  return createHash('sha256').update(input).digest('hex');
}

async function writeIfChanged(target, buffer) {
  if (existsSync(target)) {
    const [existingHash, nextHash] = await Promise.all([
      fileHash(target),
      Promise.resolve(createHash('sha256').update(buffer).digest('hex')),
    ]);
    if (existingHash === nextHash) return;
  }

  await import('node:fs/promises').then(fs => fs.writeFile(target, buffer));
  writes.push(rel(target));
}

async function optimizeImage(file) {
  const metadata = await sharp(file).metadata();
  const stats = await stat(file);
  const ext = path.extname(file).toLowerCase();
  const expectedFormat = ext === '.png' ? 'png' : 'jpeg';
  const webpTarget = sidecarPath(file, '.webp');
  const avifTarget = sidecarPath(file, '.avif');

  if (metadata.format !== expectedFormat) {
    fail.push(`${rel(file)} has .${expectedFormat} extension but contains ${metadata.format}`);
  }

  if (stats.size > MAX_IMAGE_SOURCE_BYTES) {
    warn.push(`${rel(file)} source is ${Math.round(stats.size / 1024)}KB; prefer using generated WebP/AVIF in UI`);
  }

  if (MODE === 'write') {
    const pipeline = sharp(file, { animated: false }).rotate();
    await writeIfChanged(
      webpTarget,
      await pipeline.clone().webp({ quality: 82, effort: 6 }).toBuffer()
    );
    await writeIfChanged(
      avifTarget,
      await pipeline.clone().avif({ quality: 58, effort: 6 }).toBuffer()
    );
    return;
  }

  for (const target of [webpTarget, avifTarget]) {
    if (!existsSync(target)) {
      fail.push(`${rel(file)} is missing optimized sidecar ${rel(target)}`);
    }
  }
}

function runBinary(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `Command failed with exit code ${code}`));
    });
  });
}

async function probeVideo(file) {
  const { stdout } = await runBinary(ffprobeInstaller.path, [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_name,width,height,bit_rate,duration',
    '-show_entries',
    'format=size,duration,bit_rate',
    '-of',
    'json',
    file,
  ]);
  return JSON.parse(stdout);
}

async function optimizeVideo(file) {
  const stats = await stat(file);
  const probe = await probeVideo(file);
  const videoStream = probe.streams?.find(stream => Number(stream.width) > 0);
  const bitRate = Number(probe.format?.bit_rate ?? videoStream?.bit_rate ?? 0);
  const webmTarget = sidecarPath(file, '.webm');

  if (stats.size > MAX_VIDEO_SOURCE_BYTES) {
    fail.push(`${rel(file)} is ${Math.round(stats.size / 1024 / 1024)}MB; public delivery videos must stay under 12MB`);
  }

  if (bitRate > MAX_VIDEO_BITRATE) {
    warn.push(`${rel(file)} bitrate is ${Math.round(bitRate / 1000)}kbps; consider a lower-bitrate render`);
  }

  if (MODE === 'write') {
    await runBinary(ffmpegInstaller.path, [
      '-y',
      '-i',
      file,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '34',
      '-b:v',
      '0',
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
      '-row-mt',
      '1',
      webmTarget,
    ]);
    writes.push(rel(webmTarget));
    return;
  }

  if (!existsSync(webmTarget)) {
    fail.push(`${rel(file)} is missing optimized sidecar ${rel(webmTarget)}`);
  }
}

async function main() {
  const files = await walk(PUBLIC_DIR);
  const sourceImages = files.filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const generatedImages = files.filter(file =>
    GENERATED_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())
  );
  const sourceVideos = files.filter(file => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const generatedVideos = files.filter(file =>
    GENERATED_VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase())
  );

  await Promise.all(sourceImages.map(optimizeImage));
  await Promise.all(sourceVideos.map(optimizeVideo));

  console.log(
    `Media ${MODE}: ${sourceImages.length} source images, ${generatedImages.length} generated images, ` +
      `${sourceVideos.length} source videos, ${generatedVideos.length} generated videos`
  );

  if (writes.length > 0) {
    console.log(`Updated ${writes.length} optimized media files:`);
    for (const file of writes.sort()) console.log(`- ${file}`);
  }

  if (warn.length > 0) {
    console.warn('Warnings:');
    for (const item of warn.sort()) console.warn(`- ${item}`);
  }

  if (fail.length > 0) {
    console.error('Media gate failed:');
    for (const item of fail.sort()) console.error(`- ${item}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
