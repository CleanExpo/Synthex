/**
 * Public Testimonial Submission
 *
 * GET  /api/public/testimonials/[token] — validate token + return form config
 * POST /api/public/testimonials/[token] — submit testimonial with optional media
 *
 * No authentication required — this is a public endpoint.
 * Rate-limited and IP-logged for spam prevention.
 * File uploads go directly to Supabase Storage under testimonials/ bucket.
 *
 * UNI-1637
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateFile, uploadToStorage } from '@/lib/storage/supabase-storage';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// GET — Validate token and return form configuration
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const req = await prisma.testimonialRequest.findUnique({
    where: { token },
    select: {
      id: true,
      title: true,
      subtitle: true,
      isActive: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  });

  if (!req || !req.isActive) {
    return NextResponse.json(
      { error: 'This link is no longer active.' },
      { status: 404 }
    );
  }
  if (req.expiresAt && req.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired.' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    title: req.title,
    subtitle: req.subtitle,
    businessName: req.organization.name,
  });
}

// ---------------------------------------------------------------------------
// POST — Submit a testimonial
// ---------------------------------------------------------------------------

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const FieldSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().min(10).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate token
  const req = await prisma.testimonialRequest.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      isActive: true,
      expiresAt: true,
    },
  });

  if (!req || !req.isActive) {
    return NextResponse.json(
      { error: 'This link is no longer active.' },
      { status: 404 }
    );
  }
  if (req.expiresAt && req.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired.' },
      { status: 410 }
    );
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fields = FieldSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') ?? '',
    rating: formData.get('rating'),
    text: formData.get('text'),
  });

  if (!fields.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: fields.error.flatten() },
      { status: 400 }
    );
  }

  // Handle photo uploads (up to 3)
  const photoUrls: string[] = [];
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const file = formData.get(`photo_${i}`) as File | null;
    if (!file || file.size === 0) continue;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Photo ${i + 1}: unsupported type. Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json(
        { error: `Photo ${i + 1}: file too large (max 10 MB).` },
        { status: 400 }
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadToStorage(
        `testimonials/${req.organizationId}`,
        file.name,
        buffer,
        file.type
      );
      photoUrls.push(result.url);
    } catch (err) {
      logger.error('Testimonial photo upload failed', { err });
      return NextResponse.json(
        { error: 'Photo upload failed. Please try again.' },
        { status: 500 }
      );
    }
  }

  // Handle video upload (optional)
  let videoUrl: string | null = null;
  const videoFile = formData.get('video') as File | null;
  const youtubeUrl = formData.get('youtube_url') as string | null;

  if (youtubeUrl && youtubeUrl.trim()) {
    videoUrl = youtubeUrl.trim();
  } else if (videoFile && videoFile.size > 0) {
    if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
      return NextResponse.json(
        { error: 'Video: only MP4 is supported.' },
        { status: 400 }
      );
    }
    if (videoFile.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: 'Video: file too large (max 100 MB).' },
        { status: 400 }
      );
    }

    try {
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      const result = await uploadToStorage(
        `testimonials/${req.organizationId}`,
        videoFile.name,
        buffer,
        videoFile.type
      );
      videoUrl = result.url;
    } catch (err) {
      logger.error('Testimonial video upload failed', { err });
      return NextResponse.json(
        { error: 'Video upload failed. Please try again.' },
        { status: 500 }
      );
    }
  }

  // IP for spam prevention
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null;

  const testimonial = await prisma.testimonial.create({
    data: {
      organizationId: req.organizationId,
      requestId: req.id,
      submitterName: fields.data.name,
      submitterEmail: fields.data.email || null,
      rating: fields.data.rating,
      text: fields.data.text,
      photoUrls,
      videoUrl,
      ipAddress: ip,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(
    { id: testimonial.id, message: 'Thank you for your testimonial!' },
    { status: 201 }
  );
}
